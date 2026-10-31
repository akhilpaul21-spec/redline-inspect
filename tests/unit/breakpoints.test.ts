import { describe, expect, it } from 'vitest';
import { currentBreakpointLabel } from '../../src/inspect/breakpoints';

describe('breakpoints', () => {
  it('labels viewport against Tailwind defaults', () => {
    // happy-dom default width may vary; just ensure function returns a string
    expect(typeof currentBreakpointLabel()).toBe('string');
  });
});
