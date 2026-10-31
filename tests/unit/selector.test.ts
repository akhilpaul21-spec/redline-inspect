import { describe, expect, it } from 'vitest';
import { shortestUniqueSelector } from '../../src/util/selector';

describe('selector', () => {
  it('prefers id', () => {
    document.body.innerHTML = `<div id="cta" class="x">hi</div>`;
    const el = document.querySelector('#cta')!;
    expect(shortestUniqueSelector(el)).toBe('#cta');
  });
});
