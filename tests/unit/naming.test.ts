import { describe, expect, it } from 'vitest';
import { dedupeName, fileNameFromUrl, slugify, suggestedFileName } from '../../src/assets/naming';

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

  it('prefers source basename and strips spaces', () => {
    expect(fileNameFromUrl('https://cdn.example/icons/Jay.svg')).toBe('Jay.svg');
    expect(fileNameFromUrl('https://cdn.example/fonts/Space Mono.woff2')).toBe('Space-Mono.woff2');
    expect(suggestedFileName('/Jay.svg', 'size-5', '.svg')).toBe('Jay.svg');
    expect(suggestedFileName(null, 'size-5', '.svg')).toBe('size-5.svg');
  });
});
