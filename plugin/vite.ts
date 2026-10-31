import type { Plugin } from 'vite';

export interface RedlineViteOptions {
  /** When true, also inject into `vite build` / preview outputs. Default: false (dev only). */
  build?: boolean;
  /** Extra attributes for the injected script tag. */
  attrs?: Record<string, string>;
}

export default function redline(options: RedlineViteOptions = {}): Plugin {
  const injectBuild = options.build === true;
  let command: 'build' | 'serve' = 'serve';

  return {
    name: 'redline-inspect',
    configResolved(cfg) {
      command = cfg.command;
    },
    transformIndexHtml(html) {
      if (command === 'build' && !injectBuild) return html;
      const attrStr = Object.entries(options.attrs ?? {})
        .map(([k, v]) => `${k}="${v.replace(/"/g, '&quot;')}"`)
        .join(' ');
      const tag =
        command === 'serve'
          ? `<script type="module">import { init } from 'redline-inspect'; init(window.REDLINE_CONFIG);</script>`
          : `<script src="/redline.iife.js" defer ${attrStr}></script>`;
      if (html.includes('</body>')) return html.replace('</body>', `${tag}</body>`);
      return html + tag;
    },
  };
}
