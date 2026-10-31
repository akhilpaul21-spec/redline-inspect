import type { NotesSpec } from '../types';

export function getNotes(el: Element): NotesSpec {
  const notes: NotesSpec = {};
  const spec = el.getAttribute('data-spec');
  const state = el.getAttribute('data-spec-state');
  const behavior = el.getAttribute('data-spec-behavior');
  const a11y = el.getAttribute('data-spec-a11y');
  const link = el.getAttribute('data-spec-link');
  if (spec) notes.spec = spec;
  if (state) notes.state = state;
  if (behavior) notes.behavior = behavior;
  if (a11y) notes.a11y = a11y;
  if (link) notes.link = link;
  return notes;
}

export function hasNotes(el: Element): boolean {
  return Array.from(el.attributes).some((a) => a.name.startsWith('data-spec'));
}

export function collectAnnotated(root: ParentNode = document): Element[] {
  const out: Element[] = [];
  const walk = (node: ParentNode) => {
    const els = node.querySelectorAll('*');
    for (const el of Array.from(els)) {
      if (hasNotes(el)) out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(root);
  return out;
}
