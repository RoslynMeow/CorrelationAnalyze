import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseCSV } from '@/lib/csv'
import { buildDataset } from '@/lib/infer'
import {
  buildFilterMask,
  filterCount,
  normalizeRules,
  subsetDataset,
} from '@/lib/filter'
import type { Dataset, FilterRule } from '@/types'

let ds: Dataset

beforeAll(() => {
  const text = readFileSync(resolve(__dirname, './fixtures/sample.csv'), 'utf8')
  const { headers, rows } = parseCSV(text)
  ds = buildDataset('test', headers, rows)
})

const count = (rules: FilterRule[]): number =>
  filterCount(ds, buildFilterMask(ds.columns, ds.n, rules))

describe('行筛选', () => {
  it('类别条件：精确匹配并支持多个取值', () => {
    expect(count([{ type: 'category', column: 'gender', values: ['Female'] }])).toBe(15)
    expect(count([{ type: 'category', column: 'gender', values: ['Female', 'Other'] }])).toBe(17)
  })

  it('类别缺失值单独控制', () => {
    const synthetic = buildDataset('x', ['g', 'v'], [
      ['A', '1'],
      ['', '2'],
      ['B', '3'],
    ])
    const onlyMissing = buildFilterMask(synthetic.columns, synthetic.n, [
      { type: 'category', column: 'g', values: [], includeMissing: true },
    ])!
    expect(filterCount(synthetic, onlyMissing)).toBe(1)
    const noMissing = buildFilterMask(synthetic.columns, synthetic.n, [
      { type: 'category', column: 'g', values: ['A', 'B'] },
    ])!
    expect(filterCount(synthetic, noMissing)).toBe(2)
  })

  it('数值范围包含边界，缺失值会被排除', () => {
    const ages = ds.columns.find((c) => c.name === 'age')!
    expect(ages.min).toBe(17)
    expect(ages.max).toBe(29)
    const ai = ds.columns.indexOf(ages)
    const expected = ds.rows.filter((r) => {
      const v = Number(r[ai])
      return Number.isFinite(v) && v >= 20 && v <= 29
    }).length
    expect(count([{ type: 'number', column: 'age', min: 20, max: 29 }])).toBe(expected)
    expect(count([{ type: 'number', column: 'age', min: 30, max: null }])).toBe(0)
    expect(count([{ type: 'number', column: 'age', min: null, max: null }])).toBe(ds.n)
  })

  it('多个条件按 AND 组合', () => {
    const n = count([
      { type: 'category', column: 'gender', values: ['Female'] },
      { type: 'number', column: 'age', min: 25, max: null },
    ])
    const gi = ds.columns.findIndex((c) => c.name === 'gender')
    const ai = ds.columns.findIndex((c) => c.name === 'age')
    const expected = ds.rows.filter(
      (r) => r[gi].trim() === 'Female' && Number(r[ai]) >= 25,
    ).length
    expect(n).toBe(expected)
    expect(n).toBeLessThan(15)
  })

  it('日期范围按天边界处理', () => {
    const dated = buildDataset('d', ['date', 'v'], [
      ['2026-01-01', '1'],
      ['2026-02-15', '2'],
      ['2026-03-31', '3'],
    ])
    const rules: FilterRule[] = [
      { type: 'date', column: 'date', min: '2026-02-01', max: '2026-03-31' },
    ]
    const mask = buildFilterMask(dated.columns, dated.n, rules)!
    expect(filterCount(dated, mask)).toBe(2)
    const out = subsetDataset(dated, mask)
    expect(out.rows.map((r) => r[1])).toEqual(['2', '3'])
  })

  it('忽略无效 / 空条件与类型不符的规则', () => {
    const clean = normalizeRules(
      [
        { type: 'number', column: 'age', min: null, max: null },
        { type: 'number', column: 'gender', min: 1, max: 2 },
        { type: 'category', column: 'nope', values: ['x'] },
        { type: 'number', column: 'age', min: 30, max: 20 },
      ],
      ds.columns,
    )
    expect(clean).toEqual([{ type: 'number', column: 'age', min: 20, max: 30 }])
  })

  it('子数据集保留列类型并重算统计', () => {
    const mask = buildFilterMask(ds.columns, ds.n, [
      { type: 'category', column: 'risk_level', values: ['High'] },
    ])!
    const out = subsetDataset(ds, mask)
    expect(out.n).toBe(1)
    expect(out.rows).toHaveLength(1)
    const stress = out.columns.find((c) => c.name === 'stress_level')!
    expect(stress.type).toBe('number')
    expect(stress.total).toBe(1)
    expect(stress.uniqueCount).toBe(1)
    expect(stress.mean).toBeCloseTo(Number(out.rows[0][ds.headers.indexOf('stress_level')]), 9)
    expect(out.columns.find((c) => c.name === 'gender')!.uniqueCount).toBe(1)
  })
})
