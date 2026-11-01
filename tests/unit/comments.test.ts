import { beforeEach, describe, expect, it } from 'vitest';
import {
  addComment,
  commentsStorageKey,
  elementLabel,
  loadComments,
  removeComment,
  saveComments,
} from '../../src/comments/store';

describe('comments store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<button id="cta" class="primary">Buy now</button>`;
  });

  it('labels elements with id', () => {
    expect(elementLabel(document.querySelector('#cta')!)).toBe('button#cta');
  });

  it('storage key ignores hash and search', () => {
    const base = `${location.origin}${location.pathname}`;
    expect(commentsStorageKey(`${location.origin}${location.pathname}#cards`)).toBe(`redline:comments:${base}`);
    expect(commentsStorageKey(`${location.origin}${location.pathname}?x=1`)).toBe(`redline:comments:${base}`);
  });

  it('persists add/remove in localStorage', () => {
    const el = document.querySelector('#cta')!;
    const added = addComment(el, 'Needs focus ring', []);
    expect(added).toHaveLength(1);
    expect(loadComments()[0]?.text).toBe('Needs focus ring');
    expect(loadComments()[0]?.label).toBe('button#cta');

    const cleared = removeComment(added[0]!.id, added);
    expect(cleared).toHaveLength(0);
    expect(loadComments()).toHaveLength(0);
  });

  it('round-trips saveComments', () => {
    saveComments([
      {
        id: 'c1',
        selector: '#cta',
        label: 'button#cta',
        text: 'Hello',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(loadComments()).toHaveLength(1);
  });
});
