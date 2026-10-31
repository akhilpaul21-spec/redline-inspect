import type { TokenMaps } from '../types';
import { deltaE, normalizeRgbaKey, parseColor } from './colors';

export function collectTokens(prefixes?: string[]): TokenMaps {
  const all: Record<string, string> = {};
  const colors = new Map<string, string[]>();
  const lengths = new Map<string, string[]>();
  const shadows = new Map<string, string[]>();

  const add = (name: string, value: string) => {
    if (prefixes?.length && !prefixes.some((p) => name.startsWith(p))) return;
    all[name] = value;
    const colorKey = normalizeRgbaKey(value);
    if (colorKey) {
      const list = colors.get(colorKey) ?? [];
      list.push(name);
      colors.set(colorKey, list);
      return;
    }
    if (/px|rem|em|%/.test(value) && !/\s/.test(value.trim())) {
      const list = lengths.get(value.trim()) ?? [];
      list.push(name);
      lengths.set(value.trim(), list);
      return;
    }
    if (/shadow/i.test(name) || /,/.test(value)) {
      const list = shadows.get(value.trim()) ?? [];
      list.push(name);
      shadows.set(value.trim(), list);
    }
  };

  // Computed custom props on root
  try {
    const rootStyle = getComputedStyle(document.documentElement);
    for (let i = 0; i < rootStyle.length; i++) {
      const prop = rootStyle.item(i);
      if (prop.startsWith('--')) add(prop, rootStyle.getPropertyValue(prop).trim());
    }
  } catch {
    /* ignore */
  }

  // Stylesheets
  walkSheets((name, value) => add(name, value));

  return { colors, lengths, shadows, all };
}

function walkSheets(onVar: (name: string, value: string) => void): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkRules(sheet.cssRules, onVar);
    } catch {
      /* cross-origin */
    }
  }
}

function walkRules(rules: CSSRuleList | undefined, onVar: (name: string, value: string) => void): void {
  if (!rules) return;
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const sel = rule.selectorText;
      if (!/(^|:root|html|body|\*)/.test(sel) && !sel.includes(':root')) {
        // still allow :root/html/body
        if (!/(^|,)\s*(:root|html|body)\b/.test(sel)) continue;
      }
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style.item(i);
        if (prop.startsWith('--')) onVar(prop, rule.style.getPropertyValue(prop).trim());
      }
    } else if (
      rule instanceof CSSMediaRule ||
      rule instanceof CSSSupportsRule ||
      (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule)
    ) {
      walkRules((rule as CSSGroupingRule).cssRules, onVar);
    }
  }
}

export function matchColorToken(
  css: string,
  maps: TokenMaps,
): { token?: string; match?: 'exact' | 'nearest' } {
  const key = normalizeRgbaKey(css);
  if (key && maps.colors.has(key)) {
    return { token: maps.colors.get(key)![0], match: 'exact' };
  }
  const parsed = parseColor(css);
  if (!parsed || parsed.a < 0.01) return {};
  let best: { token: string; d: number } | null = null;
  for (const [k, names] of maps.colors) {
    const other = parseColor(k);
    if (!other) continue;
    const d = deltaE(parsed, other);
    if (d < 2 && (!best || d < best.d)) best = { token: names[0]!, d };
  }
  if (best) return { token: best.token, match: 'nearest' };
  return {};
}

export function matchLengthToken(css: string, maps: TokenMaps): string | undefined {
  return maps.lengths.get(css.trim())?.[0];
}

export function matchShadowToken(css: string, maps: TokenMaps): string | undefined {
  return maps.shadows.get(css.trim())?.[0];
}
