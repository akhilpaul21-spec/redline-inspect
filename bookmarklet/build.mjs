import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const cdn = `https://unpkg.com/redline-inspect@${pkg.version}/dist/redline.iife.js`;

const code = `javascript:(()=>{if(window.redline){window.redline.toggle();return;}var s=document.createElement('script');s.src='${cdn}';s.dataset.startActive='true';s.onload=()=>{};document.documentElement.appendChild(s);})();`;

writeFileSync(resolve(dist, 'bookmarklet.txt'), code);
console.log('Wrote dist/bookmarklet.txt');

// Ensure vite plugin types path note
if (!existsSync(resolve(dist, 'vite.d.ts'))) {
  writeFileSync(
    resolve(dist, 'vite.d.ts'),
    `import type { Plugin } from 'vite';
export interface RedlineViteOptions { build?: boolean; attrs?: Record<string, string>; }
export default function redline(options?: RedlineViteOptions): Plugin;
`,
  );
}
