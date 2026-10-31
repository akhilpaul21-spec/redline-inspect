export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(input: string): ParsedColor | null {
  const s = input.trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'none') return { r: 0, g: 0, b: 0, a: 0 };

  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const aRaw = rgb[4];
    let a = 1;
    if (aRaw != null) a = aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
    return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a };
  }

  const hsl = s.match(/^hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (hsl) {
    const aRaw = hsl[4];
    let a = 1;
    if (aRaw != null) a = aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
    const { r, g, b } = hslToRgb(+hsl[1]!, +hsl[2]! / 100, +hsl[3]! / 100);
    return { r, g, b, a };
  }

  // Named colors via canvas
  if (typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillStyle = s;
      const computed = ctx.fillStyle;
      if (computed.startsWith('#')) return parseColor(computed);
      if (computed.startsWith('rgb')) return parseColor(computed);
    }
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s, l };
}

export function toHex(c: ParsedColor): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
  if (c.a >= 1) return base;
  return `${base}${h(c.a * 255)}`.toUpperCase();
}

export function toRgb(c: ParsedColor): string {
  if (c.a >= 1) return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${roundAlpha(c.a)})`;
}

export function toHsl(c: ParsedColor): string {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  const sp = Math.round(s * 100);
  const lp = Math.round(l * 100);
  if (c.a >= 1) return `hsl(${h}, ${sp}%, ${lp}%)`;
  return `hsla(${h}, ${sp}%, ${lp}%, ${roundAlpha(c.a)})`;
}

function roundAlpha(a: number): number {
  return Math.round(a * 1000) / 1000;
}

export function formatColor(css: string) {
  const parsed = parseColor(css);
  if (!parsed) {
    return { css, hex: css, rgb: css, hsl: css, alpha: 1 };
  }
  return {
    css,
    hex: toHex(parsed),
    rgb: toRgb(parsed),
    hsl: toHsl(parsed),
    alpha: parsed.a,
  };
}

export function normalizeRgbaKey(css: string): string | null {
  const p = parseColor(css);
  if (!p) return null;
  return `rgba(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)},${roundAlpha(p.a)})`;
}

function relLuminance(c: ParsedColor): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function contrastRatio(fg: string, bg: string): number {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return 1;
  // Composite fg over bg if fg has alpha
  const fgComp: ParsedColor =
    a.a >= 1
      ? a
      : {
          r: a.r * a.a + b.r * (1 - a.a),
          g: a.g * a.a + b.g * (1 - a.a),
          b: a.b * a.a + b.b * (1 - a.a),
          a: 1,
        };
  const L1 = relLuminance(fgComp);
  const L2 = relLuminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function deltaE(a: ParsedColor, b: ParsedColor): number {
  // Simple RGB Euclidean / scaled — good enough for ≈ threshold
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 2.55; // ~0-100 scale-ish
}

export function effectiveBackground(el: Element): string {
  let cur: Element | null = el;
  while (cur) {
    const bg = getComputedStyle(cur).backgroundColor;
    const p = parseColor(bg);
    if (p && p.a > 0.01) return toRgb(p);
    cur = cur.parentElement;
  }
  return 'rgb(255, 255, 255)';
}

export function parseGradientStops(backgroundImage: string): string[] {
  if (!/gradient\(/i.test(backgroundImage)) return [];
  const colors: string[] = [];
  const re = /#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(backgroundImage))) colors.push(m[0]);
  return colors;
}
