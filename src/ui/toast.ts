import { h } from './h';

let toastEl: HTMLElement | null = null;
let timer = 0;

export function showToast(host: ShadowRoot | HTMLElement, message: string, ms = 1800): void {
  toastEl?.remove();
  toastEl = h('div', { class: 'rl-toast', text: message });
  host.appendChild(toastEl);
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    toastEl?.remove();
    toastEl = null;
  }, ms);
}
