export type FetchFailReason = 'cors' | 'network' | 'tainted' | '404';

export async function fetchAsset(
  url: string,
  opts: { timeoutMs?: number; sameOriginOnly?: boolean } = {},
): Promise<{ ok: true; buffer: ArrayBuffer; mime: string } | { ok: false; reason: FetchFailReason }> {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!m) return { ok: false, reason: 'network' };
    const mime = m[1] || 'application/octet-stream';
    const data = m[3] ?? '';
    if (m[2]) {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ok: true, buffer: bytes.buffer, mime };
    }
    return { ok: true, buffer: new TextEncoder().encode(decodeURIComponent(data)).buffer, mime };
  }

  if (url.startsWith('blob:')) {
    try {
      const res = await fetch(url);
      return { ok: true, buffer: await res.arrayBuffer(), mime: res.headers.get('content-type') || 'application/octet-stream' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  let absolute: URL;
  try {
    absolute = new URL(url, location.href);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (opts.sameOriginOnly && absolute.origin !== location.origin) {
    return { ok: false, reason: 'cors' };
  }

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(absolute.href, { mode: 'cors', credentials: 'omit', signal: ctrl.signal });
    if (res.status === 404) return { ok: false, reason: '404' };
    if (!res.ok) return { ok: false, reason: 'network' };
    return {
      ok: true,
      buffer: await res.arrayBuffer(),
      mime: res.headers.get('content-type') || 'application/octet-stream',
    };
  } catch {
    return { ok: false, reason: 'cors' };
  } finally {
    clearTimeout(t);
  }
}

export async function canvasFallback(img: HTMLImageElement): Promise<ArrayBuffer | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return blob.arrayBuffer();
  } catch {
    return null;
  }
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]!, idx);
    }
  });
  await Promise.all(workers);
  return results;
}
