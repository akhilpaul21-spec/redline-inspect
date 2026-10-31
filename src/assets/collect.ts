import { shortestUniqueSelector } from '../util/selector';
import { collectFontFaces, detectIconFontUsage } from './fonts';
import { isIconSvg, resolveUse, sanitizeSvg } from './svg';
import { nameFromElement, slugify } from './naming';

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
      const baseName = slugify(
        el.id?.replace(/-img$/, '') || nameFromElement(el, 'image'),
      );
      const src = el.currentSrc || el.src;
      const seenSrc = new Set<string>();
      if (el.srcset) {
        for (const part of el.srcset.split(',')) {
          const [u, dens] = part.trim().split(/\s+/);
          if (!u) continue;
          const abs = new URL(u, location.href).href;
          seenSrc.add(abs);
          const isSvg = /\.svg(\?|$)/i.test(abs) || abs.startsWith('data:image/svg');
          push({
            kind: 'img',
            sourceUrl: abs,
            suggestedName: baseName + densitySuffix(dens || '1x') + (isSvg ? '.svg' : extFromUrl(abs) || '.jpg'),
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
          suggestedName: baseName + (isSvg ? '.svg' : extFromUrl(src) || '.jpg'),
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
        push({
          kind: 'picture-source',
          sourceUrl: new URL(u, location.href).href,
          suggestedName: slugify('picture') + densitySuffix(dens) + (extFromUrl(u) || '.bin'),
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
        suggestedName: slugify('poster') + extFromUrl(el.poster),
        folder: 'images',
        usedBy: [usedBy(el)],
      });
    }

    // CSS backgrounds
    try {
      const style = getComputedStyle(el);
      for (const prop of ['backgroundImage', 'maskImage', 'listStyleImage'] as const) {
        const val = (style as any)[prop] as string;
        if (!val || val === 'none') continue;
        if (/gradient\(/i.test(val)) {
          gradients.push({ css: val, usedBy: [usedBy(el)] });
        }
        for (const m of val.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const url = m[1]!;
          if (url.startsWith('data:image/svg') || /\.svg(\?|$)/i.test(url)) {
            push({
              kind: 'background',
              sourceUrl: new URL(url, location.href).href,
              suggestedName: slugify(nameFromElement(el, 'bg')) + '.svg',
              folder: 'icons',
              usedBy: [usedBy(el)],
            });
          } else {
            push({
              kind: 'background',
              sourceUrl: new URL(url, location.href).href,
              suggestedName: slugify(nameFromElement(el, 'bg')) + (extFromUrl(url) || '.png'),
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
        suggestedName: 'favicon' + (extFromUrl(href) || '.ico'),
        folder: 'icons',
        usedBy: ['link[rel~=icon]'],
      });
    });
  }

  const fonts = opts.includeFonts === false ? [] : collectFontFaces();
  if (opts.includeFonts !== false) {
    for (const font of fonts) {
      for (const url of font.urls) {
        push({
          kind: 'font',
          sourceUrl: new URL(url, location.href).href,
          suggestedName: `${slugify(font.family)}-${font.weight}-${font.style}${extFromUrl(url) || '.woff2'}`,
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
