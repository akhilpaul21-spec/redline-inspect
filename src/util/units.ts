export function roundCssPx(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n * 2) / 2;
  return Object.is(r, -0) ? 0 : r;
}

export function formatPx(n: number): string {
  const r = roundCssPx(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function getRemBase(remBase: number | 'auto' = 'auto'): number {
  if (typeof remBase === 'number' && remBase > 0) return remBase;
  if (typeof document === 'undefined') return 16;
  const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(fs) && fs > 0 ? fs : 16;
}

export function pxToRem(px: number, remBase: number | 'auto' = 'auto'): number {
  const base = getRemBase(remBase);
  return px / base;
}

export function formatLength(
  px: number,
  units: 'px' | 'rem' | 'both',
  remBase: number | 'auto' = 'auto',
): string {
  const p = formatPx(px);
  if (units === 'px') return p;
  const rem = pxToRem(px, remBase);
  const remFmt =
    Math.abs(rem - Math.round(rem)) < 1e-9
      ? `${Math.round(rem)}rem`
      : `${(Math.round(rem * 1000) / 1000).toString().replace(/\.?0+$/, '')}rem`;
  if (units === 'rem') return remFmt;
  return `${p} · ${remFmt}`;
}

export function parseLengthPx(value: string, el?: Element): number {
  const v = value.trim();
  if (!v || v === 'auto' || v === 'none' || v === 'normal') return 0;
  if (v.endsWith('px')) return parseFloat(v) || 0;
  if (v.endsWith('rem')) return (parseFloat(v) || 0) * getRemBase();
  if (v.endsWith('em') && el) {
    const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
    return (parseFloat(v) || 0) * fs;
  }
  if (v.endsWith('%')) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
