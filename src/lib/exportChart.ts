import Plotly from 'plotly.js-dist-min'

async function toDataUrl(
  el: HTMLElement,
  format: 'png' | 'svg',
  scale: number,
): Promise<string> {
  const rect = el.getBoundingClientRect()
  const width = Math.max(320, Math.round(rect.width) || 800)
  const height = Math.max(220, Math.round(rect.height) || 500)
  const opts: Record<string, unknown> = { format, width, height }
  if (format === 'png') opts.scale = scale
  return Plotly.toImage(el, opts)
}

export async function chartImage(
  el: HTMLElement,
  format: 'png' | 'svg',
  scale = 2,
): Promise<string> {
  return toDataUrl(el, format, scale)
}

export function downloadDataUrl(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '') || 'chart'
}

/** 把 PNG dataURL 写入剪贴板；不支持时返回 false */
export async function copyImageUrl(url: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
    const blob = await (await fetch(url)).blob()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 回退到 execCommand */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

const MAX_ROWS = 20000

const cell = (v: unknown): string => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')

function axisTitle(layout: Record<string, unknown> | undefined, axis: 'x' | 'y'): string {
  const a = layout?.[axis] as { title?: unknown } | undefined
  const t = a?.title
  if (typeof t === 'string') return t
  if (t && typeof t === 'object' && typeof (t as { text?: unknown }).text === 'string') {
    return (t as { text: string }).text
  }
  return axis
}

interface Trace {
  type?: string
  name?: string
  x?: unknown[]
  y?: unknown[]
  z?: unknown[][]
  theta?: unknown[]
  r?: unknown[]
  orientation?: string
  dimensions?: { label?: string; values?: unknown[] }[]
}

/** 把图表 traces 转成 TSV，便于粘进 Excel / 飞书表格 */
export function tracesToTsv(
  traces: unknown[],
  layout?: Record<string, unknown>,
): string {
  const list = traces as Trace[]
  if (!list.length) return ''
  const first = list[0]
  const rows: unknown[][] = []

  if (first.type === 'heatmap' && Array.isArray(first.z)) {
    const x = first.x || []
    const y = first.y || []
    rows.push(['', ...x.map(cell)])
    first.z.slice(0, MAX_ROWS).forEach((row, i) => {
      rows.push([cell(y[i]), ...row.map((v) => (v === null || v === undefined ? '' : cell(v)))])
    })
  } else if (first.type === 'splom' && first.dimensions) {
    const dims = first.dimensions
    rows.push(dims.map((d) => cell(d.label)))
    const n = Math.min(dims[0]?.values?.length || 0, MAX_ROWS)
    for (let i = 0; i < n; i++) rows.push(dims.map((d) => d.values?.[i] ?? ''))
  } else if (first.type === 'scatterpolar') {
    rows.push(['系列', '维度', '值'])
    for (const t of list) {
      ;(t.theta || []).forEach((th, i) => {
        rows.push([cell(t.name), cell(th), t.r?.[i] ?? ''])
      })
    }
  } else if (first.type === 'box') {
    rows.push(['系列', '值'])
    for (const t of list) for (const v of t.y || []) rows.push([cell(t.name), v])
  } else if (first.type === 'histogram') {
    rows.push(['系列', '值'])
    for (const t of list) for (const v of t.x || []) rows.push([cell(t.name), v])
  } else if (first.type === 'bar' && first.orientation === 'h') {
    const multi = list.length > 1 || list.some((t) => t.name)
    const header = multi
      ? ['系列', axisTitle(layout, 'y'), axisTitle(layout, 'x')]
      : [axisTitle(layout, 'y'), axisTitle(layout, 'x')]
    rows.push(header)
    for (const t of list) {
      const ys = t.y || []
      const xs = t.x || []
      const n = Math.min(Math.max(ys.length, xs.length), MAX_ROWS)
      for (let i = 0; i < n; i++) {
        rows.push(
          multi ? [cell(t.name), cell(ys[i]), xs[i] ?? ''] : [cell(ys[i]), xs[i] ?? ''],
        )
      }
    }
  } else {
    const multi = list.length > 1 || list.some((t) => t.name)
    rows.push(
      multi
        ? ['系列', axisTitle(layout, 'x'), axisTitle(layout, 'y')]
        : [axisTitle(layout, 'x'), axisTitle(layout, 'y')],
    )
    for (const t of list) {
      const xs = t.x || []
      const ys = t.y || []
      const n = Math.min(Math.max(xs.length, ys.length), MAX_ROWS)
      for (let i = 0; i < n; i++) {
        rows.push(
          multi
            ? [cell(t.name), xs[i] ?? '', ys[i] ?? '']
            : [xs[i] ?? '', ys[i] ?? ''],
        )
      }
    }
  }

  return rows.map((r) => r.map(cell).join('\t')).join('\n')
}
