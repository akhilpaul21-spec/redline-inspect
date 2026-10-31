import type { ElementSpec } from '../types';
import { formatPx } from '../util/units';

const SPACING: Record<number, string> = {
  0: '0',
  1: 'px',
  2: '0.5',
  4: '1',
  6: '1.5',
  8: '2',
  10: '2.5',
  12: '3',
  14: '3.5',
  16: '4',
  20: '5',
  24: '6',
  28: '7',
  32: '8',
  36: '9',
  40: '10',
  44: '11',
  48: '12',
  56: '14',
  64: '16',
};

const FONT_SIZE: Record<number, string> = {
  12: 'xs',
  14: 'sm',
  16: 'base',
  18: 'lg',
  20: 'xl',
  24: '2xl',
  30: '3xl',
  36: '4xl',
  48: '5xl',
};

const FONT_WEIGHT: Record<number, string> = {
  100: 'thin',
  200: 'extralight',
  300: 'light',
  400: 'normal',
  500: 'medium',
  600: 'semibold',
  700: 'bold',
  800: 'extrabold',
  900: 'black',
};

const LEADING: Record<number, string> = {
  1: 'none',
  1.25: 'tight',
  1.375: 'snug',
  1.5: 'normal',
  1.625: 'relaxed',
  2: 'loose',
};

function spaceClass(prefix: string, px: number): string | null {
  if (px === 0) return null;
  const key = SPACING[px];
  if (key != null) return `${prefix}-${key}`;
  return `${prefix}-[${formatPx(px)}px]`;
}

export function buildCssSnippet(spec: ElementSpec): string {
  const lines: string[] = [];
  const b = spec.box;
  lines.push(`/* ${spec.selector} */`);
  lines.push(`width: ${formatPx(b.content.width + b.padding.left + b.padding.right + b.border.left + b.border.right)}px;`);
  lines.push(`height: ${formatPx(b.content.height + b.padding.top + b.padding.bottom + b.border.top + b.border.bottom)}px;`);
  if (b.boxSizing !== 'content-box') lines.push(`box-sizing: ${b.boxSizing};`);

  const pad = b.padding;
  if (pad.top || pad.right || pad.bottom || pad.left) {
    if (pad.top === pad.bottom && pad.left === pad.right && pad.top === pad.left) {
      const tok = spec.tokens['padding'];
      lines.push(`padding: ${tok ? `var(${tok}) /* ${formatPx(pad.top)}px */` : `${formatPx(pad.top)}px`};`);
    } else if (pad.top === pad.bottom && pad.left === pad.right) {
      lines.push(`padding: ${formatPx(pad.top)}px ${formatPx(pad.left)}px;`);
    } else {
      lines.push(`padding: ${formatPx(pad.top)}px ${formatPx(pad.right)}px ${formatPx(pad.bottom)}px ${formatPx(pad.left)}px;`);
    }
  }

  const mar = b.margin;
  if (mar.top || mar.right || mar.bottom || mar.left) {
    lines.push(`margin: ${formatPx(mar.top)}px ${formatPx(mar.right)}px ${formatPx(mar.bottom)}px ${formatPx(mar.left)}px;`);
  }

  if (spec.typography) {
    const t = spec.typography;
    lines.push(`font-family: ${t.fontFamily};`);
    lines.push(`font-size: ${formatPx(t.fontSize.px)}px;`);
    lines.push(`font-weight: ${t.fontWeight.value};`);
    lines.push(`line-height: ${t.lineHeight.unitless};`);
    if (t.letterSpacing.px) lines.push(`letter-spacing: ${t.letterSpacing.em}em;`);
    const colorTok = t.color.token;
    lines.push(`color: ${colorTok ? `var(${colorTok}) /* ${t.color.hex} */` : t.color.hex};`);
  }

  const bg = spec.colors.backgroundColor;
  if (bg && bg.alpha > 0) {
    lines.push(`background: ${bg.token ? `var(${bg.token}) /* ${bg.hex} */` : bg.hex};`);
  }

  if (spec.effects.borderRadius && spec.effects.borderRadius !== '0px') {
    const tok = spec.tokens['border-radius'];
    lines.push(
      `border-radius: ${tok ? `var(${tok}) /* ${spec.effects.borderRadius} */` : spec.effects.borderRadius};`,
    );
  }
  if (spec.effects.boxShadow.length) {
    const tok = spec.tokens['box-shadow'];
    lines.push(
      `box-shadow: ${tok ? `var(${tok}) /* ${spec.effects.boxShadow.join(', ')} */` : spec.effects.boxShadow.join(', ')};`,
    );
  }
  if (spec.effects.opacity < 1) lines.push(`opacity: ${spec.effects.opacity};`);

  const L = spec.layout;
  if (L.display !== 'block' && L.display !== 'inline') lines.push(`display: ${L.display};`);
  if (L.flex) {
    lines.push(`flex-direction: ${L.flex.direction};`);
    if (L.flex.gap.row || L.flex.gap.column) {
      lines.push(`gap: ${formatPx(L.flex.gap.row)}px${L.flex.gap.row !== L.flex.gap.column ? ` ${formatPx(L.flex.gap.column)}px` : ''};`);
    }
    if (L.flex.justify !== 'normal' && L.flex.justify !== 'flex-start') lines.push(`justify-content: ${L.flex.justify};`);
    if (L.flex.alignItems !== 'normal' && L.flex.alignItems !== 'stretch') lines.push(`align-items: ${L.flex.alignItems};`);
  }
  if (L.grid) {
    lines.push(`grid-template-columns: ${L.grid.templateColumns};`);
    if (L.grid.gap.row || L.grid.gap.column) {
      lines.push(`gap: ${formatPx(L.grid.gap.row)}px;`);
    }
  }

  return lines.join('\n');
}

export function buildTailwindSnippet(spec: ElementSpec): string {
  const cls: string[] = [];
  const b = spec.box;
  const p = b.padding;
  if (p.top === p.bottom && p.left === p.right && p.top === p.left && p.top) {
    const c = spaceClass('p', p.top);
    if (c) cls.push(c);
  } else {
    if (p.top === p.bottom && p.top) {
      const c = spaceClass('py', p.top);
      if (c) cls.push(c);
    } else {
      const t = spaceClass('pt', p.top);
      const bt = spaceClass('pb', p.bottom);
      if (t) cls.push(t);
      if (bt) cls.push(bt);
    }
    if (p.left === p.right && p.left) {
      const c = spaceClass('px', p.left);
      if (c) cls.push(c);
    } else {
      const l = spaceClass('pl', p.left);
      const r = spaceClass('pr', p.right);
      if (l) cls.push(l);
      if (r) cls.push(r);
    }
  }

  const m = b.margin;
  if (m.left) {
    const c = spaceClass('ml', m.left);
    if (c) cls.push(c);
  }
  if (m.top) {
    const c = spaceClass('mt', m.top);
    if (c) cls.push(c);
  }

  if (spec.typography) {
    const t = spec.typography;
    const fs = FONT_SIZE[t.fontSize.px];
    cls.push(fs ? `text-${fs}` : `text-[${formatPx(t.fontSize.px)}px]`);
    const fw = FONT_WEIGHT[t.fontWeight.value];
    if (fw && fw !== 'normal') cls.push(`font-${fw}`);
    const lead = LEADING[t.lineHeight.unitless];
    if (lead) cls.push(`leading-${lead}`);
    else cls.push(`leading-[${t.lineHeight.unitless}]`);
    if (t.letterSpacing.em) {
      if (Math.abs(t.letterSpacing.em - -0.025) < 0.005) cls.push('tracking-tight');
      else if (Math.abs(t.letterSpacing.em - -0.01) < 0.005) cls.push('tracking-tight');
      else cls.push(`tracking-[${t.letterSpacing.em}em]`);
    }
    cls.push(`text-[${t.color.hex}]`);
  }

  const bg = spec.colors.backgroundColor;
  if (bg && bg.alpha > 0) cls.push(`bg-[${bg.hex}]`);

  const radius = spec.effects.borderRadius;
  if (radius && radius !== '0px') {
    const px = parseFloat(radius);
    if (px === 8) cls.push('rounded-lg');
    else if (px === 12) cls.push('rounded-xl');
    else if (px === 4) cls.push('rounded');
    else if (px === 9999 || radius.includes('%')) cls.push('rounded-full');
    else cls.push(`rounded-[${radius}]`);
  }

  if (spec.effects.boxShadow.length) cls.push('shadow-md');

  const L = spec.layout;
  if (L.display.includes('flex')) {
    cls.push('flex');
    if (L.flex) {
      if (L.flex.alignItems === 'center') cls.push('items-center');
      if (L.flex.justify === 'center') cls.push('justify-center');
      const g = L.flex.gap.row || L.flex.gap.column;
      if (g) {
        const c = spaceClass('gap', g);
        if (c) cls.push(c);
      }
    }
  }
  if (L.display.includes('grid')) {
    cls.push('grid');
    if (L.grid) {
      const n = L.grid.resolvedColumns.length;
      if (n) cls.push(`grid-cols-${n}`);
      const g = L.grid.gap.row || L.grid.gap.column;
      if (g) {
        const c = spaceClass('gap', g);
        if (c) cls.push(c);
      }
    }
  }

  return cls.join(' ');
}

export { SPACING, FONT_SIZE, FONT_WEIGHT };
