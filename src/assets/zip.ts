import type { RedlineConfig } from '../types';
import type { RedlineComment } from '../comments/store';
import { collectAssets } from './collect';
import {
  ASSET_FETCH_TIMEOUT_MS,
  canvasFallback,
  fetchAsset,
  mapPool,
  withTimeout,
  type FetchFailReason,
} from './fetch';
import { dedupeName, sha1Hex } from './naming';
import { detectIconFontUsage } from './fonts';

export type ProgressFn = (msg: string) => void;

export interface SkippedAsset {
  url: string | null;
  kind: string;
  reason: FetchFailReason | 'error';
  usedBy?: string[];
}

const JSZIP_LOAD_TIMEOUT_MS = 12_000;

async function loadJSZip(jszipUrl?: string): Promise<any> {
  // Prefer an already-loaded global (IIFE CDN path or host page).
  if (typeof window !== 'undefined' && (window as any).JSZip) {
    return (window as any).JSZip;
  }
  // ESM / bundler path — vite-ignore keeps JSZip out of the IIFE bundle.
  try {
    const mod = await withTimeout(
      import(/* @vite-ignore */ 'jszip'),
      JSZIP_LOAD_TIMEOUT_MS,
      'jszip-import-timeout',
    );
    return (mod as any).default ?? mod;
  } catch {
    /* fall through to CDN */
  }
  const url = jszipUrl || 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('JSZip CDN blocked'));
      document.head.appendChild(s);
    }),
    JSZIP_LOAD_TIMEOUT_MS,
    'jszip-cdn-timeout',
  );
  const g = (window as any).JSZip;
  if (!g) throw new Error('JSZip not available');
  return g;
}

export async function exportAssetsZip(
  config: RedlineConfig,
  onProgress?: ProgressFn,
  comments: RedlineComment[] = [],
): Promise<Blob> {
  const assetsCfg = config.assets ?? {};
  const timeoutMs = ASSET_FETCH_TIMEOUT_MS;
  onProgress?.('Preparing…');
  const collected = await collectAssets({
    includeFonts: assetsCfg.includeFonts !== false,
    includeFavicons: assetsCfg.includeFavicons !== false,
    onProgress: (done, total) => onProgress?.(`Preparing ${done}/${total}`),
  });

  const manifestAssets: any[] = [];
  const skipped: SkippedAsset[] = [];
  const files = new Map<string, Uint8Array | string>();
  const usedNames = new Map<string, string>();
  // Content-hash → zip path; avoids O(n²) re-hashing every prior file per asset.
  const hashToPath = new Map<string, string>();

  const jobs = collected.assets;
  const total = jobs.length;
  let completed = 0;
  onProgress?.(`Preparing 0/${total}`);

  await mapPool(jobs, 6, async (asset) => {
    try {
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
          timeoutMs,
          expectBinary: asset.kind !== 'svg-inline',
        });
        if (res.ok) {
          buffer = res.buffer;
          mime = res.mime;
        } else if (asset.element instanceof HTMLImageElement) {
          // Redraw painted <img>s when fetch is blocked (CORS / cookie wall / wrong-type HTML).
          // canvasFallback itself refuses unloaded images (naturalWidth === 0).
          const fb = await canvasFallback(asset.element, timeoutMs);
          if (fb) {
            buffer = fb;
            mime = 'image/png';
            via = 'canvas';
          } else {
            skipped.push({
              url: asset.sourceUrl,
              kind: asset.kind,
              reason: res.reason,
              usedBy: asset.usedBy,
            });
          }
        } else {
          skipped.push({
            url: asset.sourceUrl,
            kind: asset.kind,
            reason: res.reason,
            usedBy: asset.usedBy,
          });
        }
      }

      if (buffer) {
        const hash = await sha1Hex(buffer);
        const existingPath = hashToPath.get(hash);
        if (existingPath) {
          manifestAssets.push({
            file: existingPath,
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
        } else {
          const fileName = dedupeName(asset.suggestedName, usedNames, hash);
          const path = `${asset.folder}/${fileName}`;
          files.set(path, new Uint8Array(buffer));
          hashToPath.set(hash, path);
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
        }
      }
    } catch {
      skipped.push({
        url: asset.sourceUrl,
        kind: asset.kind,
        reason: 'error',
        usedBy: asset.usedBy,
      });
    } finally {
      completed++;
      onProgress?.(`Preparing ${completed}/${total}`);
    }
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
        const blob = await withTimeout(
          new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png')),
          timeoutMs,
          'glyph-timeout',
        );
        if (!blob) continue;
        const buf = new Uint8Array(await withTimeout(blob.arrayBuffer(), timeoutMs, 'glyph-timeout'));
        const name = `${slugSafe(g.text || 'glyph')}.png`;
        const path = `icons/glyphs/${name}`;
        files.set(path, buf);
        (g as any).png = path;
      } catch {
        skipped.push({
          url: null,
          kind: 'icon-glyph',
          reason: 'timeout',
          usedBy: [g.selector],
        });
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
    skipped,
    // Alias retained for older consumers / fixtures.
    unfetchable: skipped,
    comments,
  };

  const readme =
    skipped.length === 0
      ? 'All assets fetched successfully.\n'
      : `Skipped assets (download manually):\n${skipped.map((u) => `- ${u.url ?? u.kind} (${u.reason})`).join('\n')}\n`;

  files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
  files.set('comments.json', new TextEncoder().encode(JSON.stringify(comments, null, 2)));
  files.set('README.txt', new TextEncoder().encode(readme));

  try {
    onProgress?.('Zipping…');
    const JSZip = await loadJSZip(assetsCfg.jszipUrl);
    const zip = new JSZip();
    for (const [path, data] of files) zip.file(path, data);
    return await withTimeout(zip.generateAsync({ type: 'blob' }), 60_000, 'zip-timeout');
  } catch {
    onProgress?.('Install redline via npm for export');
    // Manifest-only fallback — still settles with a downloadable Blob.
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
  a.style.display = 'none';
  // Inspect mode's window capture listener would cancel this click and select
  // whatever sits at (0,0). Tag so events.ts lets the download through.
  a.setAttribute('data-redline-download', '');
  // Always attach to document.body (not the shadow root) so the gesture survives
  // the long await chain of asset collection.
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
