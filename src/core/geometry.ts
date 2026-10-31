import { parseLengthPx, roundCssPx } from '../util/units';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function toRect(r: DOMRect | DOMRectReadOnly): Rect {
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
  };
}

export function getElementRects(el: Element): Rect[] {
  const clientRects = el.getClientRects();
  if (clientRects.length > 1) {
    return Array.from(clientRects).map(toRect);
  }
  return [toRect(el.getBoundingClientRect())];
}

export function getContentBox(el: Element): Rect {
  const style = getComputedStyle(el);
  const border = {
    top: parseLengthPx(style.borderTopWidth),
    right: parseLengthPx(style.borderRightWidth),
    bottom: parseLengthPx(style.borderBottomWidth),
    left: parseLengthPx(style.borderLeftWidth),
  };
  const padding = {
    top: parseLengthPx(style.paddingTop),
    right: parseLengthPx(style.paddingRight),
    bottom: parseLengthPx(style.paddingBottom),
    left: parseLengthPx(style.paddingLeft),
  };
  const r = el.getBoundingClientRect();
  return {
    x: r.left + border.left + padding.left,
    y: r.top + border.top + padding.top,
    left: r.left + border.left + padding.left,
    top: r.top + border.top + padding.top,
    width: Math.max(0, r.width - border.left - border.right - padding.left - padding.right),
    height: Math.max(0, r.height - border.top - border.bottom - padding.top - padding.bottom),
    right: r.right - border.right - padding.right,
    bottom: r.bottom - border.bottom - padding.bottom,
  };
}

export function nearestBlockAncestor(el: Element): Element | null {
  let cur = el.parentElement;
  while (cur) {
    const d = getComputedStyle(cur).display;
    if (d !== 'inline' && d !== 'contents') return cur;
    cur = cur.parentElement;
  }
  return document.documentElement;
}

export function parentSpacing(el: Element): { top: number; right: number; bottom: number; left: number; parent: Element | null } {
  const parent = (el as HTMLElement).offsetParent instanceof Element
    ? ((el as HTMLElement).offsetParent as Element)
    : nearestBlockAncestor(el);
  if (!parent) return { top: 0, right: 0, bottom: 0, left: 0, parent: null };
  const borderBox = el.getBoundingClientRect();
  const content = getContentBox(parent);
  return {
    top: roundCssPx(borderBox.top - content.top),
    right: roundCssPx(content.right - borderBox.right),
    bottom: roundCssPx(content.bottom - borderBox.bottom),
    left: roundCssPx(borderBox.left - content.left),
    parent,
  };
}

export type DistanceKind = 'gap' | 'inset' | 'overlap';

export interface DistanceResult {
  kind: DistanceKind;
  horizontal?: number;
  vertical?: number;
  inset?: { top: number; right: number; bottom: number; left: number };
  edge?: { top: number; right: number; bottom: number; left: number };
}

export function distancesBetween(a: Element, b: Element): DistanceResult {
  const A = a.getBoundingClientRect();
  const B = b.getBoundingClientRect();
  const aInsideB = A.left >= B.left && A.right <= B.right && A.top >= B.top && A.bottom <= B.bottom;
  const bInsideA = B.left >= A.left && B.right <= A.right && B.top >= A.top && B.bottom <= A.bottom;

  if (aInsideB || bInsideA) {
    const outer = aInsideB ? B : A;
    const inner = aInsideB ? A : B;
    return {
      kind: 'inset',
      inset: {
        top: roundCssPx(inner.top - outer.top),
        right: roundCssPx(outer.right - inner.right),
        bottom: roundCssPx(outer.bottom - inner.bottom),
        left: roundCssPx(inner.left - outer.left),
      },
    };
  }

  const overlapX = !(A.right <= B.left || B.right <= A.left);
  const overlapY = !(A.bottom <= B.top || B.bottom <= A.top);

  if (overlapX && overlapY) {
    return {
      kind: 'overlap',
      edge: {
        top: roundCssPx(A.top - B.top),
        right: roundCssPx(A.right - B.right),
        bottom: roundCssPx(A.bottom - B.bottom),
        left: roundCssPx(A.left - B.left),
      },
    };
  }

  let horizontal: number | undefined;
  let vertical: number | undefined;
  if (!overlapX) {
    horizontal = A.right < B.left ? roundCssPx(B.left - A.right) : roundCssPx(A.left - B.right);
  }
  if (!overlapY) {
    vertical = A.bottom < B.top ? roundCssPx(B.top - A.bottom) : roundCssPx(A.top - B.bottom);
  }
  return { kind: 'gap', horizontal, vertical };
}

export function getTransformInfo(el: Element): {
  transformed: boolean;
  matrix: string;
  scale: number;
  layout: { width: number; height: number };
  rendered: { width: number; height: number };
} {
  const style = getComputedStyle(el);
  const t = style.transform;
  const rect = el.getBoundingClientRect();
  const layoutW = (el as HTMLElement).offsetWidth || rect.width;
  const layoutH = (el as HTMLElement).offsetHeight || rect.height;
  let scale = 1;
  const transformed = !!(t && t !== 'none');
  if (transformed && t.startsWith('matrix')) {
    const nums = t.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    if (nums.length >= 4) {
      const a = nums[0] ?? 1;
      const b = nums[1] ?? 0;
      scale = Math.sqrt(a * a + b * b) || 1;
    }
  }
  return {
    transformed,
    matrix: t && t !== 'none' ? t : '',
    scale,
    layout: { width: layoutW, height: layoutH },
    rendered: { width: rect.width, height: rect.height },
  };
}

export function clipRectToScrollParent(el: Element, rect: Rect): { clipped: Rect; clippedFlag: boolean } {
  let cur: Element | null = el.parentElement;
  let clip: Rect | null = null;
  while (cur && cur !== document.documentElement) {
    const style = getComputedStyle(cur);
    const ox = style.overflowX;
    const oy = style.overflowY;
    if (/(auto|scroll|hidden)/.test(ox) || /(auto|scroll|hidden)/.test(oy)) {
      clip = toRect(cur.getBoundingClientRect());
      break;
    }
    cur = cur.parentElement;
  }
  if (!clip) return { clipped: rect, clippedFlag: false };
  const left = Math.max(rect.left, clip.left);
  const top = Math.max(rect.top, clip.top);
  const right = Math.min(rect.right, clip.right);
  const bottom = Math.min(rect.bottom, clip.bottom);
  const clippedFlag = left > rect.left || top > rect.top || right < rect.right || bottom < rect.bottom;
  return {
    clipped: {
      x: left,
      y: top,
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    },
    clippedFlag,
  };
}
