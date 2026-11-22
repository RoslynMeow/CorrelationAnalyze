import { cramersV, etaStats, pearson, ranks } from './stats'
import type { AssocMethod, AssocResult, Column, PairAssoc } from '@/types'

const rankCache = new WeakMap<Column, (number | null)[]>()

function ranksOf(col: Column): (number | null)[] {
  let r = rankCache.get(col)
  if (!r) {
    r = ranks(col.num || [])
    rankCache.set(col, r)
  }
  return r
}

function numNum(c1: Column, c2: Column, method: AssocMethod): AssocResult | null {
  const x = c1.num || []
  const y = c2.num || []
  let n = 0
  const len = Math.min(x.length, y.length)
  for (let i = 0; i < len; i++) if (x[i] !== null && y[i] !== null) n++
  if (n < 3) return null
  const r = method === 'spearman' ? pearson(ranksOf(c1), ranksOf(c2)) : pearson(x, y)
  if (r === null) return null
  return { strength: Math.abs(r), signed: r, type: method === 'spearman' ? 'ρ' : 'r', n }
}

function catCat(c1: Column, c2: Column): AssocResult | null {
  const res = cramersV(c1.labels || [], c2.labels || [])
  if (!res) return null
  return { strength: res.v, signed: null, type: 'V', n: res.n }
}

function numCat(nc: Column, cc: Column): AssocResult | null {
  const res = etaStats(nc.num || [], cc.labels || [])
  if (!res) return null
  return { strength: Math.sqrt(res.e2), signed: null, type: 'η', n: res.n }
}

/** 任取两列，按类型自动选择度量：r / ρ / V / η */
export function assoc(c1: Column, c2: Column, method: AssocMethod = 'pearson'): AssocResult | null {
  const n1 = c1.type === 'number'
  const n2 = c2.type === 'number'
  if (n1 && n2) return numNum(c1, c2, method)
  if (!n1 && !n2) return catCat(c1, c2)
  return n1 ? numCat(c1, c2) : numCat(c2, c1)
}

/** 计算所有变量对（最多前 40 个变量），按强度降序 */
export function computePairs(
  cols: Column[],
  method: AssocMethod = 'pearson',
  limit = 40,
): PairAssoc[] {
  const use = cols.slice(0, limit)
  const out: PairAssoc[] = []
  for (let i = 0; i < use.length; i++) {
    for (let j = i + 1; j < use.length; j++) {
      const a = assoc(use[i], use[j], method)
      if (a) out.push({ a: use[i].name, b: use[j].name, ...a })
    }
  }
  out.sort((x, y) => y.strength - x.strength)
  return out
}

/** 传给 Web Worker 的精简列结构（可结构化克隆） */
export interface WorkerColumn {
  name: string
  type: Column['type']
  num: (number | null)[] | null
  labels: (string | null)[] | null
}

export function slimColumns(cols: Column[]): WorkerColumn[] {
  return cols.map((c) => ({ name: c.name, type: c.type, num: c.num, labels: c.labels }))
}

export function pairsFromSlim(slim: WorkerColumn[], method: AssocMethod, limit = 40): PairAssoc[] {
  const cols = slim.map((c) => ({
    name: c.name,
    type: c.type,
    num: c.num,
    labels: c.labels,
  })) as Column[]
  return computePairs(cols, method, limit)
}

/** r / ρ 的符号决定颜色，V / η 用中性蓝 */
export function strengthColor(a: { signed: number | null }): string {
  if (a.signed === null) return '#4c6ef5'
  return a.signed >= 0 ? '#2f9e6e' : '#d64545'
}
