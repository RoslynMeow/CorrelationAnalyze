import { t } from '@/i18n'

export function detectDelim(text: string): string {
  const line = text.split('\n').find((l) => l.trim() !== '') || ''
  const cands = [',', ';', '\t', '|']
  let best = ','
  let bestN = -1
  for (const d of cands) {
    let n = 0
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') inQ = !inQ
      else if (c === d && !inQ) n++
    }
    if (n > bestN) {
      bestN = n
      best = d
    }
  }
  return best
}

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
  delim: string
}

export function parseCSV(text: string): ParsedCsv {
  text = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const delim = detectDelim(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQ = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQ = true
      i++
      continue
    }
    if (ch === delim) {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += ch
    i++
  }
  row.push(field)
  rows.push(row)

  const clean = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
  if (clean.length < 2) throw new Error(t('CSV 至少需要一行表头 + 一行数据'))

  const seen: Record<string, number> = Object.create(null)
  const headers = clean[0].map((h, idx) => {
    let name = String(h).trim() || '列' + (idx + 1)
    if (seen[name]) {
      seen[name]++
      name = name + '_' + seen[name]
    } else seen[name] = 1
    return name
  })

  const data = clean.slice(1).map((r) => headers.map((_, ci) => (r[ci] === undefined ? '' : r[ci])))
  return { headers, rows: data, delim }
}

/** 按 BOM / UTF-8 合法性探测编码，失败时回退 GB18030 */
export function decodeBuffer(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  if (b.length > 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(b.subarray(3))
  }
  if (b.length > 2 && b[0] === 0xff && b[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(b)
  }
  if (b.length > 2 && b[0] === 0xfe && b[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(b)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(b)
    } catch {
      return new TextDecoder('utf-8').decode(b)
    }
  }
}

export async function readTextSmart(file: File): Promise<string> {
  return decodeBuffer(await file.arrayBuffer())
}
