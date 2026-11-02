export type FetchFailReason = 'cors' | 'network' | 'tainted' | '404' | 'timeout' | 'wrong-type';

/** Default per-asset fetch budget (ms). */
export const ASSET_FETCH_TIMEOUT_MS = 8_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'timeout'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

/** True when a response is an HTML document (e.g. login / 401 page) instead of an image or font. */
export function isHtmlPayload(mime: string, buffer: ArrayBuffer): boolean {
  if (/text\/html/i.test(mime) || /application\/xhtml\+xml/i.test(mime)) return true;
  const head = new TextDecoder()
    .decode(new Uint8Array(buffer).slice(0, 256))
    .trimStart()
    .toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

export async function fetchAsset(
  url: string,
  opts: {
    timeoutMs?: number;
    sameOriginOnly?: boolean;
    /** When set, HTML login/error pages are rejected as wrong-type. */
    expectBinary?: boolean;
  } = {},
): Promise<{ ok: true; buffer: ArrayBuffer; mime: string } | { ok: false; reason: FetchFailReason }> {
  const timeoutMs = opts.timeoutMs ?? ASSET_FETCH_TIMEOUT_MS;

  if (url.startsWith('data:')) {
    try {
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
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  if (url.startsWith('blob:')) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return { ok: false, reason: 'network' };
      const buffer = await res.arrayBuffer();
      const mime = res.headers.get('content-type') || 'application/octet-stream';
      if (opts.expectBinary !== false && isHtmlPayload(mime, buffer)) {
        return { ok: false, reason: 'wrong-type' };
      }
      return { ok: true, buffer, mime };
    } catch {
      return { ok: false, reason: ctrl.signal.aborted ? 'timeout' : 'network' };
    } finally {
      window.clearTimeout(t);
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

  const sameOrigin = absolute.origin === location.origin;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Password-protected / cookie-gated same-origin assets need credentials.
    // Cross-origin stays omit so we don't leak cookies.
    const res = await fetch(absolute.href, {
      mode: 'cors',
      credentials: sameOrigin ? 'same-origin' : 'omit',
      signal: ctrl.signal,
    });
    if (res.status === 404) return { ok: false, reason: '404' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const buffer = await res.arrayBuffer();
    const mime = res.headers.get('content-type') || 'application/octet-stream';
    if (opts.expectBinary !== false && isHtmlPayload(mime, buffer)) {
      return { ok: false, reason: 'wrong-type' };
    }
    return { ok: true, buffer, mime };
  } catch {
    // Aborts were previously mis-labeled as cors, which hid real hangs behind a soft skip
    // that never arrived because the request never settled without a working AbortController.
    if (ctrl.signal.aborted) return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'cors' };
  } finally {
    window.clearTimeout(t);
  }
}

export async function canvasFallback(
  img: HTMLImageElement,
  timeoutMs = ASSET_FETCH_TIMEOUT_MS,
): Promise<ArrayBuffer | null> {
  try {
    if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const blob = await withTimeout(
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')),
      timeoutMs,
      'canvas-timeout',
    );
    if (!blob) return null;
    return await withTimeout(blob.arrayBuffer(), timeoutMs, 'canvas-timeout');
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
