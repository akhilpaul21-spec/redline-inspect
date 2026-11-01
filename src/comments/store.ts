import { shortestUniqueSelector } from '../util/selector';

export interface RedlineComment {
  id: string;
  selector: string;
  label: string;
  text: string;
  createdAt: string;
}

function storageKey(url = location.href): string {
  try {
    const u = new URL(url);
    return `redline:comments:${u.origin}${u.pathname}`;
  } catch {
    return `redline:comments:${url}`;
  }
}

export function loadComments(url = location.href): RedlineComment[] {
  try {
    const raw = localStorage.getItem(storageKey(url));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RedlineComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveComments(comments: RedlineComment[], url = location.href): void {
  try {
    localStorage.setItem(storageKey(url), JSON.stringify(comments));
  } catch {
    /* ignore quota */
  }
}

export function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = el.classList[0];
  if (cls) return `${tag}.${cls}`;
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (text) return `${tag} “${text}${text.length >= 40 ? '…' : ''}”`;
  return tag;
}

export function addComment(el: Element, text: string, existing: RedlineComment[]): RedlineComment[] {
  const comment: RedlineComment = {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    selector: shortestUniqueSelector(el),
    label: elementLabel(el),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...existing, comment];
  saveComments(next);
  return next;
}

export function removeComment(id: string, existing: RedlineComment[]): RedlineComment[] {
  const next = existing.filter((c) => c.id !== id);
  saveComments(next);
  return next;
}

export function resolveCommentElement(comment: RedlineComment): Element | null {
  try {
    return document.querySelector(comment.selector);
  } catch {
    return null;
  }
}
