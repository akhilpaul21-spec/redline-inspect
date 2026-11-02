import { shortestUniqueSelector } from '../util/selector';
import { collectFontFaces, detectIconFontUsage } from './fonts';
import { isIconSvg, resolveUse, sanitizeSvg } from './svg';
import { fileNameFromUrl, nameFromElement, slugify, suggestedFileName } from './naming';

export interface CollectedAsset {
  kind: string;
  sourceUrl: string | null;
  mime?: string;
  suggestedName: string;
  folder: 'icons' | 'images' | 'fonts' | 'icons/glyphs';
  usedBy: string[];
  natural?: { w: number; h: number };
  rendered?: { w: number; h: number };
  density?: string;
  media?: string;
  inlineContent?: string | ArrayBuffer;
  element?: Element;
}

export interface CollectionResult {
  assets: CollectedAsset[];
  gradients: Array<{ css: string; usedBy: string[] }>;
  fonts: ReturnType<typeof collectFontFaces>;
  iconFonts: ReturnType<typeof detectIconFontUsage>;
}

function usedBy(el: Element): string {
  try {
    return shortestUniqueSelector(el);
  } catch {
    return el.tagName.toLowerCase();
  }
}

export async function collectAssets(
  opts: { includeFonts?: boolean; includeFavicons?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<CollectionResult> {
  const assets: CollectedAsset[] = [];
  const gradients: Array<{ css: string; usedBy: string[] }> = [];
  const seen = new Set<string>();

  const push = (a: CollectedAsset) => {
    const key = `${a.kind}|${a.sourceUrl ?? a.suggestedName}|${a.inlineContent ? 'inline' : ''}`;
    if (seen.has(key)) {
      const existing = assets.find((x) => `${x.kind}|${x.sourceUrl ?? x.suggestedName}|${x.inlineContent ? 'inline' : ''}` === key);
      if (existing) existing.usedBy = Array.from(new Set([...existing.usedBy, ...a.usedBy])).slice(0, 10);
      return;
    }
    seen.add(key);
    a.usedBy = a.usedBy.slice(0, 10);
    assets.push(a);
  };

  // Chunked walk
  const all: Element[] = [];
  await walkChunked(document.documentElement, (el) => all.push(el));

  let done = 0;
  const total = all.length;
  for (const el of all) {
    done++;
    if (done % 50 === 0) opts.onProgress?.(done, total);

    if (el instanceof HTMLImageElement) {
      const fallbackStem = el.id?.replace(/-img$/, '') || nameFromElement(el, 'image');
      const src = el.currentSrc || el.src;
      const seenSrc = new Set<string>();
      if (el.srcset) {
        for (const part of el.srcset.split(',')) {
          const [u, dens] = part.trim().split(/\s+/);
          if (!u) continue;
          const abs = new URL(u, location.href).href;
          seenSrc.add(abs);
          const isSvg = /\.svg(\?|$)/i.test(abs) || abs.startsWith('data:image/svg');
          const fromFile = fileNameFromUrl(abs);
          const suggestedName = fromFile
            ? injectDensity(fromFile, dens || '1x')
            : slugify(fallbackStem) + densitySuffix(dens || '1x') + (isSvg ? '.svg' : extFromUrl(abs) || '.jpg');
          push({
            kind: 'img',
            sourceUrl: abs,
            suggestedName,
            folder: 'images',
            usedBy: [usedBy(el)],
            density: dens || '1x',
            natural: { w: el.naturalWidth, h: el.naturalHeight },
            element: el,
          });
        }
      }
      if (src && !seenSrc.has(src)) {
        const rect = el.getBoundingClientRect();
        const isSvg = /\.svg(\?|$)/i.test(src) || src.startsWith('data:image/svg');
        push({
          kind: 'img',
          sourceUrl: src,
          suggestedName: suggestedFileName(src, fallbackStem, isSvg ? '.svg' : '.jpg'),
          folder: isSvg && rect.width <= 48 && rect.height <= 48 ? 'icons' : 'images',
          usedBy: [usedBy(el)],
          natural: { w: el.naturalWidth, h: el.naturalHeight },
          rendered: { w: rect.width, h: rect.height },
          element: el,
        });
      }
    }

    if (el instanceof HTMLSourceElement && el.srcset) {
      for (const part of el.srcset.split(',')) {
        const [u, dens] = part.trim().split(/\s+/);
        if (!u) continue;
        const abs = new URL(u, location.href).href;
        const fromFile = fileNameFromUrl(abs);
        push({
          kind: 'picture-source',
          sourceUrl: abs,
          suggestedName: fromFile
            ? injectDensity(fromFile, dens)
            : slugify('picture') + densitySuffix(dens) + (extFromUrl(u) || '.bin'),
          folder: 'images',
          usedBy: [usedBy(el.parentElement || el)],
          density: dens,
          media: el.media || undefined,
        });
      }
    }

    if (el instanceof SVGElement && el.tagName.toLowerCase() === 'svg' && !el.closest('svg svg')) {
      const rect = el.getBoundingClientRect();
      const resolved = resolveUse(el as SVGSVGElement);
      const content = sanitizeSvg(resolved);
      const name = nameFromElement(el, 'icon');
      push({
        kind: 'svg-inline',
        sourceUrl: null,
        mime: 'image/svg+xml',
        suggestedName: `${name}.svg`,
        folder: isIconSvg(el, rect) ? 'icons' : 'images',
        usedBy: [usedBy(el)],
        rendered: { w: rect.width, h: rect.height },
        inlineContent: content,
      });
    }

    if (el instanceof HTMLVideoElement && el.poster) {
      push({
        kind: 'img',
        sourceUrl: el.poster,
        suggestedName: suggestedFileName(el.poster, 'poster', '.jpg'),
        folder: 'images',
        usedBy: [usedBy(el)],
      });
    }

    // CSS backgrounds / masks (skip url(#clip) fragment refs — not fetchable images)
    try {
      const style = getComputedStyle(el);
      for (const prop of ['backgroundImage', 'maskImage', 'webkitMaskImage', 'listStyleImage', 'clipPath'] as const) {
        const val = (style as any)[prop] as string;
        if (!val || val === 'none') continue;
        if (/gradient\(/i.test(val)) {
          gradients.push({ css: val, usedBy: [usedBy(el)] });
        }
        for (const m of val.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const url = m[1]!;
          // SVG mask/clip path references like url(#mask) are not assets.
          if (url.startsWith('#')) continue;
          const abs = new URL(url, location.href).href;
          if (url.startsWith('data:image/svg') || /\.svg(\?|$)/i.test(url)) {
            push({
              kind: 'background',
              sourceUrl: abs,
              suggestedName: suggestedFileName(abs, nameFromElement(el, 'bg'), '.svg'),
              folder: 'icons',
              usedBy: [usedBy(el)],
            });
          } else {
            push({
              kind: 'background',
              sourceUrl: abs,
              suggestedName: suggestedFileName(abs, nameFromElement(el, 'bg'), '.png'),
              folder: 'images',
              usedBy: [usedBy(el)],
            });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (opts.includeFavicons !== false) {
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
      const href = (link as HTMLLinkElement).href;
      if (!href) return;
      push({
        kind: 'favicon',
        sourceUrl: href,
        suggestedName: suggestedFileName(href, 'favicon', '.ico'),
        folder: 'icons',
        usedBy: ['link[rel~=icon]'],
      });
    });
  }

  const fonts = opts.includeFonts === false ? [] : collectFontFaces();
  if (opts.includeFonts !== false) {
    for (const font of fonts) {
      for (const url of font.urls) {
        const abs = new URL(url, location.href).href;
        const fromFile = fileNameFromUrl(abs);
        push({
          kind: 'font',
          sourceUrl: abs,
          // Prefer the font file basename (spaces → hyphens); else family-weight-style.
          suggestedName:
            fromFile ||
            `${slugify(font.family)}-${String(font.weight).replace(/\s+/g, '')}-${String(font.style).replace(/\s+/g, '')}${extFromUrl(url) || '.woff2'}`,
          folder: 'fonts',
          usedBy: [font.family],
        });
      }
    }
  }

  const iconFonts = detectIconFontUsage();
  opts.onProgress?.(total, total);
  return { assets, gradients, fonts, iconFonts };
}

async function walkChunked(root: Element, visit: (el: Element) => void): Promise<void> {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let n: Node | null = tw.currentNode;
  let count = 0;
  const queue: Array<ShadowRoot> = [];

  while (n) {
    if (n instanceof Element) {
      visit(n);
      if (n.shadowRoot) queue.push(n.shadowRoot);
    }
    n = tw.nextNode();
    count++;
    if (count % 500 === 0) {
      await new Promise<void>((r) => {
        if ('requestIdleCallback' in window) (window as any).requestIdleCallback(() => r());
        else setTimeout(r, 0);
      });
    }
  }
  for (const sr of queue) {
    await walkChunked(sr as unknown as Element, visit);
  }
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url, location.href).pathname;
    const m = path.match(/\.[a-z0-9]+$/i);
    return m ? m[0]!.toLowerCase() : '';
  } catch {
    return '';
  }
}

function densitySuffix(dens?: string): string {
  if (!dens) return '';
  if (dens === '2x' || dens === '2.0x') return '@2x';
  if (dens === '1x' || dens === '1.0x') return '@1x';
  if (/^\d+(\.\d+)?x$/.test(dens)) return `@${dens}`;
  if (/^\d+w$/.test(dens)) return `-${dens}`;
  return '';
}

function injectDensity(fileName: string, dens?: string): string {
  const suffix = densitySuffix(dens);
  if (!suffix) return fileName.replace(/\s+/g, '-');
  return fileName.replace(/(\.[a-z0-9]+)$/i, `${suffix}$1`).replace(/\s+/g, '-');
}
