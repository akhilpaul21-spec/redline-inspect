import { configFromUrl, mergeConfig } from './config';
import { attachEvents, navigateSelection } from './core/events';
import { createStore, loadActive, saveActive } from './core/state';
import { rafThrottle } from './util/throttle';
import { buildElementSpec } from './inspect/spec';
import { collectTokens } from './inspect/tokens';
import { applyForcedStates, clearForcedStates, setPauseAnimations } from './inspect/states';
import { copyText } from './util/clipboard';
import { downloadBlob, exportAssetsZip } from './assets/zip';
import { buildPageReport } from './report/page-report';
import { mountRoot, showCheatSheet } from './ui/root';
import { createOverlay } from './ui/overlay';
import { createFab } from './ui/fab';
import { createPanel, type PanelTab } from './ui/panel';
import { createPagePush } from './ui/push';
import { showToast } from './ui/toast';
import {
  loadComments,
  makeComment,
  removeComment,
  resolveCommentElement,
  saveComments,
  updateComment,
  type RedlineComment,
} from './comments/store';
import { ensureAuthorName, getAuthorName } from './comments/identity';
import {
  createRemoteComment,
  deleteRemoteComment,
  fetchRemoteComments,
  patchRemoteComment,
} from './comments/sync';
import type { ForceState, RedlineConfig, RedlineInstance, TokenMaps, UnitsMode } from './types';

export type { RedlineConfig, RedlineInstance, ElementSpec } from './types';

let singleton: RedlineInstance | null = null;
let destroyInternal: (() => void) | null = null;

export function init(config?: RedlineConfig): RedlineInstance {
  if (singleton) return singleton;

  const urlCfg = configFromUrl();
  const cfg = mergeConfig({ ...urlCfg, ...config });
  if (!cfg.enabled) {
    const noop: RedlineInstance = {
      toggle() {},
      select() {},
      getSpec(el) {
        return buildElementSpec(resolveEl(el), collectTokens(), cfg.remBase);
      },
      async exportAssets() {
        return new Blob();
      },
      async exportReport() {
        return new Blob();
      },
      destroy() {},
    };
    singleton = noop;
    return noop;
  }

  const startOpen = !!(cfg.startActive || loadActive());
  const store = createStore({
    units: cfg.units,
    active: startOpen,
    panelOpen: startOpen,
    panelCollapsed: false,
  });

  let tokens: TokenMaps = collectTokens(cfg.tokenPrefixes);
  let comments: RedlineComment[] = loadComments();
  let panelTab: PanelTab = 'inspect';
  let authorName = getAuthorName();
  let syncPoll: number | null = null;
  let syncInFlight: Promise<void> | null = null;
  const syncCfg =
    cfg.sync?.endpoint && cfg.sync.project && cfg.sync.key ? cfg.sync : undefined;

  const root = mountRoot(cfg.theme);
  const overlay = createOverlay(root.layer);
  const panel = createPanel(root.shadow);
  const fab = cfg.showFab
    ? createFab(root.shadow, {
        position: cfg.fabPosition,
        onToggle: () => instance.toggle(),
        isOn: () => store.get().panelOpen || store.get().active,
      })
    : null;

  let altHover = false;
  let observers: Array<ResizeObserver | MutationObserver> = [];

  const refreshTokens = () => {
    tokens = collectTokens(cfg.tokenPrefixes);
  };

  /**
   * Overlay paints (box model, pins, hover) are cheap and run often.
   * Panel DOM must NOT rebuild on hover — that wiped the Comments textarea
   * mid-edit so Add comment saved nothing and the list looked broken.
   */
  const paintOverlay = rafThrottle(() => {
    const s = store.get();
    overlay.render({
      selected: s.selected,
      hovered: s.hovered,
      pinned: s.pinned,
      altHover,
      units: s.units,
      remBase: cfg.remBase,
      showNotes: s.showNotes,
      active: s.active,
      comments: s.panelOpen || s.active ? comments : [],
    });
    document.documentElement.style.cursor = s.active ? 'crosshair' : '';
    fab?.sync();
  });

  const pagePush = createPagePush(() => paintOverlay());

  const syncPush = (): void => {
    if (cfg.panelMode !== 'push') {
      if (pagePush.isActive()) pagePush.clear(true);
      return;
    }
    if (!store.get().panelOpen) {
      if (pagePush.isActive()) pagePush.clear();
      return;
    }
    const rect = panel.el.getBoundingClientRect();
    const mobile = window.matchMedia('(max-width: 639px)').matches;
    if (mobile) {
      pagePush.apply('bottom', Math.round(rect.height) || Math.round(window.innerHeight * 0.45));
    } else {
      const side = cfg.panelSide === 'left' ? 'left' : 'right';
      pagePush.apply(side, Math.round(rect.width) || 320);
    }
  };

  const paintPanel = (): void => {
    const s = store.get();
    const spec = s.selected ? buildElementSpec(s.selected, tokens, cfg.remBase) : null;
    panel.render(spec, panelOpts());
  };

  const renderAll = (): void => {
    paintOverlay();
    paintPanel();
    syncPush();
  };

  const stopSyncPoll = (): void => {
    if (syncPoll != null) {
      window.clearInterval(syncPoll);
      syncPoll = null;
    }
  };

  const pullRemoteComments = async (opts: { silent?: boolean } = {}): Promise<void> => {
    if (!syncCfg) return;
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      try {
        const remote = await fetchRemoteComments(syncCfg);
        comments = remote;
        saveComments(comments);
        paintOverlay();
        paintPanel();
        if (!opts.silent) showToast(root.shadow, 'Comments synced');
      } catch (err) {
        if (!opts.silent) {
          const detail = err instanceof Error ? err.message : 'sync failed';
          showToast(root.shadow, `Sync failed: ${detail}`, 4_000);
        }
      } finally {
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  };

  const startSyncPoll = (): void => {
    if (!syncCfg) return;
    stopSyncPoll();
    syncPoll = window.setInterval(() => {
      if (store.get().panelOpen) void pullRemoteComments({ silent: true });
    }, 30_000);
  };

  const panelOpts = () => {
    const s = store.get();
    return {
      open: s.panelOpen,
      side: cfg.panelSide,
      units: s.units,
      remBase: cfg.remBase,
      tab: panelTab,
      forcedStates: s.forcedStates,
      forceSubtree: s.forceSubtree,
      showTailwind: cfg.tailwind,
      showGridLines: s.showGridLines,
      breakpoints: cfg.breakpoints,
      comments,
      authorName,
      syncEnabled: !!syncCfg,
      onTab: (tab: PanelTab) => {
        panelTab = tab;
        if (tab === 'comments' && syncCfg) void pullRemoteComments({ silent: true });
        paintPanel();
      },
      onClose: () => instance.toggle(false),
      onCrumb: (sel: string) => {
        try {
          const el = document.querySelector(sel);
          if (el) instance.select(el);
        } catch {
          /* ignore */
        }
      },
      onForce: (state: ForceState) => {
        const next = new Set(s.forcedStates);
        if (next.has(state)) next.delete(state);
        else next.add(state);
        store.set({ forcedStates: next });
        if (s.selected) applyForcedStates(s.selected, next, s.forceSubtree);
        renderAll();
      },
      onForceSubtree: (v: boolean) => {
        store.set({ forceSubtree: v });
        if (s.selected) applyForcedStates(s.selected, s.forcedStates, v);
        renderAll();
      },
      onCopySelector: () => showToast(root.shadow, 'Copied'),
      onCycleUnits: cycleUnits,
      onToggleGrid: () => {
        store.set({ showGridLines: !store.get().showGridLines });
        renderAll();
      },
      onHelp: () => showCheatSheet(root.shadow, () => {}),
      onExportAssets: () => void doExportAssets(),
      onExportJson: () => void doExportReport('json'),
      onExportHtml: () => void doExportReport('html'),
      onAddComment: (text: string) => {
        const el = store.get().selected;
        if (!el) return;
        const name = ensureAuthorName(false);
        authorName = getAuthorName();
        if (!name) {
          showToast(root.shadow, 'Display name required', 3_000);
          paintPanel();
          return;
        }
        const comment = makeComment(el, text, name);
        const previous = comments;
        comments = [...comments, comment];
        saveComments(comments);
        panelTab = 'comments';
        showToast(root.shadow, 'Comment added');
        paintOverlay();
        paintPanel();
        syncPush();
        if (syncCfg) {
          void createRemoteComment(syncCfg, comment).catch((err) => {
            comments = previous;
            saveComments(comments);
            paintOverlay();
            paintPanel();
            const detail = err instanceof Error ? err.message : 'sync failed';
            showToast(root.shadow, `Sync failed: ${detail}`, 4_000);
          });
        }
      },
      onDeleteComment: (id: string) => {
        const previous = comments;
        comments = removeComment(id, comments);
        paintOverlay();
        paintPanel();
        syncPush();
        if (syncCfg) {
          void deleteRemoteComment(syncCfg, id).catch((err) => {
            comments = previous;
            saveComments(comments);
            paintOverlay();
            paintPanel();
            const detail = err instanceof Error ? err.message : 'sync failed';
            showToast(root.shadow, `Sync failed: ${detail}`, 4_000);
          });
        }
      },
      onResolveComment: (id: string, resolved: boolean) => {
        const previous = comments;
        comments = updateComment(id, { resolved }, comments);
        paintOverlay();
        paintPanel();
        if (syncCfg) {
          void patchRemoteComment(syncCfg, id, { resolved }).catch((err) => {
            comments = previous;
            saveComments(comments);
            paintOverlay();
            paintPanel();
            const detail = err instanceof Error ? err.message : 'sync failed';
            showToast(root.shadow, `Sync failed: ${detail}`, 4_000);
          });
        }
      },
      onSelectComment: (comment: RedlineComment) => {
        const el = resolveCommentElement(comment);
        if (!el) {
          showToast(root.shadow, 'Element not found');
          return;
        }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        instance.select(el);
        panelTab = 'inspect';
        renderAll();
      },
      onRefreshComments: () => {
        void pullRemoteComments();
      },
      onChangeAuthor: () => {
        authorName = ensureAuthorName(true);
        paintPanel();
      },
    };
  };

  function cycleUnits(): void {
    const order: UnitsMode[] = ['px', 'rem', 'both'];
    const cur = store.get().units;
    const next = order[(order.indexOf(cur) + 1) % order.length]!;
    store.set({ units: next });
    renderAll();
  }

  async function doExportAssets(): Promise<Blob> {
    showToast(root.shadow, 'Preparing…', 60_000);
    try {
      const blob = await exportAssetsZip(cfg, (msg) => showToast(root.shadow, msg, 60_000), comments);
      const name =
        cfg.assets.zipName ||
        `${location.hostname || 'page'}-assets.${blob.type.includes('json') ? 'json' : 'zip'}`;
      downloadBlob(blob, name);
      showToast(root.shadow, 'Export complete');
      return blob;
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : 'unknown error';
      showToast(root.shadow, `Export failed: ${detail}`, 5_000);
      throw err;
    }
  }

  async function doExportReport(format: 'json' | 'html'): Promise<Blob> {
    const blob = await buildPageReport(format, root.shadow, cfg.remBase, comments);
    downloadBlob(blob, `page-spec.${format === 'json' ? 'json' : 'html'}`);
    showToast(root.shadow, 'Report ready');
    return blob;
  }

  function watchSelected(el: Element | null): void {
    observers.forEach((o) => o.disconnect());
    observers = [];
    if (!el) return;
    const ro = new ResizeObserver(() => {
      paintOverlay();
      // Don't rebuild Comments (or any) panel DOM on geometry ticks — that wiped drafts.
      if (panelTab === 'inspect') paintPanel();
    });
    ro.observe(el);
    observers.push(ro);
    const mo = new MutationObserver(() => {
      if (!el.isConnected) {
        store.set({ selected: null });
        clearForcedStates();
        renderAll();
      } else {
        paintOverlay();
        if (panelTab === 'inspect') paintPanel();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(mo);
  }

  const onScrollOrResize = rafThrottle(() => {
    paintOverlay();
  });
  const onViewportResize = rafThrottle(() => {
    paintOverlay();
    paintPanel();
    syncPush();
  });
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onViewportResize);

  const detachEvents = attachEvents(store, {
    onToggle: () => instance.toggle(),
    onSelect: (el, pinned) => {
      if (!store.get().active) return;
      if (pinned) {
        const list = [...store.get().pinned];
        if (!list.includes(el) && list.length < 5) list.push(el);
        store.set({ pinned: list, selected: el, panelOpen: true });
      } else {
        clearForcedStates();
        store.set({ selected: el, forcedStates: new Set(), panelOpen: true });
        cfg.onSelect?.(buildElementSpec(el, tokens, cfg.remBase));
      }
      watchSelected(el);
      renderAll();
    },
    onHover: (el, alt) => {
      altHover = alt;
      store.set({ hovered: el });
      // Overlay only — rebuilding the panel here cleared the Comments draft.
      paintOverlay();
    },
    onExport: () => void doExportAssets(),
    onCopyCss: async () => {
      const sel = store.get().selected;
      if (!sel) return;
      const spec = buildElementSpec(sel, tokens, cfg.remBase);
      await copyText(spec.cssSnippet);
      showToast(root.shadow, 'Copied');
    },
    onCycleUnits: cycleUnits,
    onToggleGrid: () => {
      store.set({ showGridLines: !store.get().showGridLines });
      renderAll();
    },
    onNavigate: (dir) => {
      const next = navigateSelection(store.get().selected, dir);
      if (next) instance.select(next);
    },
    onEsc: () => {
      const s = store.get();
      if (s.selected || s.pinned.length) {
        clearForcedStates();
        store.set({ selected: null, pinned: [], forcedStates: new Set() });
        watchSelected(null);
        renderAll();
      } else {
        instance.toggle(false);
      }
    },
    onOpenPanel: () => {
      store.set({ panelOpen: true, active: true });
      startSyncPoll();
      void pullRemoteComments({ silent: true });
      renderAll();
    },
    onCheatSheet: () => showCheatSheet(root.shadow, () => {}),
    getShadowRoot: () => root.shadow,
    getIgnore: () => cfg.ignore,
    getShortcut: () => cfg.shortcut,
  });

  const onPop = () => {
    refreshTokens();
    comments = loadComments();
    store.set({ selected: null });
    clearForcedStates();
    renderAll();
  };
  window.addEventListener('popstate', onPop);
  const origPush = history.pushState.bind(history);
  history.pushState = function (...args) {
    const r = origPush(...args);
    onPop();
    return r;
  };

  const unsub = store.subscribe(() => {
    saveActive(store.get().active);
  });

  const instance: RedlineInstance = {
    toggle(force?: boolean) {
      const next = force ?? !store.get().panelOpen;
      if (next) {
        refreshTokens();
        comments = loadComments();
        store.set({ active: true, panelOpen: true });
        startSyncPoll();
        void pullRemoteComments({ silent: true });
      } else {
        stopSyncPoll();
        clearForcedStates();
        store.set({
          active: false,
          panelOpen: false,
          selected: null,
          hovered: null,
          pinned: [],
          forcedStates: new Set(),
        });
        watchSelected(null);
      }
      renderAll();
    },
    select(el) {
      const node = resolveEl(el);
      clearForcedStates();
      const wasOpen = store.get().panelOpen;
      store.set({
        selected: node,
        forcedStates: new Set(),
        panelOpen: true,
        active: true,
      });
      if (!wasOpen) {
        startSyncPoll();
        void pullRemoteComments({ silent: true });
      }
      watchSelected(node);
      cfg.onSelect?.(buildElementSpec(node, tokens, cfg.remBase));
      renderAll();
    },
    getSpec(el) {
      return buildElementSpec(resolveEl(el), tokens, cfg.remBase);
    },
    exportAssets: doExportAssets,
    exportReport: doExportReport,
    destroy() {
      destroyInternal?.();
    },
  };

  destroyInternal = () => {
    stopSyncPoll();
    detachEvents();
    unsub();
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onViewportResize);
    window.removeEventListener('popstate', onPop);
    history.pushState = origPush;
    onScrollOrResize.cancel();
    onViewportResize.cancel();
    paintOverlay.cancel();
    pagePush.destroy();
    observers.forEach((o) => o.disconnect());
    clearForcedStates();
    setPauseAnimations(false);
    document.documentElement.style.cursor = '';
    fab?.destroy();
    panel.destroy();
    root.destroy();
    singleton = null;
    destroyInternal = null;
  };

  renderAll();
  if (store.get().active) refreshTokens();
  if (syncCfg) {
    void pullRemoteComments({ silent: true });
    if (store.get().panelOpen) startSyncPoll();
  }

  singleton = instance;
  if (typeof window !== 'undefined') {
    window.redline = instance;
    // Closed shadow is opaque to page JS; e2e reaches it through this hook.
    Object.defineProperty(instance, '__shadow', {
      get: () => root.shadow,
      enumerable: false,
    });
  }
  return instance;
}

function resolveEl(el: Element | string): Element {
  if (typeof el === 'string') {
    const found = document.querySelector(el);
    if (!found) throw new Error(`redline: no element for selector ${el}`);
    return found;
  }
  return el;
}

export function destroy(): void {
  singleton?.destroy();
}

export function toggle(force?: boolean): void {
  singleton?.toggle(force);
}
