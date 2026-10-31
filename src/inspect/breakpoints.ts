import { DEFAULT_BREAKPOINTS } from '../config';

export interface BreakpointInfo {
  name: string;
  min: number;
  current: boolean;
}

export function extractBreakpoints(override?: Record<string, number>): BreakpointInfo[] {
  const widths = new Set<number>();
  if (override) {
    for (const v of Object.values(override)) widths.add(v);
  } else {
    for (const v of Object.values(DEFAULT_BREAKPOINTS)) widths.add(v);
  }

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectMedia(sheet.cssRules, widths);
    } catch {
      /* ignore */
    }
  }

  const named = override ?? DEFAULT_BREAKPOINTS;
  const nameOf = (w: number): string => {
    for (const [k, v] of Object.entries(named)) if (v === w) return k;
    return `≥ ${w}px`;
  };

  const sorted = Array.from(widths).sort((a, b) => a - b);
  const vw = window.innerWidth;
  return sorted.map((min) => ({
    name: nameOf(min),
    min,
    current: false,
  })).map((bp, i, arr) => {
    const next = arr[i + 1]?.min ?? Infinity;
    return { ...bp, current: vw >= bp.min && vw < next };
  });
}

function collectMedia(rules: CSSRuleList | undefined, widths: Set<number>): void {
  if (!rules) return;
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      const m = rule.conditionText || rule.media.mediaText;
      for (const match of m.matchAll(/\(min-width:\s*([\d.]+)px\)/g)) {
        widths.add(Math.round(parseFloat(match[1]!)));
      }
      for (const match of m.matchAll(/\(max-width:\s*([\d.]+)px\)/g)) {
        widths.add(Math.round(parseFloat(match[1]!)) + 1);
      }
      collectMedia(rule.cssRules, widths);
    } else if (
      rule instanceof CSSSupportsRule ||
      (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule)
    ) {
      collectMedia((rule as CSSGroupingRule).cssRules, widths);
    }
  }
}

export function currentBreakpointLabel(
  override?: Record<string, number>,
): string {
  const vw = window.innerWidth;
  const named = override ?? DEFAULT_BREAKPOINTS;
  const entries = Object.entries(named).sort((a, b) => a[1] - b[1]);
  let label = `< ${entries[0]?.[0] ?? 'sm'}`;
  for (const [name, min] of entries) {
    if (vw >= min) label = name;
  }
  // Spec: at 375 show `< sm`, at 1280 show `xl`
  if (vw < (entries[0]?.[1] ?? 640)) return `< ${entries[0]?.[0] ?? 'sm'}`;
  return label;
}

export function viewportInfo(override?: Record<string, number>) {
  const dpr = window.devicePixelRatio || 1;
  let zoom = 1;
  try {
    zoom = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
  } catch {
    zoom = 1;
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr,
    zoom,
    breakpoint: currentBreakpointLabel(override),
    zoomWarn: Math.abs(zoom - 1) > 0.05,
  };
}
