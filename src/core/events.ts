import type { Store } from './state';
import { deepElementFromPoint, isCrossOriginIframe } from './hit-test';
import type { ForceState } from '../types';

export interface EventHandlers {
  onToggle: () => void;
  onSelect: (el: Element, pinned: boolean) => void;
  onHover: (el: Element | null, alt: boolean) => void;
  onExport: () => void;
  onCopyCss: () => void;
  onCycleUnits: () => void;
  onToggleGrid: () => void;
  onNavigate: (dir: 'parent' | 'child' | 'prev' | 'next') => void;
  onEsc: () => void;
  onOpenPanel: () => void;
  onCheatSheet: () => void;
  getShadowRoot: () => ShadowRoot | null;
  getIgnore: () => string[];
  getShortcut: () => string;
}

function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+').map((p) => p.trim());
  const wantAlt = parts.includes('alt') || parts.includes('option');
  const wantShift = parts.includes('shift');
  const wantMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');
  const wantCtrl = parts.includes('ctrl') || parts.includes('control');
  const keyPart = parts.find((p) => !['alt', 'option', 'shift', 'meta', 'cmd', 'command', 'ctrl', 'control'].includes(p));
  if (!keyPart) return false;
  if (!!e.altKey !== wantAlt) return false;
  if (!!e.shiftKey !== wantShift) return false;
  if (!!e.metaKey !== wantMeta) return false;
  if (!!e.ctrlKey !== wantCtrl) return false;
  const code = e.code.toLowerCase();
  const expected = `key${keyPart}`.toLowerCase();
  return code === expected || e.key.toLowerCase() === keyPart;
}

export function attachEvents(store: Store, handlers: EventHandlers): () => void {
  const block = (e: Event) => {
    if (!store.get().active) return;
    const t = e.target as Node | null;
    const shadow = handlers.getShadowRoot();
    if (t && shadow && (t === shadow.host || shadow.contains(t as Node) || (t as any).getRootNode?.() === shadow)) {
      return; // allow UI interaction
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  };

  const onPointer = (e: MouseEvent) => {
    if (!store.get().active) return;
    const shadow = handlers.getShadowRoot();
    const t = e.target as Node | null;
    if (t && shadow && (shadow.host.contains(t) || (t as any).getRootNode?.() === shadow)) return;
    block(e);
    if (e.type === 'click' || e.type === 'mousedown' || e.type === 'pointerdown') {
      if (e.type !== 'click') return;
      const el = deepElementFromPoint(e.clientX, e.clientY, shadow, handlers.getIgnore());
      if (!el) return;
      if (isCrossOriginIframe(el)) {
        handlers.onSelect(el, false);
        return;
      }
      handlers.onSelect(el, e.shiftKey);
    }
  };

  const onMove = (e: MouseEvent) => {
    if (!store.get().active) return;
    const shadow = handlers.getShadowRoot();
    const t = e.target as Node | null;
    if (t && shadow && (shadow.host.contains(t) || (t as any).getRootNode?.() === shadow)) return;
    const el = deepElementFromPoint(e.clientX, e.clientY, shadow, handlers.getIgnore());
    handlers.onHover(el, e.altKey);
  };

  const onKey = (e: KeyboardEvent) => {
    const shortcut = handlers.getShortcut();
    if (matchShortcut(e, shortcut)) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onToggle();
      return;
    }

    if (matchShortcut(e, 'Alt+Shift+E')) {
      e.preventDefault();
      handlers.onExport();
      return;
    }
    if (matchShortcut(e, 'Alt+Shift+C')) {
      e.preventDefault();
      handlers.onCopyCss();
      return;
    }
    if (matchShortcut(e, 'Alt+Shift+U')) {
      e.preventDefault();
      handlers.onCycleUnits();
      return;
    }
    if (matchShortcut(e, 'Alt+Shift+G')) {
      e.preventDefault();
      handlers.onToggleGrid();
      return;
    }

    if (!store.get().active) return;

    // Ignore when typing in host inputs unless inspect active — then we still capture
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handlers.onEsc();
      return;
    }
    if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
      e.preventDefault();
      handlers.onCheatSheet();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handlers.onOpenPanel();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handlers.onNavigate('parent');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      handlers.onNavigate('child');
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlers.onNavigate('prev');
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handlers.onNavigate('next');
      return;
    }

    block(e);
  };

  const opts: AddEventListenerOptions = { capture: true };
  const types = ['click', 'mousedown', 'pointerdown', 'mouseover', 'submit'] as const;
  for (const t of types) window.addEventListener(t, onPointer as EventListener, opts);
  window.addEventListener('mousemove', onMove, opts);
  window.addEventListener('keydown', onKey, opts);

  return () => {
    for (const t of types) window.removeEventListener(t, onPointer as EventListener, opts);
    window.removeEventListener('mousemove', onMove, opts);
    window.removeEventListener('keydown', onKey, opts);
  };
}

export function navigateSelection(selected: Element | null, dir: 'parent' | 'child' | 'prev' | 'next'): Element | null {
  if (!selected) return null;
  if (dir === 'parent') return selected.parentElement;
  if (dir === 'child') return (selected.firstElementChild as Element) ?? selected;
  const parent = selected.parentElement;
  if (!parent) return selected;
  const kids = Array.from(parent.children);
  const idx = kids.indexOf(selected);
  if (dir === 'prev') return (kids[idx - 1] as Element) ?? selected;
  return (kids[idx + 1] as Element) ?? selected;
}

export type { ForceState };
