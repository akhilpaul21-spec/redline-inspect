import type { RedlineConfig } from '../types';
import { collectAssets } from './collect';
import { canvasFallback, fetchAsset, mapPool } from './fetch';
import { dedupeName, sha1Hex } from './naming';
import { detectIconFontUsage } from './fonts';

export type ProgressFn = (msg: string) => void;

async function loadJSZip(jszipUrl?: string): Promise<any> {
  // Prefer an already-loaded global (IIFE CDN path or host page).
  if (typeof window !== 'undefined' && (window as any).JSZip) {
    return (window as any).JSZip;
  }
  // ESM / bundler path — vite-ignore keeps JSZip out of the IIFE bundle.
  try {
    const mod = await import(/* @vite-ignore */ 'jszip');
    return (mod as any).default ?? mod;
  } catch {
    /* fall through to CDN */
  }
  const url = jszipUrl || 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('JSZip CDN blocked'));
    document.head.appendChild(s);
  });
  const g = (window as any).JSZip;
  if (!g) throw new Error('JSZip not available');
  return g;
}

export async function exportAssetsZip(
  config: RedlineConfig,
  onProgress?: ProgressFn,
): Promise<Blob> {
  const assetsCfg = config.assets ?? {};
  onProgress?.('Collecting…');
  const collected = await collectAssets({
    includeFonts: assetsCfg.includeFonts !== false,
    includeFavicons: assetsCfg.includeFavicons !== false,
    onProgress: (done, total) => onProgress?.(`Collecting… ${done} / ${total}`),
  });

  const manifestAssets: any[] = [];
  const unfetchable: any[] = [];
  const files = new Map<string, Uint8Array | string>();
  const usedNames = new Map<string, string>();

  const jobs = collected.assets;
  await mapPool(jobs, 6, async (asset) => {
    let buffer: ArrayBuffer | null = null;
    let mime = asset.mime || 'application/octet-stream';
    let via: string | undefined;

    if (typeof asset.inlineContent === 'string') {
      buffer = new TextEncoder().encode(asset.inlineContent).buffer;
      mime = 'image/svg+xml';
    } else if (asset.inlineContent instanceof ArrayBuffer) {
      buffer = asset.inlineContent;
    } else if (asset.sourceUrl) {
      const res = await fetchAsset(asset.sourceUrl, {
        sameOriginOnly: assetsCfg.sameOriginOnly,
        timeoutMs: 15_000,
      });
      if (res.ok) {
        buffer = res.buffer;
        mime = res.mime;
      } else if (asset.element instanceof HTMLImageElement) {
        const fb = await canvasFallback(asset.element);
        if (fb) {
          buffer = fb;
          mime = 'image/png';
          via = 'canvas';
        } else {
          unfetchable.push({
            url: asset.sourceUrl,
            kind: asset.kind,
            reason: res.reason,
            usedBy: asset.usedBy,
          });
        }
      } else {
        unfetchable.push({
          url: asset.sourceUrl,
          kind: asset.kind,
          reason: res.reason,
          usedBy: asset.usedBy,
        });
      }
    }

    if (!buffer) return;

    const hash = await sha1Hex(buffer);
    // Identical content dedupe across names
    for (const [path, prev] of files) {
      if (typeof prev !== 'string') {
        const prevHash = await sha1Hex(prev.buffer.slice(prev.byteOffset, prev.byteOffset + prev.byteLength) as ArrayBuffer);
        if (prevHash === hash) {
          manifestAssets.push({
            file: path,
            kind: asset.kind,
            sourceUrl: asset.sourceUrl,
            mime,
            bytes: buffer.byteLength,
            natural: asset.natural,
            rendered: asset.rendered,
            density: asset.density,
            media: asset.media,
            usedBy: asset.usedBy,
            sha1: hash,
            via,
          });
          return;
        }
      }
    }

    const fileName = dedupeName(asset.suggestedName, usedNames, hash);
    const path = `${asset.folder}/${fileName}`;
    files.set(path, new Uint8Array(buffer));
    manifestAssets.push({
      file: path,
      kind: asset.kind,
      sourceUrl: asset.sourceUrl,
      mime,
      bytes: buffer.byteLength,
      natural: asset.natural,
      rendered: asset.rendered,
      density: asset.density,
      media: asset.media,
      usedBy: asset.usedBy,
      sha1: hash,
      via,
    });
  });

  // Optional icon glyph PNGs
  const iconFonts = collected.iconFonts;
  if (assetsCfg.renderIconGlyphs !== false) {
    for (const g of iconFonts) {
      try {
        const canvas = document.createElement('canvas');
        const size = Math.max(24, g.size) * 2;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.font = `${size * 0.8}px "${g.family}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(g.text, size / 2, size / 2);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
        if (!blob) continue;
        const buf = new Uint8Array(await blob.arrayBuffer());
        const name = `${slugSafe(g.text || 'glyph')}.png`;
        const path = `icons/glyphs/${name}`;
        files.set(path, buf);
        (g as any).png = path;
      } catch {
        /* ignore */
      }
    }
  }

  const manifest = {
    generator: 'redline@0.1.0',
    page: {
      url: location.href,
      title: document.title,
      exportedAt: new Date().toISOString(),
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      },
    },
    assets: manifestAssets,
    fonts: collected.fonts.map((f) => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      file: [...files.keys()].find((p) => p.includes(slugSafe(f.family))) ?? null,
      sourceUrl: f.urls[0] ?? null,
      usedBy: [f.family],
    })),
    iconFonts: groupIconFonts(iconFonts),
    gradients: collected.gradients,
    unfetchable,
  };

  const readme =
    unfetchable.length === 0
      ? 'All assets fetched successfully.\n'
      : `Unfetchable assets (download manually):\n${unfetchable.map((u) => `- ${u.url} (${u.reason})`).join('\n')}\n`;

  files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
  files.set('README.txt', new TextEncoder().encode(readme));

  try {
    const JSZip = await loadJSZip(assetsCfg.jszipUrl);
    const zip = new JSZip();
    for (const [path, data] of files) zip.file(path, data);
    onProgress?.('Zipping…');
    return await zip.generateAsync({ type: 'blob' });
  } catch {
    onProgress?.('Install redline via npm for export');
    // Manifest-only fallback
    return new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  }
}

function slugSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'glyph';
}

function groupIconFonts(glyphs: ReturnType<typeof detectIconFontUsage>) {
  const map = new Map<string, any>();
  for (const g of glyphs) {
    const entry = map.get(g.family) ?? { family: g.family, glyphs: [] as any[] };
    entry.glyphs.push({
      text: g.text,
      codepoint: g.codepoint,
      selector: g.selector,
      size: g.size,
      png: (g as any).png,
    });
    map.set(g.family, entry);
  }
  return Array.from(map.values());
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
