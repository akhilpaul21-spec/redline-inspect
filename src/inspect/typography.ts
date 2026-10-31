import type { TypographySpec } from '../types';
import { contrastRatio, effectiveBackground, formatColor } from './colors';
import { getRemBase, parseLengthPx, pxToRem, roundCssPx } from '../util/units';

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

export function weightName(w: number): string {
  const nearest = Object.keys(WEIGHT_NAMES)
    .map(Number)
    .reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), 400);
  return WEIGHT_NAMES[nearest] ?? String(w);
}

export function detectRenderedFont(fontFamily: string, fontSize = '16px', fontWeight = '400'): string | null {
  if (typeof document === 'undefined' || !document.fonts?.check) return null;
  const families = fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
  for (const family of families) {
    if (!family) continue;
    try {
      if (document.fonts.check(`${fontWeight} ${fontSize} "${family}"`)) return family;
      if (document.fonts.check(`${fontWeight} ${fontSize} ${family}`)) return family;
    } catch {
      /* continue */
    }
  }
  return families[0] ?? null;
}

function hasDirectText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim()) return true;
  }
  return false;
}

const TEXT_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'A', 'LI', 'LABEL', 'BUTTON',
  'TD', 'TH', 'DT', 'DD', 'FIGCAPTION', 'BLOCKQUOTE', 'CODE', 'PRE', 'EM', 'STRONG', 'SMALL',
]);

export function shouldShowTypography(el: Element): boolean {
  return TEXT_TAGS.has(el.tagName) || hasDirectText(el);
}

export function getTypography(el: Element, remBase: number | 'auto' = 'auto'): TypographySpec | null {
  if (!shouldShowTypography(el)) return null;
  const style = getComputedStyle(el);
  const fontSizePx = parseLengthPx(style.fontSize);
  const base = getRemBase(remBase);
  const weight = parseInt(style.fontWeight, 10) || 400;
  let lineHeightPx = parseLengthPx(style.lineHeight, el);
  if (!lineHeightPx && style.lineHeight === 'normal') lineHeightPx = fontSizePx * 1.2;
  const unitless = fontSizePx ? lineHeightPx / fontSizePx : 0;
  const letterPx = style.letterSpacing === 'normal' ? 0 : parseLengthPx(style.letterSpacing, el);
  const letterEm = fontSizePx ? letterPx / fontSizePx : 0;
  const color = formatColor(style.color);
  const bg = effectiveBackground(el);
  const ratio = contrastRatio(style.color, bg);
  const clamp =
    (style as any).webkitLineClamp && (style as any).webkitLineClamp !== 'none'
      ? String((style as any).webkitLineClamp)
      : null;

  return {
    fontFamily: style.fontFamily,
    renderedFont: detectRenderedFont(style.fontFamily, style.fontSize, style.fontWeight),
    fontSize: { px: roundCssPx(fontSizePx), rem: roundCssPx(pxToRem(fontSizePx, base) * 1000) / 1000 },
    fontWeight: { value: weight, name: weightName(weight) },
    lineHeight: { px: roundCssPx(lineHeightPx), unitless: Math.round(unitless * 1000) / 1000 },
    letterSpacing: { px: roundCssPx(letterPx), em: Math.round(letterEm * 10000) / 10000 },
    textTransform: style.textTransform,
    textAlign: style.textAlign,
    textDecoration: style.textDecorationLine || style.textDecoration,
    whiteSpace: style.whiteSpace,
    fontStyle: style.fontStyle,
    lineClamp: clamp,
    color: { ...color },
    contrast: {
      ratio,
      aa: ratio >= 4.5,
      aaa: ratio >= 7,
      bg,
    },
  };
}
