# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/akhilpaul21-spec/redline-inspect/releases/tag/v0.1.0
