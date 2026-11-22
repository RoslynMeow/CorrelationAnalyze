<div align="center">
  <img src="docs/assets/banner.svg" alt="Correlation Analyzer" width="100%">
</div>

<h1 align="center">Correlation Analyzer</h1>

<p align="center">
  <strong>Drop in a CSV and get a correlation matrix, target ranking, distributions, radar profiles and copy-ready insights.</strong><br>
  Pure frontend · Offline · No uploads · Vue 3 + Vite + Plotly
</p>

<p align="center">
  <a href="https://roslynmeow.github.io/CorrelationAnalyze/"><img alt="Demo" src="https://img.shields.io/badge/demo-GitHub%20Pages-4c6ef5?style=flat-square&logo=githubpages&logoColor=white"></a>
  <a href="https://github.com/RoslynMeow/CorrelationAnalyze/actions/workflows/deploy.yml"><img alt="Deploy" src="https://github.com/RoslynMeow/CorrelationAnalyze/actions/workflows/deploy.yml/badge.svg"></a>
  <a href="https://github.com/RoslynMeow/CorrelationAnalyze/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/RoslynMeow/CorrelationAnalyze/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://github.com/users/RoslynMeow/projects/8"><img alt="Roadmap" src="https://img.shields.io/badge/roadmap-Projects-8250df?style=flat-square&logo=github"></a>
</p>

<p align="center"><a href="./README.md">简体中文</a> · <strong>English</strong></p>

---

## Live demo

**https://roslynmeow.github.io/CorrelationAnalyze/**

No install, no login, no upload. Any CSV works. To try it immediately, download the
[sample CSV](https://raw.githubusercontent.com/RoslynMeow/CorrelationAnalyze/main/tests/fixtures/sample.csv)
from the test fixtures.

## Features

| Tab | What it does |
| --- | --- |
| Overview | Dataset KPIs, top-10 association pairs, automatic summary |
| Matrix | Pearson / Spearman for numeric columns, Cramér's V for categorical ones, significance stars |
| Partial / VIF | Partial correlation matrix controlling up to 5 variables (collapsible floating picker); variance inflation factors for numeric columns |
| Target | Rank every column against a chosen target; r / ρ / η / V with p values, 95% CI and FDR correction |
| Scatter | X/Y/color/size, linear fit with R², slope CI and p value, date axis |
| Group | Box plots for multiple numeric variables by any group |
| Pairs | SPLOM matrix, up to 6 dimensions, colored by category |
| Distribution | Histogram + KDE, optional group overlay, adjustable bins |
| Category | Countplot, stacked subgroups, percentage mode, imbalance ratio |
| Radar | Group profiles with Min-Max or Z-Score normalization |
| Insights | Data quality, strongest links, target drivers, redundancy |
| Data | Search, pagination, header hover/tap column profiles, CSV export |

Tab navigation is always a dropdown, including wide screens, so long file names and narrow
windows no longer squeeze the tab bar.

Also included:

- Top bar keeps only the file name and a settings button; filters, presets, sharing and changing CSV live under Settings → Actions
- Control bars use inline labels and stay on one row on desktop; multi-select variable pickers collapse into one-line floating pickers
- Global row filter (category values, numeric / date ranges, AND combined); all statistics, charts, preview and share links use the filtered rows
- Settings drawer: theme tokens, density, radius, shadow, table styles
- 4 palette presets + custom palette; per-chart and per-series colors
- Per-chart width/height, presets, drag-to-resize, custom title / axis titles; the plot resizes independently while its card keeps filling the available height
- Column and category value display aliases (display only; stats use raw values)
- Per-file profiles keyed by CSV headers (aliases, sizes, titles, colors)
- All static UI text can be searched, edited and reset in Settings → Text
- Copy chart image, download PNG / SVG, copy data as TSV, copy insights
- Share link that restores the current tab, analysis selections and active row filter (load the same CSV to reproduce)
- Built-in presets (auto, student mental health) plus save / import / export
- Import / export settings as JSON; everything persisted locally

## Statistics

| Columns | Measure |
| --- | --- |
| numeric × numeric | **Pearson r** (default) or **Spearman ρ** |
| numeric × categorical | **correlation ratio η** = √(SS_between / SS_total), 0–1 |
| categorical × categorical | **Cramér's V** (chi-square based), 0–1 |

Missing values are handled pairwise. p values use the t test for r / ρ, chi-square for V and
one-way ANOVA F for η. Fisher z confidence intervals cover r / ρ; regression slopes use a
t-based interval. Target rankings and all variable pairs include Benjamini–Hochberg FDR
q values. Partial correlations residualize on up to 5 controls (standardized regression);
VIF = 1 / (1 − R²) flags multicollinearity (VIF < 5 normal, 5–10 watch, > 10 high).
Row filters keep matching rows before any statistic: category values match trimmed raw
strings, numeric / date ranges include their bounds, and missing values are excluded by
default. The implementation lives in `src/lib/stats.ts` and is validated against
pandas / scipy / statsmodels with a 1e-9 tolerance.

## Quick start

Requires **Node.js ≥ 20.19**.

```bash
git clone https://github.com/RoslynMeow/CorrelationAnalyze.git
cd CorrelationAnalyze
npm install
npm run dev          # http://localhost:5188
npm test             # 101 tests
npm run test:e2e     # Playwright browser tests
npm run build        # -> dist/
npm run build:single # -> dist-single/index.html (portable, offline)
```

The dev server uses port **5188** on purpose, to avoid clashing with other Vite projects.

## Project structure

```
src/
  App.vue            # tabs, drag & drop, settings drawer
  settings/          # settings schema, defaults, validation
  stores/            # dataset + settings (Pinia)
  lib/               # csv, infer, stats, chart theme, export
  workers/           # pairwise association worker
  components/        # PlotlyChart, SettingsDrawer, ...
  panels/            # 12 analysis tabs
tests/               # 101 tests + CSV fixture
e2e/                 # Playwright browser tests
.github/             # CI, Pages, issue/PR templates
```

## Testing

```bash
npm run typecheck
npm test          # unit tests
npm run test:e2e  # Playwright (run npx playwright install chromium once)
```

Covers statistics against pandas / scipy, CSV parsing and encodings, type inference,
settings and filters, plus browser flows for upload, tabs, search, downloads and dialogs.
Baseline examples:

| Metric | Value |
| --- | --- |
| Pearson r (stress_level × mental_health_index) | −0.974410393042 |
| Spearman ρ (same pair) | −0.946607341491 |
| η (stress_level grouped by risk_level) | 0.719637734744 |
| Cramér's V (gender × risk_level) | 0.183791360553 |
| Pearson p (stress_level × mental_health_index) | 1.08140841778e-19 |
| 95% CI (same pair) | −0.987883158842 ~ −0.946361416480 |
| R² (sleep_hours → stress_level) | 0.0435836813004 |
| η F-test p | 5.27974699208e-05 |
| Cramér's V chi-square p | 0.730837564067 |
| Partial r (stress × mental_health, controlling sleep_hours) | −0.973479978414 |
| VIF (age) | 2.36285825544 |

## Deployment

- `ci.yml` runs typecheck, tests and build on PRs / pushes
- `deploy.yml` builds `dist/` and publishes to GitHub Pages on `main`
- `base: './'` keeps every asset relative, so project pages and custom domains both work

## Roadmap

Full board: **https://github.com/users/RoslynMeow/projects/8**

- [x] CSV import: encodings, delimiters, type inference
- [x] r / ρ / V / η and target ranking
- [x] 12 analysis tabs
- [x] Appearance, palettes, per-chart sizes and titles, export, settings JSON
- [x] Web Worker, GitHub Pages, single-file build
- [x] Phase 2: column / value display aliases
- [x] Phase 2: per-file profiles
- [x] Phase 2: editable UI text dictionary
- [x] Phase 3: per-chart title and axis title editing
- [x] Phase 4: p values, 95% CI, R² and FDR correction
- [x] Phase 4: partial correlation matrix and VIF
- [x] Phase 4: shareable view links with the active filter
- [x] Phase 5: global row filter (category / numeric / date, AND combined)
- [x] Common dataset presets (auto / mental health / custom)

## Privacy

Files never leave the browser. All parsing, statistics and charting run locally; the app
works offline and offers a single-file build. Settings are stored in `localStorage` and can
be exported as JSON.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE) © 2026 RoslynMeow
