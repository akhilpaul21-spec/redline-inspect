import type { ForceState, UnitsMode } from '../types';

export interface AppState {
  active: boolean;
  selected: Element | null;
  hovered: Element | null;
  pinned: Element[];
  forcedStates: Set<ForceState>;
  forceSubtree: boolean;
  units: UnitsMode;
  showNotes: boolean;
  showGridLines: boolean;
  pauseAnimations: boolean;
  panelCollapsed: boolean;
  panelOpen: boolean;
}

type Listener = () => void;

export function createStore(initial: Partial<AppState> = {}) {
  const state: AppState = {
    active: false,
    selected: null,
    hovered: null,
    pinned: [],
    forcedStates: new Set(),
    forceSubtree: false,
    units: 'both',
    showNotes: true,
    showGridLines: false,
    pauseAnimations: false,
    panelCollapsed: false,
    panelOpen: true,
    ...initial,
  };

  const listeners = new Set<Listener>();

  return {
    get(): AppState {
      return state;
    },
    set(partial: Partial<AppState>): void {
      Object.assign(state, partial);
      listeners.forEach((l) => l());
    },
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

const SESSION_KEY = 'redline:active';
const FAB_KEY = 'redline:fab';

export function loadActive(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveActive(active: boolean): void {
  try {
    sessionStorage.setItem(SESSION_KEY, active ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadFabPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(FAB_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { x: number; y: number };
    if (typeof v.x === 'number' && typeof v.y === 'number') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveFabPos(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(FAB_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}
