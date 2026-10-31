import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  formatColor,
  parseColor,
  toHex,
  toHsl,
  toRgb,
} from '../../src/inspect/colors';

describe('colors', () => {
  it('parses hex and formats rgb/hsl', () => {
    const c = parseColor('#4F46E5')!;
    expect(c).toMatchObject({ r: 79, g: 70, b: 229, a: 1 });
    expect(toHex(c)).toBe('#4F46E5');
    expect(toRgb(c)).toBe('rgb(79, 70, 229)');
    expect(toHsl(c)).toMatch(/^hsl\(/);
  });

  it('handles alpha hex', () => {
    const c = parseColor('#11223380')!;
    expect(c.a).toBeCloseTo(0.502, 2);
    expect(toHex(c).endsWith('80') || toHex(c).length === 9).toBe(true);
  });

  it('parses rgb/rgba', () => {
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toMatchObject({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(formatColor('rgb(1,2,3)').hex).toBe('#010203');
  });

  it('computes contrast ratio', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBe(21);
  });
});
