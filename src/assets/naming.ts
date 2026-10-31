export function slugify(input: string, max = 60): string {
  const s = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return s || 'asset';
}

export function dedupeName(name: string, used: Map<string, string>, contentHash: string): string {
  const existing = used.get(name);
  if (!existing) {
    used.set(name, contentHash);
    return name;
  }
  if (existing === contentHash) return name; // identical content
  let i = 2;
  while (used.has(`${stripExt(name)}-${i}${ext(name)}`)) {
    const key = `${stripExt(name)}-${i}${ext(name)}`;
    if (used.get(key) === contentHash) return key;
    i++;
  }
  const next = `${stripExt(name)}-${i}${ext(name)}`;
  used.set(next, contentHash);
  return next;
}

function ext(name: string): string {
  const m = name.match(/\.[a-z0-9]+$/i);
  return m ? m[0]! : '';
}

function stripExt(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '');
}

export function nameFromElement(el: Element, fallback: string): string {
  const aria =
    el.getAttribute('aria-label') ||
    el.closest('[aria-label]')?.getAttribute('aria-label') ||
    null;
  if (aria) return slugify(aria);
  const title =
    el.querySelector?.('title')?.textContent ||
    (el instanceof SVGElement ? el.querySelector('title')?.textContent : null);
  if (title) return slugify(title);
  if (el.id && !/^[a-z]?[\d_-]+$/i.test(el.id) && el.id.length < 40) return slugify(el.id);
  const dataIcon = el.getAttribute('data-icon') || el.getAttribute('data-name');
  if (dataIcon) return slugify(dataIcon);
  for (const c of Array.from(el.classList)) {
    if (/^(w|h|p|m|text|bg|flex|grid|gap|rounded|shadow|border)-/.test(c)) continue;
    if (/^css-/.test(c) || /[0-9a-f]{5,}/i.test(c)) continue;
    if (c.length > 2) return slugify(c);
  }
  const host = el.closest('button,a');
  const nearby = host?.getAttribute('aria-label') || host?.textContent?.trim();
  if (nearby && nearby.length < 40) return slugify(nearby);
  return slugify(fallback);
}

export async function sha1Hex(data: ArrayBuffer | string): Promise<string> {
  const buf =
    typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(await (data as ArrayBuffer));
  if (crypto?.subtle?.digest) {
    const dig = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(dig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback simple hash
  let h = 0;
  for (const b of buf) h = (h * 31 + b) >>> 0;
  return h.toString(16).padStart(8, '0');
}
