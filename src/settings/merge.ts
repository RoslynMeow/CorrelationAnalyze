import { isHexColor } from '@/lib/color'
import {
  defaultSettings,
  DEFAULT_HEATMAP,
  type ChartSize,
  type ChartTitle,
  type ColorToken,
  type Settings,
  TOKEN_VARS,
} from './defaults'

const MODES = ['light', 'dark', 'system'] as const
const DENSITIES = ['compact', 'normal', 'comfortable'] as const
const SHADOWS = ['none', 'soft', 'strong'] as const
const FORMATS = ['png', 'svg'] as const
const LEGEND_POSITIONS = ['bottom', 'top', 'right', 'hidden'] as const

type AnyRec = Record<string, unknown>

const isRec = (v: unknown): v is AnyRec => !!v && typeof v === 'object' && !Array.isArray(v)

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

function clamped(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, v))
}

function color(v: unknown, fallback: string | null): string | null {
  return isHexColor(v) ? v : fallback
}

function stringMap(v: unknown, maxKeys = 300): Record<string, string> {
  if (!isRec(v)) return {}
  const out: Record<string, string> = {}
  let n = 0
  for (const [k, val] of Object.entries(v)) {
    if (n >= maxKeys) break
    if (typeof val === 'string' && val.trim()) {
      out[k] = val.slice(0, 500)
      n++
    }
  }
  return out
}

/** 合并用户配置与默认值，并校验所有字段；纯函数，便于测试 */
export function mergeSettings(raw: unknown): Settings {
  const d = defaultSettings()
  if (!isRec(raw)) return d
  const r = raw

  /* ---------- appearance ---------- */
  const ap = isRec(r.appearance) ? r.appearance : {}
  const colorsIn = isRec(ap.colors) ? ap.colors : {}
  const colors: Settings['appearance']['colors'] = {}
  for (const key of Object.keys(TOKEN_VARS) as ColorToken[]) {
    const v = colorsIn[key]
    if (isHexColor(v)) colors[key] = v
  }
  const radiusRaw = ap.radius
  const radius =
    radiusRaw === null || radiusRaw === undefined ? null : clamped(radiusRaw, 0, 28)

  /* ---------- table ---------- */
  const tb = isRec(r.table) ? r.table : {}

  /* ---------- charts ---------- */
  const ch = isRec(r.charts) ? r.charts : {}
  const paletteIn = Array.isArray(ch.palette)
    ? ch.palette.filter((c): c is string => isHexColor(c)).slice(0, 24)
    : []
  const palette = paletteIn.length >= 2 ? paletteIn : [...d.charts.palette]

  const hm = isRec(ch.heatmap) ? ch.heatmap : {}
  const heatmap = {
    neg: color(hm.neg, DEFAULT_HEATMAP.neg) as string,
    mid: color(hm.mid, DEFAULT_HEATMAP.mid) as string,
    pos: color(hm.pos, DEFAULT_HEATMAP.pos) as string,
    low: color(hm.low, DEFAULT_HEATMAP.low) as string,
    high: color(hm.high, DEFAULT_HEATMAP.high) as string,
  }

  const seriesIn = isRec(ch.series) ? ch.series : {}
  const series: Record<string, Record<string, string>> = {}
  let chartsSeen = 0
  for (const [chartId, map] of Object.entries(seriesIn)) {
    if (chartsSeen >= 40) break
    if (!isRec(map)) continue
    const clean: Record<string, string> = {}
    for (const [name, c] of Object.entries(map)) {
      if (isHexColor(c)) clean[name.slice(0, 120)] = c
    }
    if (Object.keys(clean).length) {
      series[chartId.slice(0, 80)] = clean
      chartsSeen++
    }
  }

  const sizesIn = isRec(ch.sizes) ? ch.sizes : {}
  const sizes: Record<string, ChartSize> = {}
  let sizeSeen = 0
  for (const [chartId, size] of Object.entries(sizesIn)) {
    if (sizeSeen >= 40 || !isRec(size)) continue
    const clean: ChartSize = {}
    if (typeof size.width === 'number') {
      const w = clamped(size.width, 280, 1600)
      if (w !== null) clean.width = w
    }
    if (typeof size.height === 'number') {
      const h = clamped(size.height, 200, 1200)
      if (h !== null) clean.height = h
    }
    if (Object.keys(clean).length) {
      sizes[chartId.slice(0, 80)] = clean
      sizeSeen++
    }
  }

  const titlesIn = isRec(ch.titles) ? ch.titles : {}
  const titles: Record<string, ChartTitle> = {}
  let titleSeen = 0
  for (const [chartId, rawTitle] of Object.entries(titlesIn)) {
    if (titleSeen >= 40 || !isRec(rawTitle)) continue
    const clean: ChartTitle = {}
    if (typeof rawTitle.title === 'string' && rawTitle.title.trim()) {
      clean.title = rawTitle.title.slice(0, 120)
    }
    if (typeof rawTitle.xTitle === 'string' && rawTitle.xTitle.trim()) {
      clean.xTitle = rawTitle.xTitle.slice(0, 120)
    }
    if (typeof rawTitle.yTitle === 'string' && rawTitle.yTitle.trim()) {
      clean.yTitle = rawTitle.yTitle.slice(0, 120)
    }
    if (Object.keys(clean).length) {
      titles[chartId.slice(0, 80)] = clean
      titleSeen++
    }
  }

  /* ---------- export ---------- */
  const ex = isRec(r.exportSettings) ? r.exportSettings : {}
  const exportSettings: Settings['exportSettings'] = {
    format: pickEnum(ex.format, FORMATS, d.exportSettings.format),
    scale: clamped(ex.scale, 1, 4) ?? d.exportSettings.scale,
  }

  /* ---------- text / data（第 2 期用，先保留结构） ---------- */
  const textIn = isRec(r.text) ? r.text : {}
  const dataIn = isRec(r.data) ? r.data : {}
  const valueAliasesIn = isRec(dataIn.valueAliases) ? dataIn.valueAliases : {}
  const valueAliases: Record<string, Record<string, string>> = {}
  for (const [col, map] of Object.entries(valueAliasesIn)) {
    if (isRec(map)) valueAliases[col] = stringMap(map, 120)
  }

  return {
    version: 1,
    appearance: {
      mode: pickEnum(ap.mode, MODES, d.appearance.mode),
      colors,
      radius,
      density: pickEnum(ap.density, DENSITIES, d.appearance.density),
      shadow: pickEnum(ap.shadow, SHADOWS, d.appearance.shadow),
    },
    table: {
      headerBg: color(tb.headerBg, null),
      border: color(tb.border, null),
      zebra: typeof tb.zebra === 'boolean' ? tb.zebra : d.table.zebra,
      fontSize: tb.fontSize === null || tb.fontSize === undefined ? null : clamped(tb.fontSize, 9, 18),
    },
    charts: {
      palette,
      heatmap,
      grid: typeof ch.grid === 'boolean' ? ch.grid : d.charts.grid,
      transparent: typeof ch.transparent === 'boolean' ? ch.transparent : d.charts.transparent,
      showModeBar:
        typeof ch.showModeBar === 'boolean' ? ch.showModeBar : d.charts.showModeBar,
      legendPosition: pickEnum(
        ch.legendPosition,
        LEGEND_POSITIONS,
        d.charts.legendPosition,
      ),
      defaultWidth:
        ch.defaultWidth === null || ch.defaultWidth === undefined
          ? null
          : clamped(ch.defaultWidth, 280, 1600),
      sizes,
      titles,
      series,
    },
    exportSettings,
    text: { overrides: stringMap(textIn.overrides, 600) },
    data: {
      columnAliases: stringMap(dataIn.columnAliases, 300),
      valueAliases,
    },
  }
}
