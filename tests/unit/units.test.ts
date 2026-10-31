import { describe, expect, it } from 'vitest';
import { formatLength, formatPx, pxToRem, roundCssPx } from '../../src/util/units';

describe('units', () => {
  it('rounds to 0.5px', () => {
    expect(roundCssPx(12.24)).toBe(12);
    expect(roundCssPx(12.25)).toBe(12.5);
    expect(roundCssPx(12.76)).toBe(13);
  });

  it('formats px without trailing decimals', () => {
    expect(formatPx(12)).toBe('12');
    expect(formatPx(12.5)).toBe('12.5');
  });

  it('converts px to rem', () => {
    expect(pxToRem(16, 16)).toBe(1);
    expect(pxToRem(24, 16)).toBe(1.5);
    expect(formatLength(24, 'both', 16)).toBe('24 · 1.5rem');
  });
});
