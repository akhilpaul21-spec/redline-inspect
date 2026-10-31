import type { LayoutSpec } from '../types';
import { parseLengthPx, roundCssPx } from '../util/units';

export function getLayout(el: Element): LayoutSpec {
  const style = getComputedStyle(el);
  const inset = {
    top: parseLengthPx(style.top),
    right: parseLengthPx(style.right),
    bottom: parseLengthPx(style.bottom),
    left: parseLengthPx(style.left),
  };

  const layout: LayoutSpec = {
    display: style.display,
    position: style.position,
    inset,
    zIndex: style.zIndex,
    overflow: `${style.overflowX}${style.overflowY !== style.overflowX ? ` / ${style.overflowY}` : ''}`,
  };

  if (style.display.includes('flex')) {
    layout.flex = {
      direction: style.flexDirection,
      wrap: style.flexWrap,
      justify: style.justifyContent,
      alignItems: style.alignItems,
      gap: {
        row: roundCssPx(parseLengthPx(style.rowGap || style.gap)),
        column: roundCssPx(parseLengthPx(style.columnGap || style.gap)),
      },
      grow: style.flexGrow,
      shrink: style.flexShrink,
      basis: style.flexBasis,
    };
  }

  if (style.display.includes('grid')) {
    const cols = style.gridTemplateColumns;
    const resolvedColumns = cols
      .split(/\s+/)
      .map((p) => parseLengthPx(p))
      .filter((n) => n > 0)
      .map(roundCssPx);
    layout.grid = {
      templateColumns: cols,
      templateRows: style.gridTemplateRows,
      gap: {
        row: roundCssPx(parseLengthPx(style.rowGap || style.gap)),
        column: roundCssPx(parseLengthPx(style.columnGap || style.gap)),
      },
      areas: style.gridTemplateAreas,
      resolvedColumns,
    };
  }

  // Child spacing for consecutive children
  const children = Array.from(el.children).filter((c) => {
    const s = getComputedStyle(c);
    return s.display !== 'none';
  }) as Element[];
  if (children.length >= 2) {
    const gaps: number[] = [];
    for (let i = 0; i < children.length - 1; i++) {
      const a = children[i]!.getBoundingClientRect();
      const b = children[i + 1]!.getBoundingClientRect();
      const sameRow = Math.abs(a.top - b.top) < Math.max(a.height, b.height) / 2;
      gaps.push(roundCssPx(sameRow ? b.left - a.right : b.top - a.bottom));
    }
    layout.childSpacing = gaps;
  }

  return layout;
}
