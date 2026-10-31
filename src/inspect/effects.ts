import type { EffectsSpec } from '../types';
import { getTransformInfo } from '../core/geometry';

export function getEffects(el: Element): EffectsSpec {
  const style = getComputedStyle(el);
  const radius = style.borderRadius;
  const shadow = style.boxShadow && style.boxShadow !== 'none' ? style.boxShadow.split(/,(?![^(]*\))/) : [];
  const t = getTransformInfo(el);
  return {
    borderRadius: radius,
    boxShadow: shadow.map((s) => s.trim()),
    opacity: parseFloat(style.opacity) || 1,
    filter: style.filter === 'none' ? '' : style.filter,
    backdropFilter: (style as any).backdropFilter === 'none' ? '' : (style as any).backdropFilter || '',
    transform: t.matrix,
    mixBlendMode: style.mixBlendMode,
    transformed: t.transformed,
    transformMatrix: t.matrix || undefined,
    scaleFactor: t.transformed ? t.scale : undefined,
    layoutSize: t.transformed ? t.layout : undefined,
    renderedSize: t.transformed ? t.rendered : undefined,
  };
}
