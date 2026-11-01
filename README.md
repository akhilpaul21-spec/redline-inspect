# redline

**Figma Dev Mode–style inspect, redlines, and asset export for HTML prototypes.**

Designers increasingly hand off live, "vibecoded" HTML prototypes instead of Figma files, and developers lose the redlines, type specs, colors, and assets that Dev Mode used to give them. `redline` brings that back. Drop it into any prototype and you get an **Inspect mode** on top of the live page, plus a one-click **asset ZIP**.

> 🚧 **Status: in active development.** The API and features below follow the build spec and may change before v1.0. Not yet published to npm.

- Free and MIT-licensed
- Runs entirely in the browser: no backend, no accounts, no telemetry
- Zero runtime dependencies (JSZip is lazy-loaded only when you export)
- UI is fully isolated in a closed Shadow DOM, so it never touches your prototype's styles

### How it works

By default you only see a small **ruler button** (bottom-right). Click it (or press `Alt+Shift+R`) to open the side panel and enter Inspect mode:

- **Inspect** — click any element for box model, typography, colors, tokens, layout, forced states, and copyable CSS / Tailwind-ish snippets. Hover overlays and Alt-distance measurements stay on the canvas.
- **Comments** — add comments on the selected element. The list shows which component each comment belongs to; click one to scroll, select, and highlight it. Pins appear on commented elements while the panel is open. Comments persist in `localStorage` per page URL and are included in Export.
- **Export** — Assets ZIP, page-spec JSON, or HTML from the panel header.

Close the panel with the ✕ button or the ruler again. Grid lines, units, viewport info, and the shortcut cheat sheet live in the panel header (the old floating top toolbar is gone).

UI text uses an explicit sans-serif system stack inside the shadow root so host page fonts never leak in. The chrome is styled like the **Cursor editor**: near-black surfaces (`#181818` / `#1e1e1e`), subtle `#2a2a2a` borders, 6–8px radii, compact 12–13px type, underline tabs, ghost icon buttons, and a restrained accent — with soft shadows only on the floating ruler.

<!-- TODO: demo GIF (select → redlines → Alt distance → export) -->

---

## Quick start

### Script tag (CDN)

```html
<script src="https://unpkg.com/redline-inspect/dist/redline.iife.js" defer></script>
```

Auto-initialises. Configure with `data-*` attributes on the tag (`data-shortcut`, `data-start-active`, `data-show-fab`, `data-theme`, `data-units`, `data-panel-side`, `data-tailwind`), JSON in `data-config`, or `window.REDLINE_CONFIG`.

### npm

```bash
npm i -D redline-inspect
```

```ts
import { init } from 'redline-inspect';

const redline = init({ theme: 'auto', units: 'both' });
```

Ships ESM and CJS builds with TypeScript types.

### Vite plugin

```ts
// vite.config.ts
import redline from 'redline-inspect/vite';

export default {
  plugins: [redline()],
};
```

Injects the script **only during `vite dev`**. Pass `redline({ build: true })` to include it in builds too, which is handy for shared prototype links.

### Bookmarklet

A ready-made bookmarklet is generated at `dist/bookmarklet.txt` and shown on the demo page. It won't work on pages whose Content Security Policy blocks external scripts.

### URL overrides

- `?redline=1` starts in Inspect mode
- `?redline=0` doesn't mount redline at all

---

## Keyboard shortcuts

All shortcuts are configurable. On macOS they're shown as ⌥⇧.

| Keys | Action |
|---|---|
| `Alt+Shift+R` | Toggle panel / Inspect mode |
| `Esc` | Clear selection, then close panel |
| Click | Select element |
| `Shift+Click` | Pin up to 5 extra elements |
| Hold `Alt` + hover | Distance to hovered element |
| `↑ ↓ ← →` | Parent / first child / previous / next sibling |
| `Alt+Shift+E` | Export assets ZIP |
| `Alt+Shift+C` | Copy CSS of selection |
| `Alt+Shift+U` | Cycle units px → rem → both |
| `Alt+Shift+G` | Toggle grid / flex lines |
| `?` | Shortcut cheat sheet |

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Mount at all |
| `startActive` | `boolean` | `false` | Start in Inspect mode |
| `shortcut` | `string` | `'Alt+Shift+R'` | Toggle shortcut |
| `showFab` | `boolean` | `true` | Show the floating toggle button |
| `fabPosition` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Button position |
| `panelSide` | `'right' \| 'left'` | `'right'` | Side panel position |
| `panelMode` | `'push' \| 'overlay'` | `'push'` | Push page content aside (default) or overlay it |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | UI theme (Cursor-like dark by default) |
| `units` | `'px' \| 'rem' \| 'both'` | `'both'` | Units shown in labels and panel |
| `remBase` | `number \| 'auto'` | `'auto'` | Root font size for rem (auto = computed `html` font-size) |
| `tailwind` | `boolean` | `true` | Show the Tailwind-ish snippet tab |
| `tokenPrefixes` | `string[]` | all custom props | Limit token detection, e.g. `['--color-', '--space-']` |
| `breakpoints` | `Record<string, number>` | Tailwind `sm`–`2xl` | Override detected breakpoints |
| `ignore` | `string[]` | `[]` | Selectors that can never be selected |
| `assets.includeFonts` | `boolean` | `true` | Include fonts in the ZIP |
| `assets.includeFavicons` | `boolean` | `true` | Include favicons in the ZIP |
| `assets.sameOriginOnly` | `boolean` | `false` | Skip cross-origin assets |
| `assets.jszipUrl` | `string` | unpkg `jszip@3` | JSZip source (IIFE build only) |
| `assets.zipName` | `string` | `'<hostname>-assets.zip'` | Download filename |
| `onSelect` | `(spec: ElementSpec) => void` | — | Called when an element is selected |

### Instance API

```ts
const redline = init(config);

redline.toggle(force?: boolean);
redline.select(elOrSelector);
redline.getSpec(elOrSelector);      // same data as the panel
await redline.exportAssets();        // Blob (ZIP)
await redline.exportReport('json' | 'html');
redline.destroy();                   // restores the original DOM
```

`init()` is idempotent. In the IIFE build the instance is available as `window.redline`.

---

## For designers

### Leave notes with `data-spec*`

Annotate elements directly in your HTML and they'll show up as note cards at the top of the **Inspect** tab:

```html
<button
  data-spec="Primary CTA. Max 24 chars. Truncate with ellipsis."
  data-spec-state="Loading: spinner replaces label, width fixed"
  data-spec-behavior="Opens checkout drawer"
  data-spec-a11y="aria-label must include price"
  data-spec-link="https://figma.com/..."
>
  Buy now
</button>
```

Annotated elements get a badge dot while Inspect is on. For review feedback that isn't baked into the HTML, use the **Comments** tab — those persist in the browser and ship with Export.

### Use CSS variables for tokens

redline reads custom properties defined on `:root`, `html`, and `body`, then shows matching token names next to colors, lengths, and shadows (for example `--color-primary-600`). Exact matches show `=`; near colour matches show `≈`.

### Pause animations

Use the **Pause animations** toggle to freeze animations and transitions while developers measure.

---

## For developers

### Reading the panel

Click any element to see:

- **Box model overlay** in DevTools colors (content, padding, border, margin) with per-side values, a W × H badge, and red redlines to the parent's content box
- **Size and box**: dimensions, position, box-sizing, padding, margin, borders
- **Typography**: font stack plus the font actually rendered, size, weight, line-height, letter-spacing, and text color contrast with a WCAG AA/AAA badge
- **Colors**: HEX, `rgb()`, `hsl()`, alpha, gradient stops, and token names; click to copy
- **Effects**: radius, shadows, opacity, filters, transforms, blend modes
- **Layout**: display, position, flex and grid properties, gaps, and measured spacing between children
- **Responsive info** in the toolbar: viewport, DPR, zoom, and current breakpoint

All values are CSS px, with rem alongside when units is `both` (for example `24 · 1.5rem`).

### Copy code

The **Code** section has two tabs, each with a Copy button:

- **CSS**: only design-relevant, non-default declarations, using `var(--token)` when a token matches
- **Tailwind-ish**: a best-effort class list using Tailwind's default scale, with arbitrary values like `text-[13px]` otherwise. It's approximate.

### Forced states

Toggle `:hover`, `:focus`, `:focus-visible`, `:active`, `:disabled`, and `:checked` on the selected element (optionally its subtree too). redline clones the matching stylesheet rules into a temporary `<style data-redline-states>` and removes it cleanly when you're done.

### Asset ZIP

**Export → Assets ZIP** (or `Alt+Shift+E`) collects images and every `srcset` variant, `<picture>` sources, inline, external, and sprite SVGs (sanitized and sensibly named), CSS background images, favicons, `@font-face` fonts, and icon fonts.

```
<host>-assets.zip
├─ manifest.json   # page meta, every asset (source URL, size, density, usedBy), fonts, iconFonts, gradients, unfetchable, comments
├─ comments.json   # user comments from the Comments tab (same payload as in the manifest)
├─ README.txt      # anything that couldn't be fetched (or “All assets fetched successfully.”)
├─ icons/          # SVG icons, sprite symbols, icon-font glyph PNGs (under icons/glyphs/)
├─ images/         # raster images and larger SVGs
└─ fonts/          # woff2 / woff / ttf / otf
```

Assets blocked by CORS never break the export; they're listed in `manifest.unfetchable` with a reason. If JSZip cannot load, export falls back to a `manifest.json` Blob instead of a ZIP.

---

## Limitations

- **Cross-origin iframes** can't be inspected. Load redline inside the iframe instead.
- **Cross-origin stylesheets** can't be read, so their tokens and states aren't detected.
- **JS-driven states** (for example React `onMouseEnter` class toggles) can't be forced. Document them with `data-spec-state`.
- **CORS-blocked assets** may be skipped or exported as a lossy PNG via canvas.
- **Icon-font glyphs** are exported as PNG, not SVG.
- **Strict CSP** pages may block the CDN script, the bookmarklet, or lazy-loading JSZip. Install via npm in that case.
- Shadow-DOM-scoped styles of web components aren't covered by forced states in v1.

---

## Development

```bash
npm install
npm run dev     # demo page with known-value fixtures
npm test        # Vitest unit tests + Playwright e2e
npm run build   # ESM, CJS, IIFE, Vite plugin, and types in dist/
```

The core bundle is kept under **50 KB gzip** (excluding JSZip), enforced in CI with `size-limit`.

---

## Prior art and credits

Inspired by [Google ProjectVisBug](https://github.com/GoogleChromeLabs/ProjectVisBug), an excellent browser extension for inspecting and editing pages. redline differs by being embeddable (it ships with the prototype link), focusing on developer handoff, and including asset export. Any adapted snippets are attributed under VisBug's Apache-2.0 license.

## License

[MIT](./LICENSE) © Akhil Paul
