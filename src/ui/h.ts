type Props = Record<string, unknown> & {
  class?: string;
  style?: string | Partial<CSSStyleDeclaration> | Record<string, string>;
  on?: Record<string, EventListener>;
};

export type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K];
export function h(tag: string, props?: Props | null, ...children: Child[]): HTMLElement;
export function h(tag: string, props: Props | null = null, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class' && typeof v === 'string') el.className = v;
      else if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else if (v && typeof v === 'object') Object.assign(el.style, v);
      } else if (k === 'on' && v && typeof v === 'object') {
        for (const [ev, fn] of Object.entries(v as Record<string, EventListener>)) {
          el.addEventListener(ev, fn);
        }
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'text') {
        el.textContent = String(v);
      } else if (v === true) el.setAttribute(k, '');
      else if (v === false || v == null) {
        /* skip */
      } else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function flatten(children: Child[], out: Array<Node | string | number> = []): Array<Node | string | number> {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) flatten(child, out);
    else out.push(child);
  }
  return out;
}

function append(parent: ParentNode, children: Child[]): void {
  for (const child of flatten(children)) {
    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      parent.appendChild(child);
    }
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
