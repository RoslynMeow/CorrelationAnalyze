import type { Descriptive } from '@/types'

/* ================= 分布函数（t / F / 卡方） ================= */

/** Lanczos 近似 log Γ(x) */
export function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const c of cof) {
    y += 1
    ser += c / y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** 不完全 Beta 连分式（Numerical Recipes betacf） */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300
  const EPS = 3e-14
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** 正则化不完全 Beta I_x(a, b) */
export function betai(a: number, b: number, x: number): number {
  if (!(a > 0) || !(b > 0)) return NaN
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
  )
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** 标准正态分位数（Acklam 近似，误差 < 1.2e-9） */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ]
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  let q: number
  let r: number
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  q = p - 0.5
  r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

/** t 分布双侧 p 值 */
export function studentTTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0
  if (!(df > 0)) return NaN
  const x = df / (df + t * t)
  return Math.max(0, Math.min(1, betai(df / 2, 0.5, x)))
}

/** t 分布临界值（双侧） */
export function studentTCritical(df: number, conf = 0.95): number {
  if (!(df > 0)) return NaN
  const alpha = 1 - conf
  let lo = 0
  let hi = 200
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (studentTTwoSidedP(mid, df) > alpha) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** 正则化不完全 Gamma P(a, x)（级数） */
function gser(a: number, x: number): number {
  const EPS = 3e-14
  const MAXIT = 500
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 1; n <= MAXIT; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * EPS) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
}

/** 正则化不完全 Gamma Q(a, x)（连分式） */
function gcf(a: number, x: number): number {
  const EPS = 3e-14
  const FPMIN = 1e-300
  const MAXIT = 500
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= MAXIT; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

/** 正则化上不完全 Gamma Q(a, x) */
export function gammaQ(a: number, x: number): number {
  if (!(a > 0) || x < 0) return NaN
  if (x === 0) return 1
  return x < a + 1 ? 1 - gser(a, x) : gcf(a, x)
}

/** 卡方分布上尾 p 值 */
export function chi2UpperP(chi2: number, df: number): number {
  if (!(df > 0)) return NaN
  if (!(chi2 > 0)) return 1
  return Math.max(0, Math.min(1, gammaQ(df / 2, chi2 / 2)))
}

/** F 分布上尾 p 值 */
export function fUpperP(f: number, d1: number, d2: number): number {
  if (!(d1 > 0) || !(d2 > 0)) return NaN
  if (!(f > 0)) return 1
  if (!Number.isFinite(f)) return 0
  return Math.max(0, Math.min(1, betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f))))
}

/** 相关系数的 t 检验（双侧 H0: ρ = 0） */
export function corrPValue(r: number, n: number): number | null {
  if (!Number.isFinite(r) || n < 3) return null
  return corrPValueDf(r, n - 2)
}

/** 已知自由度时的相关系数 p 值（偏相关用） */
export function corrPValueDf(r: number, df: number): number | null {
  if (!Number.isFinite(r) || !(df > 0)) return null
  if (Math.abs(r) >= 1) return 0
  const t = r * Math.sqrt(df / (1 - r * r))
  return studentTTwoSidedP(t, df)
}

/** Fisher z 变换的相关系数置信区间 */
export function fisherCI(
  r: number,
  n: number,
  level = 0.95,
): [number, number] | null {
  if (!Number.isFinite(r) || n < 4 || Math.abs(r) >= 1) return null
  const z = Math.atanh(r)
  const se = 1 / Math.sqrt(n - 3)
  const zc = normInv(1 - (1 - level) / 2)
  return [
    Math.max(-1, Math.tanh(z - zc * se)),
    Math.min(1, Math.tanh(z + zc * se)),
  ]
}

/** 显著性星号 */
export function starsForP(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return ''
  if (p < 0.001) return '***'
  if (p < 0.01) return '**'
  if (p < 0.05) return '*'
  return ''
}

/** Benjamini–Hochberg FDR 校正，返回与输入等长的 q 值 */
export function bhAdjust(pvals: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = pvals.map(() => null)
  const idx: { p: number; i: number }[] = []
  pvals.forEach((p, i) => {
    if (p !== null && Number.isFinite(p)) idx.push({ p, i })
  })
  const m = idx.length
  if (!m) return out
  idx.sort((a, b) => a.p - b.p)
  let prev = 1
  for (let k = m - 1; k >= 0; k--) {
    const q = Math.min(prev, (idx[k].p * m) / (k + 1))
    out[idx[k].i] = Math.max(0, Math.min(1, q))
    prev = q
  }
  return out
}


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
): { v: number; n: number; chi2: number; df: number; p: number; rows: number; cols: number } | null {
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
  const df = (r - 1) * (c - 1)
  return {
    v: Math.max(0, Math.min(1, v)),
    n,
    chi2,
    df,
    p: chi2UpperP(chi2, df),
    rows: r,
    cols: c,
  }
}

/** 相关比 η²（数值 × 类别） */
export function etaStats(
  nums: (number | null)[],
  labels: (string | null)[],
): { e2: number; n: number; k: number; f: number; p: number } | null {
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
  const e2 = Math.max(0, Math.min(1, ssb / sst))
  const k = groups.size
  const df1 = k - 1
  const df2 = n - k
  let f = Infinity
  if (e2 < 1 && df2 > 0) f = (e2 / df1) / ((1 - e2) / df2)
  const p = df2 > 0 ? fUpperP(f, df1, df2) : NaN
  return { e2, n, k, f, p }
}

/** 一元线性回归 y = a + b·x，含 R²、斜率置信区间与 p 值 */
export function linreg(
  x: (number | null)[],
  y: (number | null)[],
): {
  a: number
  b: number
  n: number
  r: number | null
  r2: number | null
  /** 斜率标准误 */
  seB: number | null
  /** 截距标准误 */
  seA: number | null
  /** 斜率 95% 置信区间 */
  slopeCi: [number, number] | null
  /** 斜率 t 检验双侧 p 值 */
  p: number | null
} | null {
  let n = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < x.length; i++) {
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
  const den = n * sxx - sx * sx
  if (!den) return null
  const b = (n * sxy - sx * sy) / den
  const a = (sy - b * sx) / n
  const r = pearson(x, y)
  const r2 = r === null ? null : r * r
  const sxxC = sxx - (sx * sx) / n
  const syyC = syy - (sy * sy) / n
  const sxyC = sxy - (sx * sy) / n
  const sse = Math.max(0, syyC - b * sxyC)
  const df = n - 2
  const mse = sse / df
  const seB = sxxC > 0 ? Math.sqrt(mse / sxxC) : null
  const seA =
    sxxC > 0 ? Math.sqrt(mse * (1 / n + (sx * sx) / (n * sxxC))) : null
  let p: number | null = null
  let slopeCi: [number, number] | null = null
  if (seB !== null && seB > 0) {
    p = studentTTwoSidedP(b / seB, df)
    const tc = studentTCritical(df)
    slopeCi = [b - tc * seB, b + tc * seB]
  }
  return { a, b, n, r, r2, seB, seA, slopeCi, p }
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

/* ================= 偏相关 / 共线性 ================= */

/** 去掉含缺失 / 非有限值的行，返回转置后的列数组 */
function completeColumns(cols: (number | null)[][]): number[][] | null {
  if (!cols.length) return null
  const len = Math.min(...cols.map((c) => c.length))
  const rows: number[][] = []
  for (let i = 0; i < len; i++) {
    const row: number[] = []
    let ok = true
    for (const c of cols) {
      const v = c[i]
      if (v === null || v === undefined || !Number.isFinite(v)) {
        ok = false
        break
      }
      row.push(v)
    }
    if (ok) rows.push(row)
  }
  if (!rows.length) return null
  return cols.map((_, j) => rows.map((r) => r[j]))
}

function pearsonMatrix(cols: number[][]): number[][] | null {
  const p = cols.length
  const n = cols[0]?.length ?? 0
  if (p < 2 || n < p + 1) return null
  const means = cols.map((c) => c.reduce((s, v) => s + v, 0) / n)
  const sds = cols.map((c, i) => {
    const m = means[i]
    return Math.sqrt(c.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1))
  })
  if (sds.some((s) => !(s > 0))) return null
  const r: number[][] = Array.from({ length: p }, () => new Array(p).fill(0))
  for (let i = 0; i < p; i++) {
    r[i][i] = 1
    for (let j = i + 1; j < p; j++) {
      let s = 0
      for (let k = 0; k < n; k++) s += (cols[i][k] - means[i]) * (cols[j][k] - means[j])
      const v = s / ((n - 1) * sds[i] * sds[j])
      const clamped = Math.max(-1, Math.min(1, v))
      r[i][j] = clamped
      r[j][i] = clamped
    }
  }
  return r
}

/** 高斯-约当求逆；奇异或接近奇异时返回 null */
export function invertMatrix(a: number[][]): number[][] | null {
  const n = a.length
  if (!n || a.some((row) => row.length !== n)) return null
  const m = a.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null
    if (pivot !== col) [m[col], m[pivot]] = [m[pivot], m[col]]
    const pv = m[col][col]
    for (let j = 0; j < 2 * n; j++) m[col][j] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col]
      if (!f) continue
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j]
    }
  }
  return m.map((row) => row.slice(n))
}

export interface PartialMatrixResult {
  /** 无法计算（例如被控制变量完全解释）的单元格为 null */
  r: (number | null)[][]
  n: number
  df: number
}

/** 解线性方程组 a·x = b（部分主元高斯消元） */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = a.length
  if (!n || b.length !== n) return null
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    if (Math.abs(m[pivot][col]) < 1e-9) return null
    if (pivot !== col) [m[col], m[pivot]] = [m[pivot], m[col]]
    const pv = m[col][col]
    for (let j = col; j <= n; j++) m[col][j] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col]
      if (!f) continue
      for (let j = col; j <= n; j++) m[r][j] -= f * m[col][j]
    }
  }
  return m.map((row) => row[n])
}

/**
 * 偏相关矩阵：vars 中任意两列在控制 controls 后的相关系数。
 * 先对控制变量做标准化回归取残差，再算残差相关；使用完整行（listwise）。
 */
export function partialCorrMatrix(
  vars: (number | null)[][],
  controls: (number | null)[][] = [],
): PartialMatrixResult | null {
  const m = vars.length
  const k = controls.length
  if (m < 2) return null
  const all = completeColumns([...vars, ...controls])
  if (!all) return null
  const n = all[0].length
  if (n <= m + k) return null
  const df = n - k - 2
  if (df < 1) return null

  if (!k) {
    const corr = pearsonMatrix(all)
    if (!corr) return null
    return { r: corr.slice(0, m).map((row) => row.slice(0, m)), n, df }
  }

  // 标准化，避免量纲差异导致病态矩阵
  const means = all.map((c) => c.reduce((s, v) => s + v, 0) / n)
  const sds = all.map((c, i) => {
    const mu = means[i]
    return Math.sqrt(c.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, n - 1))
  })
  if (sds.some((s) => !(s > 0))) return null
  const z = all.map((c, i) => c.map((v) => (v - means[i]) / sds[i]))
  const ctrl = z.slice(m)
  const gram = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => {
      let s = 0
      for (let r = 0; r < n; r++) s += ctrl[i][r] * ctrl[j][r]
      return s
    }),
  )

  const residuals: (number[] | null)[] = []
  for (let j = 0; j < m; j++) {
    const y = z[j]
    const rhs = Array.from({ length: k }, (_, i) => {
      let s = 0
      for (let r = 0; r < n; r++) s += ctrl[i][r] * y[r]
      return s
    })
    const beta = solveLinear(gram, rhs)
    if (!beta) return null
    const res: number[] = new Array(n)
    let ss = 0
    for (let r = 0; r < n; r++) {
      let fit = 0
      for (let c = 0; c < k; c++) fit += beta[c] * ctrl[c][r]
      const v = y[r] - fit
      res[r] = v
      ss += v * v
    }
    // 该列被控制变量完全解释时偏相关无定义
    residuals.push(Math.sqrt(ss / Math.max(1, n - 1)) < 1e-9 ? null : res)
  }

  const r: (number | null)[][] = Array.from({ length: m }, () => new Array(m).fill(null))
  for (let i = 0; i < m; i++) {
    const a = residuals[i]
    if (!a) continue
    r[i][i] = 1
    for (let j = i + 1; j < m; j++) {
      const b = residuals[j]
      if (!b) continue
      let sa = 0
      let sb = 0
      let saa = 0
      let sbb = 0
      let sab = 0
      for (let t = 0; t < n; t++) {
        sa += a[t]
        sb += b[t]
        saa += a[t] * a[t]
        sbb += b[t] * b[t]
        sab += a[t] * b[t]
      }
      const num = sab - (sa * sb) / n
      const den = Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n))
      const v = den > 0 ? Math.max(-1, Math.min(1, num / den)) : null
      r[i][j] = v
      r[j][i] = v
    }
  }
  return { r, n, df }
}

export interface VifResult {
  n: number
  /** 与输入列一一对应；无法计算时为 null */
  items: ({ vif: number; r2: number } | null)[]
}

/**
 * 方差膨胀因子：每列对其余列做标准化线性回归得到的 1 / (1 - R²)。
 * 使用完整行；样本量不足、矩阵奇异或 R² ≈ 1 时对应项为 null。
 */
export function vifStats(vars: (number | null)[][]): VifResult | null {
  const p = vars.length
  if (p < 2) return null
  const all = completeColumns(vars)
  if (!all) return null
  const n = all[0].length
  if (n <= p) return null
  const corr = pearsonMatrix(all)
  if (!corr) return null
  const items = corr.map((row, j) => {
    const others: number[][] = []
    const rhs: number[] = []
    for (let i = 0; i < p; i++) {
      if (i === j) continue
      others.push(corr[i].filter((_, c) => c !== j))
      rhs.push(row[i])
    }
    // 极小的岭项，避免完全共线时矩阵奇异；只影响数值稳定性
    for (let i = 0; i < others.length; i++) others[i][i] += 1e-8
    const beta = solveLinear(others, rhs)
    if (!beta) return null
    const r2 = Math.max(0, Math.min(1, rhs.reduce((s, v, i) => s + v * beta[i], 0)))
    if (r2 >= 1 - 1e-6) return null
    return { vif: 1 / (1 - r2), r2 }
  })
  return { n, items }
}
