import { h } from './h';
import { loadFabPos, saveFabPos } from '../core/state';
import type { FabPosition } from '../types';

const RULER = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16v10H4z"/><path d="M8 7v3M12 7v5M16 7v3"/></svg>`;

export function createFab(
  host: ShadowRoot,
  opts: {
    position: FabPosition;
    onToggle: () => void;
    isOn: () => boolean;
  },
): { el: HTMLElement; sync(): void; destroy(): void } {
  const el = h('button', {
    class: 'rl-fab',
    type: 'button',
    title: 'Inspect (⌥⇧R)',
    'aria-label': 'Toggle Inspect',
  });
  el.innerHTML = RULER;
  host.appendChild(el);

  const saved = loadFabPos();
  if (saved) {
    el.style.left = `${saved.x}px`;
    el.style.top = `${saved.y}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  } else {
    place(el, opts.position);
  }

  let dragging = false;
  let moved = false;
  let ox = 0;
  let oy = 0;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    moved = false;
    ox = e.clientX - el.getBoundingClientRect().left;
    oy = e.clientY - el.getBoundingClientRect().top;
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    moved = true;
    const x = Math.max(0, Math.min(window.innerWidth - 40, e.clientX - ox));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (moved) {
      saveFabPos({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
    } else {
      opts.onToggle();
    }
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);

  return {
    el,
    sync() {
      el.classList.toggle('on', opts.isOn());
    },
    destroy() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.remove();
    },
  };
}

function place(el: HTMLElement, pos: FabPosition): void {
  el.style.left = '';
  el.style.right = '';
  el.style.top = '';
  el.style.bottom = '';
  const m = '16px';
  if (pos.includes('right')) el.style.right = m;
  else el.style.left = m;
  if (pos.includes('bottom')) el.style.bottom = m;
  else el.style.top = m;
}
