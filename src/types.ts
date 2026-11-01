export type UnitsMode = 'px' | 'rem' | 'both';
export type ThemeMode = 'dark' | 'light' | 'auto';
export type FabPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type PanelSide = 'right' | 'left';
export type PanelMode = 'push' | 'overlay';
export type ForceState = 'hover' | 'focus' | 'focus-visible' | 'active' | 'disabled' | 'checked';

export interface AssetsConfig {
  includeFonts?: boolean;
  includeFavicons?: boolean;
  sameOriginOnly?: boolean;
  jszipUrl?: string;
  zipName?: string;
  renderIconGlyphs?: boolean;
  inlineCurrentColor?: boolean;
}

export interface RedlineConfig {
  enabled?: boolean;
  startActive?: boolean;
  shortcut?: string;
  showFab?: boolean;
  fabPosition?: FabPosition;
  panelSide?: PanelSide;
  /** Docked panel: push page content aside (default) or overlay it. */
  panelMode?: PanelMode;
  theme?: ThemeMode;
  units?: UnitsMode;
  remBase?: number | 'auto';
  tailwind?: boolean;
  tokenPrefixes?: string[];
  breakpoints?: Record<string, number>;
  ignore?: string[];
  assets?: AssetsConfig;
  onSelect?: (info: ElementSpec) => void;
}

export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxModel {
  content: { width: number; height: number };
  padding: BoxSides;
  border: BoxSides;
  margin: BoxSides;
  boxSizing: string;
}

export interface ColorValue {
  css: string;
  hex: string;
  rgb: string;
  hsl: string;
  alpha: number;
  token?: string;
  tokenMatch?: 'exact' | 'nearest';
}

export interface TypographySpec {
  fontFamily: string;
  renderedFont: string | null;
  fontSize: { px: number; rem: number };
  fontWeight: { value: number; name: string };
  lineHeight: { px: number; unitless: number };
  letterSpacing: { px: number; em: number };
  textTransform: string;
  textAlign: string;
  textDecoration: string;
  whiteSpace: string;
  fontStyle: string;
  lineClamp: string | null;
  color: ColorValue;
  contrast: { ratio: number; aa: boolean; aaa: boolean; bg: string };
}

export interface EffectsSpec {
  borderRadius: string;
  boxShadow: string[];
  opacity: number;
  filter: string;
  backdropFilter: string;
  transform: string;
  mixBlendMode: string;
  transformed: boolean;
  transformMatrix?: string;
  scaleFactor?: number;
  layoutSize?: { width: number; height: number };
  renderedSize?: { width: number; height: number };
}

export interface LayoutSpec {
  display: string;
  position: string;
  inset: BoxSides;
  zIndex: string;
  overflow: string;
  flex?: {
    direction: string;
    wrap: string;
    justify: string;
    alignItems: string;
    gap: { row: number; column: number };
    grow?: string;
    shrink?: string;
    basis?: string;
  };
  grid?: {
    templateColumns: string;
    templateRows: string;
    gap: { row: number; column: number };
    areas: string;
    resolvedColumns: number[];
  };
  childSpacing?: number[];
}

export interface NotesSpec {
  spec?: string;
  state?: string;
  behavior?: string;
  a11y?: string;
  link?: string;
}

export interface ElementSpec {
  selector: string;
  tag: string;
  id: string | null;
  classes: string[];
  role: string | null;
  ariaLabel: string | null;
  breadcrumb: string[];
  rect: { x: number; y: number; width: number; height: number; pageX: number; pageY: number };
  box: BoxModel;
  typography: TypographySpec | null;
  colors: Record<string, ColorValue | null>;
  effects: EffectsSpec;
  layout: LayoutSpec;
  notes: NotesSpec;
  tokens: Record<string, string>;
  cssSnippet: string;
  tailwindSnippet: string;
  notRendered?: boolean;
}

export interface RedlineInstance {
  toggle(force?: boolean): void;
  select(el: Element | string): void;
  getSpec(el: Element | string): ElementSpec;
  exportAssets(): Promise<Blob>;
  exportReport(format: 'json' | 'html'): Promise<Blob>;
  destroy(): void;
}

export interface TokenMaps {
  colors: Map<string, string[]>;
  lengths: Map<string, string[]>;
  shadows: Map<string, string[]>;
  all: Record<string, string>;
}

declare global {
  interface Window {
    REDLINE_CONFIG?: RedlineConfig;
    redline?: RedlineInstance;
  }
}
