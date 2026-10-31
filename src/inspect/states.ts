import type { ForceState } from '../types';

const PSEUDOS: ForceState[] = ['hover', 'focus', 'focus-visible', 'active', 'disabled', 'checked'];

let styleEl: HTMLStyleElement | null = null;
let uninspectable: string[] = [];

export function getUninspectableSheets(): string[] {
  return uninspectable;
}

export function applyForcedStates(
  target: Element,
  states: Set<ForceState>,
  subtree: boolean,
): void {
  clearForcedStates();
  if (!states.size || !target) return;

  const attr = Array.from(states).join(' ');
  const targets = subtree ? [target, ...Array.from(target.querySelectorAll('*'))] : [target];
  for (const el of targets) {
    el.setAttribute('data-redline-force', attr);
  }

  const css = buildForceCss(states);
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-redline-states', '');
  styleEl.textContent = css;
  document.documentElement.appendChild(styleEl);
}

export function clearForcedStates(): void {
  document.querySelectorAll('[data-redline-force]').forEach((el) => el.removeAttribute('data-redline-force'));
  styleEl?.remove();
  styleEl = null;
}

function buildForceCss(states: Set<ForceState>): string {
  uninspectable = [];
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      chunks.push(transformRules(sheet.cssRules, states));
    } catch {
      const href = (sheet as CSSStyleSheet).href;
      if (href) uninspectable.push(href);
    }
  }
  return chunks.filter(Boolean).join('\n');
}

function transformRules(rules: CSSRuleList | undefined, states: Set<ForceState>): string {
  if (!rules) return '';
  let out = '';
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const sel = rule.selectorText;
      let next = sel;
      let changed = false;
      for (const state of PSEUDOS) {
        if (!states.has(state)) continue;
        const re = new RegExp(`:${state}\\b`, 'g');
        if (re.test(next)) {
          next = next.replace(re, `:is([data-redline-force~="${state}"])`);
          changed = true;
        }
      }
      if (changed) out += `${next}{${rule.style.cssText}}\n`;
    } else if (rule instanceof CSSMediaRule) {
      const inner = transformRules(rule.cssRules, states);
      if (inner) out += `@media ${rule.conditionText}{${inner}}\n`;
    } else if (rule instanceof CSSSupportsRule) {
      const inner = transformRules(rule.cssRules, states);
      if (inner) out += `@supports ${rule.conditionText}{${inner}}\n`;
    } else if (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule) {
      const inner = transformRules(rule.cssRules, states);
      if (inner) out += `@layer ${(rule as any).name || ''}{${inner}}\n`;
    } else if (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule) {
      const inner = transformRules(rule.cssRules, states);
      if (inner) out += `@container ${rule.conditionText}{${inner}}\n`;
    }
  }
  return out;
}

export function setPauseAnimations(on: boolean): void {
  if (on) document.documentElement.setAttribute('data-redline-pause', '');
  else document.documentElement.removeAttribute('data-redline-pause');

  let el = document.querySelector('style[data-redline-pause]') as HTMLStyleElement | null;
  if (on) {
    if (!el) {
      el = document.createElement('style');
      el.setAttribute('data-redline-pause', '');
      el.textContent =
        'html[data-redline-pause],html[data-redline-pause] *{animation-play-state:paused!important;transition:none!important}';
      document.documentElement.appendChild(el);
    }
  } else {
    el?.remove();
  }
}
