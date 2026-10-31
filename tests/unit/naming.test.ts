import { describe, expect, it } from 'vitest';
import { dedupeName, slugify } from '../../src/assets/naming';

describe('naming', () => {
  it('slugifies', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  A   B  ')).toBe('a-b');
  });

  it('dedupes different content', () => {
    const used = new Map<string, string>();
    expect(dedupeName('icon.svg', used, 'aaa')).toBe('icon.svg');
    expect(dedupeName('icon.svg', used, 'bbb')).toBe('icon-2.svg');
    expect(dedupeName('icon.svg', used, 'aaa')).toBe('icon.svg');
  });
});
