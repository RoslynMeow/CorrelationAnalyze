const NULLS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', 'nil', '-', '--', '?', '#n/a'])

export const DATE_RE =
  /^(\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?([ T]\d{1,2}:\d{2}(:\d{2})?)?|\d{1,2}[-/]\d{1,2}[-/]\d{4})$/

export function isNull(v: unknown): boolean {
  if (v === null || v === undefined) return true
  return NULLS.has(String(v).trim().toLowerCase())
}

export function toNum(v: unknown): number | null {
  if (isNull(v)) return null
  const s = String(v).trim().replace(/,/g, '').replace(/^[¥$€£]\s*/, '').replace(/%$/, '')
  if (s === '' || isNaN(Number(s))) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function toTime(v: unknown): number | null {
  if (isNull(v)) return null
  const s = String(v).trim()
  if (!DATE_RE.test(s)) return null
  const t = Date.parse(s.replace(/\//g, '-').replace(/\./g, '-'))
  return Number.isFinite(t) ? t : null
}

/** 图表 / 表格用的紧凑数字格式 */
export function fmt(v: number | null | undefined, d = 3): string {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '—'
  if (typeof v !== 'number') return String(v)
  const a = Math.abs(v)
  if (a !== 0 && (a < 1e-3 || a >= 1e7)) return v.toExponential(2)
  return String(+v.toFixed(d))
}

export const fmtInt = (n: number): string => Number(n).toLocaleString('zh-CN')

/** p 值：过小用 <0.001，其余保留 3 位 */
export function fmtP(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—'
  if (p < 0.001) return '<0.001'
  return p.toFixed(3)
}

export function countBy<T extends string | number>(arr: T[]): Record<string, number> {
  const m: Record<string, number> = Object.create(null)
  for (const v of arr) {
    const k = String(v)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

export const uniq = <T,>(arr: T[]): T[] => Array.from(new Set(arr))

export const shortName = (s: string, n = 12): string =>
  s.length > n ? s.slice(0, n - 1) + '…' : s

/** 把二维数组导出为 CSV（带 BOM，便于 Excel 打开） */
export function downloadCsv(rows: (string | number)[][], filename = 'export.csv'): void {
  const lines = rows.map((r) =>
    r
      .map((v) => {
        const s = String(v ?? '')
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      })
      .join(','),
  )
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
