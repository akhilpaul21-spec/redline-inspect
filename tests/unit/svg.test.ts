import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from '../../src/assets/svg';

describe('svg sanitizer', () => {
  it('strips script and on* handlers', () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onclick="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>`;
    const out = sanitizeSvg(dirty);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).toMatch(/<rect/);
  });
});
