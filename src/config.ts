import type { RedlineConfig } from './types';

export const DEFAULT_BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export const DEFAULT_CONFIG: Required<
  Omit<RedlineConfig, 'onSelect' | 'tokenPrefixes' | 'breakpoints' | 'ignore' | 'assets'>
> & {
  tokenPrefixes: string[] | undefined;
  breakpoints: Record<string, number> | undefined;
  ignore: string[];
  assets: Required<NonNullable<RedlineConfig['assets']>>;
  onSelect: RedlineConfig['onSelect'];
} = {
  enabled: true,
  startActive: false,
  shortcut: 'Alt+Shift+R',
  showFab: true,
  fabPosition: 'bottom-right',
  panelSide: 'right',
  theme: 'auto',
  units: 'both',
  remBase: 'auto',
  tailwind: true,
  tokenPrefixes: undefined,
  breakpoints: undefined,
  ignore: [],
  assets: {
    includeFonts: true,
    includeFavicons: true,
    sameOriginOnly: false,
    jszipUrl: 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
    zipName: '',
    renderIconGlyphs: true,
    inlineCurrentColor: false,
  },
  onSelect: undefined,
};

export function mergeConfig(partial?: RedlineConfig): typeof DEFAULT_CONFIG {
  const assets = { ...DEFAULT_CONFIG.assets, ...(partial?.assets ?? {}) };
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    ignore: partial?.ignore ?? [],
    assets,
  };
}

export function configFromScript(script: HTMLScriptElement | null): RedlineConfig {
  const fromWindow = typeof window !== 'undefined' ? window.REDLINE_CONFIG ?? {} : {};
  if (!script) return { ...fromWindow };

  const dataConfig = script.getAttribute('data-config');
  let parsed: RedlineConfig = {};
  if (dataConfig) {
    try {
      parsed = JSON.parse(dataConfig) as RedlineConfig;
    } catch {
      /* ignore */
    }
  }

  const bool = (v: string | null): boolean | undefined =>
    v == null ? undefined : v === '' || v === 'true' || v === '1';

  const attrs: RedlineConfig = {
    shortcut: script.getAttribute('data-shortcut') ?? undefined,
    startActive: bool(script.getAttribute('data-start-active')),
    showFab: bool(script.getAttribute('data-show-fab')),
    theme: (script.getAttribute('data-theme') as RedlineConfig['theme']) ?? undefined,
    units: (script.getAttribute('data-units') as RedlineConfig['units']) ?? undefined,
    panelSide: (script.getAttribute('data-panel-side') as RedlineConfig['panelSide']) ?? undefined,
    tailwind: bool(script.getAttribute('data-tailwind')),
  };

  return { ...fromWindow, ...parsed, ...stripUndefined(attrs as Record<string, unknown>) };
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function configFromUrl(): Partial<RedlineConfig> | null {
  if (typeof location === 'undefined') return null;
  const params = new URLSearchParams(location.search);
  if (!params.has('redline')) return null;
  const v = params.get('redline');
  if (v === '0' || v === 'false') return { enabled: false };
  if (v === '1' || v === 'true' || v === '') return { startActive: true };
  return null;
}
