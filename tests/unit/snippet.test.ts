import { describe, expect, it } from 'vitest';
import { FONT_SIZE, SPACING } from '../../src/inspect/snippet';

describe('tailwind map', () => {
  it('has spacing scale entries', () => {
    expect(SPACING[16]).toBe('4');
    expect(SPACING[24]).toBe('6');
  });

  it('has font size names', () => {
    expect(FONT_SIZE[16]).toBe('base');
    expect(FONT_SIZE[14]).toBe('sm');
  });
});
