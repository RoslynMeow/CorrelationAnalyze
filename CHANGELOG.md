# Changelog

## 2.0.0 — 2026-11-22

### Added

- Vue 3 + Vite + TypeScript + Pinia rewrite of the v1 single-file dashboard
- 11 analysis tabs, including the 3 views v1 was missing (distribution, category counts, radar)
- Settings drawer: color tokens, density, radius, shadow, table styles, chart width cap
- 4 palette presets + custom palette, heatmap colors, per-chart size and per-series colors
- Per-chart title / axis title overrides
- Column and category value display aliases (display only)
- Per-file profiles keyed by CSV headers: aliases, chart sizes, titles and colors
- Editable UI text catalog with search, per-key overrides and reset
- Full-page HTML report of selected tabs with 2x chart images; print to PDF
- Built-in presets, custom preset save/import/export
- Responsive app bar: secondary actions collapse below 1280px; tabs become a dropdown navigator below 900px
- Data preview fills the viewport with an internally scrolling table; column profiles open from header hover/tap
- Legend position setting (bottom / top / right / hidden) with automatic margins to avoid axis-title overlap
- Drag-to-resize charts with live CSS preview
- Per-chart toolbar: copy image, PNG, SVG, TSV, reset zoom, chart settings
- Copy insights as plain text; import/export settings as JSON
- Web Worker for pairwise associations with main-thread fallback
- Vitest suite validated against pandas / scipy
- GitHub Actions CI and GitHub Pages deployment
- Single-file build with inlined JS/CSS/Plotly/Worker

### Changed

- Default theme follows the operating system
- Plotly's own modebar is hidden by default; the app toolbar is the primary control surface
- Matrix sizing adapts to the number of columns instead of filling the card
- Sample data removed from the app; users provide their own CSV

### Removed

- v1 single-file HTML, old README and the original notebook from the repository

## 1.0.0 — 2026-11-21

- Initial single-file CSV exploration/correlation dashboard (kept as history, no longer in the repo)
