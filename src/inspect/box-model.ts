import type { BoxModel, BoxSides } from '../types';
import { parseLengthPx, roundCssPx } from '../util/units';

function sides(style: CSSStyleDeclaration, prefix: 'padding' | 'margin' | 'border'): BoxSides {
  if (prefix === 'border') {
    return {
      top: roundCssPx(parseLengthPx(style.borderTopWidth)),
      right: roundCssPx(parseLengthPx(style.borderRightWidth)),
      bottom: roundCssPx(parseLengthPx(style.borderBottomWidth)),
      left: roundCssPx(parseLengthPx(style.borderLeftWidth)),
    };
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    top: roundCssPx(parseLengthPx((style as any)[`${prefix}${cap('top')}`])),
    right: roundCssPx(parseLengthPx((style as any)[`${prefix}${cap('right')}`])),
    bottom: roundCssPx(parseLengthPx((style as any)[`${prefix}${cap('bottom')}`])),
    left: roundCssPx(parseLengthPx((style as any)[`${prefix}${cap('left')}`])),
  };
}

export function getBoxModel(el: Element): BoxModel {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const padding = sides(style, 'padding');
  const border = sides(style, 'border');
  const margin = sides(style, 'margin');
  const contentW = Math.max(
    0,
    roundCssPx(rect.width - padding.left - padding.right - border.left - border.right),
  );
  const contentH = Math.max(
    0,
    roundCssPx(rect.height - padding.top - padding.bottom - border.top - border.bottom),
  );
  return {
    content: { width: contentW, height: contentH },
    padding,
    border,
    margin,
    boxSizing: style.boxSizing,
  };
}
