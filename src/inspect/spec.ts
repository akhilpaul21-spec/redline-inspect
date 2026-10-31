import type { ElementSpec, TokenMaps } from '../types';
import { getBoxModel } from './box-model';
import { formatColor, parseGradientStops } from './colors';
import { getEffects } from './effects';
import { getLayout } from './layout';
import { getNotes } from './notes';
import { buildCssSnippet, buildTailwindSnippet } from './snippet';
import { matchColorToken, matchLengthToken, matchShadowToken } from './tokens';
import { getTypography } from './typography';
import { breadcrumb, shortestUniqueSelector } from '../util/selector';
import { roundCssPx } from '../util/units';

export function buildElementSpec(
  el: Element,
  tokens: TokenMaps,
  remBase: number | 'auto' = 'auto',
): ElementSpec {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const box = getBoxModel(el);
  const typography = getTypography(el, remBase);
  const effects = getEffects(el);
  const layout = getLayout(el);
  const notes = getNotes(el);

  const colorProps = [
    'color',
    'backgroundColor',
    'borderColor',
    'outlineColor',
    'fill',
    'stroke',
  ] as const;

  const colors: ElementSpec['colors'] = {};
  for (const prop of colorProps) {
    const raw = (style as any)[prop] as string;
    if (!raw || raw === 'none' || raw === 'transparent') {
      colors[prop] = null;
      continue;
    }
    const formatted = formatColor(raw);
    const match = matchColorToken(raw, tokens);
    colors[prop] = { ...formatted, token: match.token, tokenMatch: match.match };
  }

  // Gradients
  const stops = parseGradientStops(style.backgroundImage);
  stops.forEach((stop, i) => {
    const formatted = formatColor(stop);
    const match = matchColorToken(stop, tokens);
    colors[`gradient${i}`] = { ...formatted, token: match.token, tokenMatch: match.match };
  });

  if (typography) {
    const match = matchColorToken(style.color, tokens);
    typography.color = { ...typography.color, token: match.token, tokenMatch: match.match };
  }

  const tokenHits: Record<string, string> = {};
  const bg = colors.backgroundColor;
  if (bg?.token) tokenHits['background'] = bg.token;
  if (typography?.color.token) tokenHits['color'] = typography.color.token;
  const radiusTok = matchLengthToken(style.borderRadius.split(' ')[0] ?? '', tokens);
  if (radiusTok) tokenHits['border-radius'] = radiusTok;
  // Also try matching known token values via computed
  for (const [name, value] of Object.entries(tokens.all)) {
    if (value === style.backgroundColor || formatColor(style.backgroundColor).hex === formatColor(value).hex) {
      if (name.includes('color') || name.includes('primary') || name.includes('bg')) {
        tokenHits['background'] = name;
        if (bg) {
          bg.token = name;
          bg.tokenMatch = 'exact';
        }
      }
    }
    if (value === style.borderRadius || value === (style.borderRadius.split(' ')[0] ?? '')) {
      tokenHits['border-radius'] = name;
    }
    if (style.boxShadow !== 'none' && value === style.boxShadow) {
      tokenHits['box-shadow'] = name;
    }
  }
  const shadowTok = matchShadowToken(style.boxShadow, tokens);
  if (shadowTok) tokenHits['box-shadow'] = shadowTok;

  const pageX = roundCssPx(rect.left + window.scrollX);
  const pageY = roundCssPx(rect.top + window.scrollY);

  const spec: ElementSpec = {
    selector: shortestUniqueSelector(el),
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    breadcrumb: breadcrumb(el),
    rect: {
      x: roundCssPx(rect.left),
      y: roundCssPx(rect.top),
      width: roundCssPx(rect.width),
      height: roundCssPx(rect.height),
      pageX,
      pageY,
    },
    box,
    typography,
    colors,
    effects,
    layout,
    notes,
    tokens: tokenHits,
    cssSnippet: '',
    tailwindSnippet: '',
    notRendered: rect.width === 0 && rect.height === 0,
  };

  spec.cssSnippet = buildCssSnippet(spec);
  spec.tailwindSnippet = buildTailwindSnippet(spec);
  return spec;
}
