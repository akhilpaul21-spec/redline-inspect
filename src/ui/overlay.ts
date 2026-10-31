import { h, clear } from './h';
import { getBoxModel } from '../inspect/box-model';
import { distancesBetween, getElementRects, parentSpacing, clipRectToScrollParent, toRect } from '../core/geometry';
import { formatLength, formatPx } from '../util/units';
import { hasNotes } from '../inspect/notes';
import type { UnitsMode } from '../types';
import { isCrossOriginIframe } from '../core/hit-test';

export interface OverlayState {
  selected: Element | null;
  hovered: Element | null;
  pinned: Element[];
  altHover: boolean;
  units: UnitsMode;
  remBase: number | 'auto';
  showNotes: boolean;
  active: boolean;
}

export function createOverlay(layer: HTMLElement) {
  const boxLayer = h('div', { class: 'rl-boxes' });
  const hoverLayer = h('div', { class: 'rl-hover' });
  const measureLayer = h('div', { class: 'rl-measure' });
  const notesLayer = h('div', { class: 'rl-notes-dots' });
  layer.append(boxLayer, hoverLayer, measureLayer, notesLayer);

  function render(state: OverlayState): void {
    clear(boxLayer);
    clear(hoverLayer);
    clear(measureLayer);
    clear(notesLayer);
    if (!state.active) return;

    if (state.hovered && state.hovered !== state.selected) {
      drawHover(hoverLayer, state.hovered, state.altHover);
    }

    if (state.selected) {
      drawBoxModel(boxLayer, state.selected, state.units, state.remBase);
      drawParentSpacing(measureLayer, state.selected, state.units, state.remBase);
      if (state.altHover && state.hovered && state.hovered !== state.selected) {
        drawDistances(measureLayer, state.selected, state.hovered, state.units, state.remBase);
      }
    }

    for (const pin of state.pinned) {
      if (pin !== state.selected) drawBoxModel(boxLayer, pin, state.units, state.remBase, true);
    }

    if (state.showNotes) {
      document.querySelectorAll('[data-spec],[data-spec-state],[data-spec-behavior],[data-spec-a11y],[data-spec-link]').forEach((el) => {
        if (!hasNotes(el)) return;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        notesLayer.appendChild(
          h('div', {
            class: 'rl-note-dot',
            style: { left: `${r.right - 4}px`, top: `${r.top - 4}px` },
          }),
        );
      });
    }
  }

  return { render };
}

function drawHover(layer: HTMLElement, el: Element, dashed: boolean): void {
  if (isCrossOriginIframe(el)) {
    const r = el.getBoundingClientRect();
    layer.appendChild(
      h('div', {
        class: `rl-hover-outline${dashed ? ' rl-dashed' : ''}`,
        style: rectStyle(r),
      }),
    );
    layer.appendChild(
      h('div', {
        class: 'rl-hover-tag',
        style: { left: `${r.left}px`, top: `${Math.max(0, r.top - 18)}px` },
        text: 'cross-origin iframe – load redline inside it',
      }),
    );
    return;
  }
  const rects = getElementRects(el);
  for (const r of rects) {
    layer.appendChild(
      h('div', {
        class: `rl-hover-outline${dashed ? ' rl-dashed' : ''}`,
        style: rectStyle(r),
      }),
    );
  }
  const r = rects[0]!;
  const tag = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : el.classList[0] ? `.${el.classList[0]}` : ''} ${formatPx(r.width)}×${formatPx(r.height)}`;
  layer.appendChild(
    h('div', {
      class: 'rl-hover-tag',
      style: { left: `${r.left}px`, top: `${Math.max(0, r.top - 18)}px` },
      text: tag,
    }),
  );
}

function drawBoxModel(
  layer: HTMLElement,
  el: Element,
  units: UnitsMode,
  remBase: number | 'auto',
  muted = false,
): void {
  const rects = getElementRects(el);
  const box = getBoxModel(el);
  const opacity = muted ? '0.45' : '1';

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    const { clipped, clippedFlag } = clipRectToScrollParent(el, r);
    if (clipped.width <= 0 || clipped.height <= 0) continue;

    const margin = box.margin;
    const border = box.border;
    const padding = box.padding;

    // Margin box
    layer.appendChild(
      h('div', {
        class: 'rl-box',
        style: {
          ...rectStyle({
            left: clipped.left - margin.left,
            top: clipped.top - margin.top,
            width: clipped.width + margin.left + margin.right,
            height: clipped.height + margin.top + margin.bottom,
          }),
          background: 'var(--rl-margin)',
          opacity,
        },
      }),
    );

    // Border box
    layer.appendChild(
      h('div', {
        class: 'rl-box',
        style: {
          ...rectStyle(clipped),
          background: 'var(--rl-border-box)',
          opacity,
        },
      }),
    );

    // Padding box
    layer.appendChild(
      h('div', {
        class: 'rl-box',
        style: {
          left: `${clipped.left + border.left}px`,
          top: `${clipped.top + border.top}px`,
          width: `${Math.max(0, clipped.width - border.left - border.right)}px`,
          height: `${Math.max(0, clipped.height - border.top - border.bottom)}px`,
          background: 'var(--rl-padding)',
          opacity,
        },
      }),
    );

    // Content
    layer.appendChild(
      h('div', {
        class: 'rl-box',
        style: {
          left: `${clipped.left + border.left + padding.left}px`,
          top: `${clipped.top + border.top + padding.top}px`,
          width: `${Math.max(0, clipped.width - border.left - border.right - padding.left - padding.right)}px`,
          height: `${Math.max(0, clipped.height - border.top - border.bottom - padding.top - padding.bottom)}px`,
          background: 'var(--rl-content)',
          opacity,
        },
      }),
    );

    if (i === 0) {
      labelSides(layer, clipped, padding, 'padding', units, remBase);
      labelSides(
        layer,
        {
          left: clipped.left - margin.left,
          top: clipped.top - margin.top,
          width: clipped.width + margin.left + margin.right,
          height: clipped.height + margin.top + margin.bottom,
          right: clipped.right + margin.right,
          bottom: clipped.bottom + margin.bottom,
        },
        margin,
        'margin',
        units,
        remBase,
        clipped,
      );

      layer.appendChild(
        h('div', {
          class: 'rl-size-badge',
          style: {
            left: `${clipped.left + clipped.width / 2}px`,
            top: `${clipped.bottom + 4}px`,
            transform: 'translateX(-50%)',
          },
          text: `${formatPx(r.width)} × ${formatPx(r.height)}${clippedFlag ? '  ↕ clipped' : ''}`,
        }),
      );
    }
  }
}

function labelSides(
  layer: HTMLElement,
  outer: { left: number; top: number; width: number; height: number; right?: number; bottom?: number },
  sides: { top: number; right: number; bottom: number; left: number },
  kind: 'padding' | 'margin',
  units: UnitsMode,
  remBase: number | 'auto',
  innerForMargin?: { left: number; top: number; width: number; height: number },
): void {
  const place = (
    side: 'top' | 'right' | 'bottom' | 'left',
    value: number,
  ) => {
    if (!value) return;
    let x = 0;
    let y = 0;
    if (kind === 'padding') {
      if (side === 'top') {
        x = outer.left + outer.width / 2;
        y = outer.top + value / 2;
      } else if (side === 'bottom') {
        x = outer.left + outer.width / 2;
        y = outer.top + outer.height - value / 2;
      } else if (side === 'left') {
        x = outer.left + value / 2;
        y = outer.top + outer.height / 2;
      } else {
        x = outer.left + outer.width - value / 2;
        y = outer.top + outer.height / 2;
      }
    } else if (innerForMargin) {
      if (side === 'top') {
        x = innerForMargin.left + innerForMargin.width / 2;
        y = innerForMargin.top - value / 2;
      } else if (side === 'bottom') {
        x = innerForMargin.left + innerForMargin.width / 2;
        y = innerForMargin.top + innerForMargin.height + value / 2;
      } else if (side === 'left') {
        x = innerForMargin.left - value / 2;
        y = innerForMargin.top + innerForMargin.height / 2;
      } else {
        x = innerForMargin.left + innerForMargin.width + value / 2;
        y = innerForMargin.top + innerForMargin.height / 2;
      }
    }
    const text = value < 0 ? `-${formatLength(Math.abs(value), units, remBase)}` : formatLength(value, units === 'both' ? 'px' : units, remBase);
    const label = h('div', {
      class: 'rl-label',
      style: { left: `${x}px`, top: `${y}px` },
      text,
      title: units === 'both' ? formatLength(Math.abs(value), 'both', remBase) : text,
    });
    if (value < 0) label.style.background = '#7c2d12';
    layer.appendChild(label);
  };
  place('top', sides.top);
  place('right', sides.right);
  place('bottom', sides.bottom);
  place('left', sides.left);
}

function drawParentSpacing(
  layer: HTMLElement,
  el: Element,
  units: UnitsMode,
  remBase: number | 'auto',
): void {
  const spacing = parentSpacing(el);
  if (!spacing.parent) return;
  const r = el.getBoundingClientRect();
  const content = spacing.parent.getBoundingClientRect(); // approximate; lines use measured values
  const sides: Array<['top' | 'right' | 'bottom' | 'left', number]> = [
    ['top', spacing.top],
    ['right', spacing.right],
    ['bottom', spacing.bottom],
    ['left', spacing.left],
  ];
  for (const [side, value] of sides) {
    if (value <= 0) continue;
    if (side === 'top') {
      line(layer, r.left + r.width / 2, content.top, r.left + r.width / 2, r.top, value, units, remBase);
    } else if (side === 'bottom') {
      line(layer, r.left + r.width / 2, r.bottom, r.left + r.width / 2, content.bottom, value, units, remBase);
    } else if (side === 'left') {
      line(layer, content.left, r.top + r.height / 2, r.left, r.top + r.height / 2, value, units, remBase);
    } else {
      line(layer, r.right, r.top + r.height / 2, content.right, r.top + r.height / 2, value, units, remBase);
    }
  }
}

function drawDistances(
  layer: HTMLElement,
  a: Element,
  b: Element,
  units: UnitsMode,
  remBase: number | 'auto',
): void {
  const d = distancesBetween(a, b);
  const A = a.getBoundingClientRect();
  const B = b.getBoundingClientRect();
  if (d.kind === 'gap') {
    if (d.horizontal != null) {
      const y = (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2;
      const x1 = A.right < B.left ? A.right : B.right;
      const x2 = A.right < B.left ? B.left : A.left;
      line(layer, x1, y, x2, y, d.horizontal, units, remBase);
    }
    if (d.vertical != null) {
      const x = (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2;
      const y1 = A.bottom < B.top ? A.bottom : B.bottom;
      const y2 = A.bottom < B.top ? B.top : A.top;
      line(layer, x, y1, x, y2, d.vertical, units, remBase);
    }
  } else if (d.kind === 'inset' && d.inset) {
    const outer = A.left <= B.left && A.right >= B.right && A.top <= B.top && A.bottom >= B.bottom ? A : B;
    const inner = outer === A ? B : A;
    line(layer, inner.left + inner.width / 2, outer.top, inner.left + inner.width / 2, inner.top, d.inset.top, units, remBase);
    line(layer, inner.right, inner.top + inner.height / 2, outer.right, inner.top + inner.height / 2, d.inset.right, units, remBase);
    line(layer, inner.left + inner.width / 2, inner.bottom, inner.left + inner.width / 2, outer.bottom, d.inset.bottom, units, remBase);
    line(layer, outer.left, inner.top + inner.height / 2, inner.left, inner.top + inner.height / 2, d.inset.left, units, remBase);
  }
}

function line(
  layer: HTMLElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  value: number,
  units: UnitsMode,
  remBase: number | 'auto',
): void {
  const vertical = Math.abs(x1 - x2) < 0.5;
  if (vertical) {
    const top = Math.min(y1, y2);
    const height = Math.abs(y2 - y1);
    layer.appendChild(h('div', { class: 'rl-redline v', style: { left: `${x1}px`, top: `${top}px`, height: `${height}px` } }));
    layer.appendChild(h('div', { class: 'rl-tick', style: { left: `${x1 - 3}px`, top: `${top}px`, width: '7px', height: '1px' } }));
    layer.appendChild(h('div', { class: 'rl-tick', style: { left: `${x1 - 3}px`, top: `${top + height}px`, width: '7px', height: '1px' } }));
    layer.appendChild(
      h('div', {
        class: 'rl-label',
        style: { left: `${x1}px`, top: `${top + height / 2}px` },
        text: formatLength(value, units === 'both' ? 'px' : units, remBase),
      }),
    );
  } else {
    const left = Math.min(x1, x2);
    const width = Math.abs(x2 - x1);
    layer.appendChild(h('div', { class: 'rl-redline h', style: { left: `${left}px`, top: `${y1}px`, width: `${width}px` } }));
    layer.appendChild(h('div', { class: 'rl-tick', style: { left: `${left}px`, top: `${y1 - 3}px`, width: '1px', height: '7px' } }));
    layer.appendChild(h('div', { class: 'rl-tick', style: { left: `${left + width}px`, top: `${y1 - 3}px`, width: '1px', height: '7px' } }));
    layer.appendChild(
      h('div', {
        class: 'rl-label',
        style: { left: `${left + width / 2}px`, top: `${y1}px` },
        text: formatLength(value, units === 'both' ? 'px' : units, remBase),
      }),
    );
  }
}

function rectStyle(r: { left: number; top: number; width: number; height: number }): Record<string, string> {
  return {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${Math.max(0, r.width)}px`,
    height: `${Math.max(0, r.height)}px`,
  };
}

// silence unused
void toRect;
