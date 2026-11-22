import { isNull, uniq } from './format'
import { describe } from './stats'
import type { Column, Dataset, FilterRule } from '@/types'

const MAX_VALUES = 500

/** 校验规则：丢弃列不存在、类型不符或没有任何限制条件的规则 */
export function normalizeRules(rules: FilterRule[], columns: Column[]): FilterRule[] {
  const byName = new Map(columns.map((c) => [c.name, c]))
  const out: FilterRule[] = []
  for (const rule of rules.slice(0, 12)) {
    const col = byName.get(rule.column)
    if (!col || col.type !== rule.type) continue
    if (rule.type === 'number') {
      let { min, max } = rule
      if (min !== null && !Number.isFinite(min)) min = null
      if (max !== null && !Number.isFinite(max)) max = null
      if (min === null && max === null) continue
      if (min !== null && max !== null && min > max) [min, max] = [max, min]
      out.push({ type: 'number', column: rule.column, min, max })
    } else if (rule.type === 'date') {
      let { min, max } = rule
      if (!/^\d{4}-\d{2}-\d{2}$/.test(min)) min = ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(max)) max = ''
      if (!min && !max) continue
      if (min && max && min > max) [min, max] = [max, min]
      out.push({ type: 'date', column: rule.column, min, max })
    } else {
      const values = uniq(
        rule.values
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean),
      ).slice(0, MAX_VALUES)
      if (!values.length && !rule.includeMissing) continue
      out.push({
        type: 'category',
        column: rule.column,
        values,
        includeMissing: !!rule.includeMissing,
      })
    }
  }
  return out
}

/** 生成行掩码；没有有效规则时返回 null（表示不过滤） */
export function buildFilterMask(
  columns: Column[],
  n: number,
  rules: FilterRule[],
): Uint8Array | null {
  const active = normalizeRules(rules, columns)
  if (!active.length) return null
  const mask = new Uint8Array(n).fill(1)
  for (const rule of active) {
    const col = columns.find((c) => c.name === rule.column)
    if (!col) continue

    if (rule.type === 'number') {
      const values = col.num || []
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue
        const v = values[i]
        if (v === null || v === undefined || !Number.isFinite(v)) {
          mask[i] = 0
          continue
        }
        if (rule.min !== null && v < rule.min) mask[i] = 0
        else if (rule.max !== null && v > rule.max) mask[i] = 0
      }
    } else if (rule.type === 'date') {
      const values = col.num || []
      const minTs = rule.min ? new Date(`${rule.min}T00:00:00`).getTime() : null
      const maxTs = rule.max ? new Date(`${rule.max}T23:59:59.999`).getTime() : null
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue
        const v = values[i]
        if (v === null || v === undefined || !Number.isFinite(v)) {
          mask[i] = 0
          continue
        }
        if (minTs !== null && v < minTs) mask[i] = 0
        else if (maxTs !== null && v > maxTs) mask[i] = 0
      }
    } else {
      const values = new Set(rule.values)
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue
        const raw = col.raw[i]
        if (isNull(raw)) {
          if (!rule.includeMissing) mask[i] = 0
          continue
        }
        if (!values.has(String(raw).trim())) mask[i] = 0
      }
    }
  }
  return mask
}

function subsetColumn(col: Column, idx: number[]): Column {
  const raw = idx.map((i) => col.raw[i] ?? '')
  const num = col.num ? idx.map((i) => col.num![i]) : null
  const labels = col.labels ? idx.map((i) => col.labels![i]) : null
  const uniqueVals: string[] = []
  const seen = new Set<string>()
  for (const v of raw) {
    if (isNull(v)) continue
    const s = String(v).trim()
    if (!seen.has(s)) {
      seen.add(s)
      uniqueVals.push(s)
    }
  }
  const out: Column = {
    ...col,
    raw,
    num,
    labels,
    unique: uniqueVals,
    uniqueCount: uniqueVals.length,
    missing: raw.filter((v) => isNull(v)).length,
    total: raw.length,
  }
  if (out.type === 'number' && num) {
    const s = describe(num)
    out.mean = s?.mean
    out.sd = s?.sd
    out.min = s?.min
    out.max = s?.max
    out.median = s?.median
  }
  return out
}

/** 按掩码生成子数据集；保留列类型，重新计算缺失、唯一值与数值统计 */
export function subsetDataset(ds: Dataset, mask: Uint8Array): Dataset {
  const idx: number[] = []
  for (let i = 0; i < ds.n; i++) if (mask[i]) idx.push(i)
  if (idx.length === ds.n) return ds
  const rows = idx.map((i) => ds.rows[i])
  return {
    ...ds,
    rows,
    n: rows.length,
    columns: ds.columns.map((c) => subsetColumn(c, idx)),
  }
}

export function filterCount(ds: Dataset, mask: Uint8Array | null): number {
  if (!mask) return ds.n
  let n = 0
  for (let i = 0; i < ds.n; i++) if (mask[i]) n++
  return n
}
