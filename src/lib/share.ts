import { sanitizePresets } from '@/presets/sanitize'
import type { PresetConfig } from '@/presets/types'
import type { FilterRule } from '@/types'

const MAX_LEN = 8000

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(raw: string): string {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export interface SharedView {
  tab: string
  view: PresetConfig
  filter?: FilterRule[]
}

function numOrNull(v: unknown): number | null {
  const n = Number(v)
  return v === null || v === '' || !Number.isFinite(n) ? null : n
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 120) : ''
}

/** 仅做结构清洗；列名与类型会在载入 CSV 后由 normalizeRules 再校验 */
function cleanRules(raw: unknown): FilterRule[] {
  if (!Array.isArray(raw)) return []
  const out: FilterRule[] = []
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const column = str(r.column)
    if (!column) continue
    if (r.type === 'number') {
      out.push({ type: 'number', column, min: numOrNull(r.min), max: numOrNull(r.max) })
    } else if (r.type === 'date') {
      out.push({ type: 'date', column, min: str(r.min), max: str(r.max) })
    } else if (r.type === 'category' && Array.isArray(r.values)) {
      out.push({
        type: 'category',
        column,
        values: r.values
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.slice(0, 120))
          .slice(0, 500),
        includeMissing: !!r.includeMissing,
      })
    }
  }
  return out
}

/** 把当前页签与视图选择编码进 URL 参数 */
export function encodeShare(
  tab: string,
  view: PresetConfig,
  filter: FilterRule[] = [],
): string {
  return toBase64Url(JSON.stringify({ v: 1, tab, view, filter }))
}

/** 解析并校验分享参数；损坏或超长时返回 null */
export function decodeShare(raw: string | null | undefined): SharedView | null {
  if (!raw || raw.length > MAX_LEN) return null
  try {
    const text = fromBase64Url(raw)
    if (text.length > MAX_LEN) return null
    const obj = JSON.parse(text) as {
      v?: unknown
      tab?: unknown
      view?: unknown
      filter?: unknown
    }
    if (!obj || obj.v !== 1 || typeof obj.tab !== 'string') return null
    const parsed = sanitizePresets([{ id: 'share', name: 'share', config: obj.view }])
    return {
      tab: obj.tab.trim().slice(0, 40),
      view: parsed[0]?.config ?? {},
      filter: cleanRules(obj.filter),
    }
  } catch {
    return null
  }
}

/** 构造不含旧参数与 hash 的分享链接 */
export function shareUrl(
  href: string,
  tab: string,
  view: PresetConfig,
  filter: FilterRule[] = [],
): string {
  const url = new URL(href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('view', encodeShare(tab, view, filter))
  return url.toString()
}
