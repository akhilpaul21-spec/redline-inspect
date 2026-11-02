# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-11-01

### Fixed

- Closed side panel no longer paints a translucent ghost (author `display:flex` was overriding `[hidden]`)
- Comments list updates immediately after Add; hover no longer rebuilds the panel and wipes the draft
- Comment pins render whenever the panel is open; keyboard input in the panel is not stolen by Inspect shortcuts
- Panel/FAB inherit Cursor theme tokens from `:host` (they sit outside `.rl-root`)

### Added

- `panelMode: 'push' | 'overlay'` (default `push`) — docks the panel by shrinking `html` once to `calc(100vw - panelWidth)` so the page’s right edge stays inspectable

### Fixed

- Push mode no longer double-shrinks the page (html margin + body width) which left a blank white strip beside the panel
- Box-model overlay fills use ~0.4 alpha so text under them stays readable; outlines, redlines, and labels stay opaque

### Changed

- Chrome restyled to match Cursor IDE: near-black surfaces, subtle borders, compact density, underline tabs, ghost buttons, dark rounded FAB

## [0.2.0] - 2026-11-01

### Changed

- Default UI is FAB-only; the floating top toolbar is removed
- Side panel opens from the ruler with **Inspect** and **Comments** tabs plus Export in the header
- Grid / units / viewport / help live in the panel header
- Shadow DOM UI forces a sans-serif system font stack so host fonts cannot leak in

### Added

- User comments on selected elements, persisted in `localStorage` per page URL, with canvas pins
- Comments included in asset ZIP (`comments.json` + manifest) and page-spec export

## [0.1.0] - 2026-10-31

### Added

- Initial `redline-inspect` v1 implementation
- Public API: `init`, `destroy`, `toggle`, `select`, `getSpec`, `exportAssets`, `exportReport`
- Shadow DOM UI with FAB, inspect overlays, toolbar, and side panel / bottom sheet
- Box-model overlays (content / padding / border / margin), parent spacing, Alt-hover distances, pin
- Typography, colors (hex/rgb/hsl + contrast), tokens, effects, layout (flex/grid), notes (`data-spec*`)
- Forced pseudo-states via stylesheet rule cloning
- CSS + Tailwind-ish snippets with copy
- Asset ZIP export (lazy JSZip) with manifest, CORS fallbacks, SVG sanitize
- Vite plugin (dev-only injection by default), IIFE auto-init, bookmarklet
- Demo fixture page, Vitest unit tests, Playwright e2e, size-limit CI (≤ 50 KB gzip core)

[0.2.1]: https://github.com/akhilpaul21-spec/redline-inspect/releases/tag/v0.2.1
[0.2.0]: https://github.com/akhilpaul21-spec/redline-inspect/releases/tag/v0.2.0
[0.1.0]: https://github.com/akhilpaul21-spec/redline-inspect/releases/tag/v0.1.0
