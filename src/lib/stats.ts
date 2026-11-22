import type { Descriptive } from '@/types'

/** 描述统计；忽略 null / 非有限值 */
export function describe(arr: (number | null | undefined)[]): Descriptive | null {
  const a = arr.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  if (!a.length) return null
  const n = a.length
  const mean = a.reduce((s, v) => s + v, 0) / n
  const variance = a.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1)
  const sd = Math.sqrt(variance)
  const sorted = a.slice().sort((x, y) => x - y)
  const q = (p: number): number => {
    const pos = (n - 1) * p
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
  }
  return { n, mean, sd, min: sorted[0], max: sorted[n - 1], median: q(0.5), q1: q(0.25), q3: q(0.75) }
}

/** Pearson 相关系数；成对剔除缺失，n < 3 或方差为 0 返回 null */
export function pearson(x: (number | null)[], y: (number | null)[]): number | null {
  let n = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  const len = Math.min(x.length, y.length)
  for (let i = 0; i < len; i++) {
    const a = x[i]
    const b = y[i]
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue
    n++
    sx += a
    sy += b
    sxx += a * a
    syy += b * b
    sxy += a * b
  }
  if (n < 3) return null
  const num = sxy - (sx * sy) / n
  const den = Math.sqrt((sxx - (sx * sx) / n) * (syy - (sy * sy) / n))
  if (!den) return null
  const r = num / den
  return Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null
}

/** 秩（平均并列名次），用于 Spearman */
export function ranks(arr: (number | null)[]): (number | null)[] {
  const idx: [number, number][] = []
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (v !== null && Number.isFinite(v)) idx.push([v, i])
  }
  idx.sort((a, b) => a[0] - b[0])
  const out: (number | null)[] = new Array(arr.length).fill(null)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[idx[k][1]] = r
    i = j + 1
  }
  return out
}

export function spearman(x: (number | null)[], y: (number | null)[]): number | null {
  return pearson(ranks(x), ranks(y))
}

/** Cramér's V（类别 × 类别），基于卡方，0–1 */
export function cramersV(
  a: (string | null)[],
  b: (string | null)[],
): { v: number; n: number } | null {
  const cells = new Map<string, number>()
  const ra = new Map<string, number>()
  const cb = new Map<string, number>()
  let n = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i]
    const y = b[i]
    if (x === null || y === null || x === undefined || y === undefined) continue
    n++
    ra.set(x, (ra.get(x) || 0) + 1)
    cb.set(y, (cb.get(y) || 0) + 1)
    const k = x + '\u0001' + y
    cells.set(k, (cells.get(k) || 0) + 1)
  }
  if (n < 4) return null
  const r = ra.size
  const c = cb.size
  if (r < 2 || c < 2) return null
  let chi2 = 0
  ra.forEach((rx, x) => {
    cb.forEach((cy, y) => {
      const o = cells.get(x + '\u0001' + y) || 0
      const e = (rx * cy) / n
      if (e > 0) chi2 += ((o - e) * (o - e)) / e
    })
  })
  const denom = n * Math.min(r - 1, c - 1)
  if (denom <= 0) return null
  const v = Math.sqrt(chi2 / denom)
  if (!Number.isFinite(v)) return null
  return { v: Math.max(0, Math.min(1, v)), n }
}

/** 相关比 η²（数值 × 类别） */
export function etaStats(
  nums: (number | null)[],
  labels: (string | null)[],
): { e2: number; n: number } | null {
  const groups = new Map<string, { n: number; s: number }>()
  let n = 0
  let sum = 0
  let sum2 = 0
  const len = Math.min(nums.length, labels.length)
  for (let i = 0; i < len; i++) {
    const v = nums[i]
    const g = labels[i]
    if (v === null || g === null || v === undefined || g === undefined) continue
    n++
    sum += v
    sum2 += v * v
    let gr = groups.get(g)
    if (!gr) {
      gr = { n: 0, s: 0 }
      groups.set(g, gr)
    }
    gr.n++
    gr.s += v
  }
  if (n < 3 || groups.size < 2) return null
  const gm = sum / n
  const sst = sum2 - n * gm * gm
  if (!(sst > 0)) return null
  let ssb = 0
  groups.forEach((gr) => {
    const m = gr.s / gr.n
    ssb += gr.n * (m - gm) * (m - gm)
  })
  return { e2: Math.max(0, Math.min(1, ssb / sst)), n }
}

/** 一元线性回归 y = a + b·x */
export function linreg(
  x: (number | null)[],
  y: (number | null)[],
): { a: number; b: number; n: number; r: number | null } | null {
  let n = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < x.length; i++) {
    const a = x[i]
    const b = y[i]
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue
    n++
    sx += a
    sy += b
    sxx += a * a
    sxy += a * b
  }
  if (n < 3) return null
  const den = n * sxx - sx * sx
  if (!den) return null
  const b = (n * sxy - sx * sy) / den
  const a = (sy - b * sx) / n
  return { a, b, n, r: pearson(x, y) }
}

/** 高斯核密度估计（Scott 经验带宽，0.9 修正） */
export function kde(values: number[], xs: number[], bandwidth?: number): number[] {
  const n = values.length
  if (n < 2) return xs.map(() => 0)
  const m = values.reduce((s, v) => s + v, 0) / n
  const sd =
    Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1
  const sorted = values.slice().sort((a, b) => a - b)
  const interq = sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)]
  let h = bandwidth || 0.9 * Math.min(sd, interq / 1.34 || sd) * Math.pow(n, -1 / 5)
  if (!h || !Number.isFinite(h) || h <= 0) h = sd / 3 || 1
  const norm = 1 / (n * h * Math.sqrt(2 * Math.PI))
  return xs.map((x) => {
    let s = 0
    for (let i = 0; i < n; i++) {
      const z = (x - values[i]) / h
      s += Math.exp(-0.5 * z * z)
    }
    return s * norm
  })
}
