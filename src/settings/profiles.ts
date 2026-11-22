import { isHexColor } from '@/lib/color'
import type { ChartSize, ChartTitle, FileProfile, Profiles } from './defaults'

const MAX_PROFILES = 80

type AnyRec = Record<string, unknown>
const isRec = (v: unknown): v is AnyRec => !!v && typeof v === 'object' && !Array.isArray(v)

/** 用完整表头作为“同一个文件”的签名（列名 + 列顺序） */
export function profileKey(headers: string[]): string {
  return headers.join('\u0001')
}

export function emptyProfile(name = ''): FileProfile {
  return {
    name,
    updatedAt: Date.now(),
    columnAliases: {},
    valueAliases: {},
    series: {},
    sizes: {},
    titles: {},
  }
}

function stringMap(v: unknown, maxKeys = 300): Record<string, string> {
  if (!isRec(v)) return {}
  const out: Record<string, string> = {}
  let n = 0
  for (const [k, val] of Object.entries(v)) {
    if (n >= maxKeys) break
    if (typeof val === 'string' && val.trim()) {
      out[k] = val.trim().slice(0, 120)
      n++
    }
  }
  return out
}

function clamp(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, Math.round(v)))
}

function sanitizeSizes(v: unknown): Record<string, ChartSize> {
  if (!isRec(v)) return {}
  const out: Record<string, ChartSize> = {}
  let n = 0
  for (const [id, raw] of Object.entries(v)) {
    if (n >= 40 || !isRec(raw)) continue
    const size: ChartSize = {}
    const w = clamp(raw.width, 280, 1600)
    const h = clamp(raw.height, 200, 1200)
    if (w !== null) size.width = w
    if (h !== null) size.height = h
    if (Object.keys(size).length) {
      out[id.slice(0, 80)] = size
      n++
    }
  }
  return out
}

function sanitizeTitles(v: unknown): Record<string, ChartTitle> {
  if (!isRec(v)) return {}
  const out: Record<string, ChartTitle> = {}
  let n = 0
  for (const [id, raw] of Object.entries(v)) {
    if (n >= 40 || !isRec(raw)) continue
    const title: ChartTitle = {}
    for (const key of ['title', 'xTitle', 'yTitle'] as const) {
      const text = raw[key]
      if (typeof text === 'string' && text.trim()) title[key] = text.trim().slice(0, 120)
    }
    if (Object.keys(title).length) {
      out[id.slice(0, 80)] = title
      n++
    }
  }
  return out
}

function sanitizeSeries(v: unknown): Record<string, Record<string, string>> {
  if (!isRec(v)) return {}
  const out: Record<string, Record<string, string>> = {}
  let n = 0
  for (const [id, raw] of Object.entries(v)) {
    if (n >= 40 || !isRec(raw)) continue
    const map: Record<string, string> = {}
    for (const [name, color] of Object.entries(raw)) {
      if (isHexColor(color)) map[name.slice(0, 120)] = color
    }
    if (Object.keys(map).length) {
      out[id.slice(0, 80)] = map
      n++
    }
  }
  return out
}

/** 校验从 localStorage / 配置 JSON 读取的文件配置 */
export function sanitizeProfiles(raw: unknown): Profiles {
  if (!isRec(raw)) return {}
  const out: Profiles = {}
  let n = 0
  for (const [key, val] of Object.entries(raw)) {
    if (n >= MAX_PROFILES || !isRec(val)) continue
    const valueAliases: Record<string, Record<string, string>> = {}
    if (isRec(val.valueAliases)) {
      for (const [col, map] of Object.entries(val.valueAliases)) {
        if (isRec(map)) valueAliases[col] = stringMap(map, 120)
      }
    }
    out[key] = {
      name: typeof val.name === 'string' ? val.name.slice(0, 200) : '',
      updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : Date.now(),
      columnAliases: stringMap(val.columnAliases),
      valueAliases,
      series: sanitizeSeries(val.series),
      sizes: sanitizeSizes(val.sizes),
      titles: sanitizeTitles(val.titles),
    }
    n++
  }
  return out
}
