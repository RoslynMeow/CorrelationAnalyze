# Changelog

## Unreleased

### Added

- p values for r / ρ (t test), Cramér's V (chi-square) and η (one-way ANOVA F)
- Fisher z 95% confidence intervals for r / ρ, slope CI, R² and slope p value in regressions
- Benjamini–Hochberg FDR q values for target rankings and all variable pairs
- Optional significance stars in the correlation matrix
- Significance counts and p / q / CI details in target associations, scatter notes and insights
- Per-chart legend position override (bottom / top / right / hidden)
- Chart panels fill the available viewport height on desktop; grouped charts use an internally scrolling grid
- Chunked data search (roughly 8 ms per frame) with live progress, so typing stays responsive on 100k rows
- Insight cards use a 2–3 column grid with an internally scrolling main area on desktop
- Dialog focus trap and Esc-to-close for settings, report, presets, chart popovers and app menus
- Playwright E2E suite for upload, tab switching, matrix stars, search/export, PNG download, dialogs and report generation
- Partial correlation matrix controlling up to 5 numeric variables (standardized residualization, t-test p values)
- VIF multicollinearity panel with normal / watch / high tiers and collinearity notes
- Shareable view links (`?view=…`) that restore the current tab and analysis selections after loading the same CSV
- Report dialog with custom title, subtitle and notes, rendered into the HTML / PDF export

### Changed

- Plotly is lazy-loaded (first-screen JS drops from ~4.9 MB to ~250 KB) and prefetched after CSV load
- Mobile keeps natural page scrolling and fixed chart heights instead of compressing to one screen

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
- Mobile typography and touch targets scale up below 760px; charts use full width and viewport heights
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
