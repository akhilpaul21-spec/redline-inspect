export type PushSide = 'left' | 'right' | 'bottom';

export interface PagePush {
  apply(side: PushSide, px: number): void;
  clear(immediate?: boolean): void;
  destroy(): void;
  isActive(): boolean;
}

interface Saved {
  marginRight: string;
  marginLeft: string;
  marginBottom: string;
  transition: string;
  /** Whether each margin had an inline value before we touched it */
  hadRight: boolean;
  hadLeft: boolean;
  hadBottom: boolean;
  hadTransition: boolean;
}

const TRANSITION = 'margin-right 160ms ease, margin-left 160ms ease, margin-bottom 160ms ease';

/**
 * Shrinks the host page so a docked panel doesn't cover content.
 * Saves and restores exact prior inline styles on html.
 */
export function createPagePush(onSettled?: () => void): PagePush {
  let saved: Saved | null = null;
  let active = false;
  let timer = 0;

  const html = () => document.documentElement;

  function snapshot(): Saved {
    const el = html();
    return {
      marginRight: el.style.marginRight,
      marginLeft: el.style.marginLeft,
      marginBottom: el.style.marginBottom,
      transition: el.style.transition,
      hadRight: el.style.getPropertyValue('margin-right') !== '',
      hadLeft: el.style.getPropertyValue('margin-left') !== '',
      hadBottom: el.style.getPropertyValue('margin-bottom') !== '',
      hadTransition: el.style.getPropertyValue('transition') !== '',
    };
  }

  function restoreExact(s: Saved): void {
    const el = html();
    if (s.hadRight) el.style.marginRight = s.marginRight;
    else el.style.removeProperty('margin-right');
    if (s.hadLeft) el.style.marginLeft = s.marginLeft;
    else el.style.removeProperty('margin-left');
    if (s.hadBottom) el.style.marginBottom = s.marginBottom;
    else el.style.removeProperty('margin-bottom');
    if (s.hadTransition) el.style.transition = s.transition;
    else el.style.removeProperty('transition');
  }

  function apply(side: PushSide, px: number): void {
    const el = html();
    if (!saved) saved = snapshot();
    active = true;
    el.style.transition = TRANSITION;
    // Clear other sides we might have set previously in this session
    el.style.marginRight = side === 'right' ? `${Math.max(0, px)}px` : saved.hadRight ? saved.marginRight : '';
    el.style.marginLeft = side === 'left' ? `${Math.max(0, px)}px` : saved.hadLeft ? saved.marginLeft : '';
    el.style.marginBottom = side === 'bottom' ? `${Math.max(0, px)}px` : saved.hadBottom ? saved.marginBottom : '';
    if (side !== 'right' && !saved.hadRight) el.style.removeProperty('margin-right');
    if (side !== 'left' && !saved.hadLeft) el.style.removeProperty('margin-left');
    if (side !== 'bottom' && !saved.hadBottom) el.style.removeProperty('margin-bottom');

    window.clearTimeout(timer);
    timer = window.setTimeout(() => onSettled?.(), 170);
  }

  function clear(immediate = false): void {
    window.clearTimeout(timer);
    if (!saved) {
      active = false;
      return;
    }
    const el = html();
    const snap = saved;
    if (immediate) {
      restoreExact(snap);
      saved = null;
      active = false;
      onSettled?.();
      return;
    }
    el.style.transition = TRANSITION;
    el.style.marginRight = snap.hadRight ? snap.marginRight : '0px';
    el.style.marginLeft = snap.hadLeft ? snap.marginLeft : '0px';
    el.style.marginBottom = snap.hadBottom ? snap.marginBottom : '0px';
    timer = window.setTimeout(() => {
      restoreExact(snap);
      saved = null;
      active = false;
      onSettled?.();
    }, 170);
  }

  function destroy(): void {
    window.clearTimeout(timer);
    if (saved) restoreExact(saved);
    saved = null;
    active = false;
  }

  return {
    apply,
    clear,
    destroy,
    isActive: () => active,
  };
}
