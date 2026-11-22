import { sanitizePresets } from '@/presets/sanitize'
import type { PresetConfig } from '@/presets/types'

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
}

/** 把当前页签与视图选择编码进 URL 参数 */
export function encodeShare(tab: string, view: PresetConfig): string {
  return toBase64Url(JSON.stringify({ v: 1, tab, view }))
}

/** 解析并校验分享参数；损坏或超长时返回 null */
export function decodeShare(raw: string | null | undefined): SharedView | null {
  if (!raw || raw.length > MAX_LEN) return null
  try {
    const text = fromBase64Url(raw)
    if (text.length > MAX_LEN) return null
    const obj = JSON.parse(text) as { v?: unknown; tab?: unknown; view?: unknown }
    if (!obj || obj.v !== 1 || typeof obj.tab !== 'string') return null
    const parsed = sanitizePresets([{ id: 'share', name: 'share', config: obj.view }])
    return {
      tab: obj.tab.trim().slice(0, 40),
      view: parsed[0]?.config ?? {},
    }
  } catch {
    return null
  }
}

/** 构造不含旧参数与 hash 的分享链接 */
export function shareUrl(href: string, tab: string, view: PresetConfig): string {
  const url = new URL(href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('view', encodeShare(tab, view))
  return url.toString()
}
