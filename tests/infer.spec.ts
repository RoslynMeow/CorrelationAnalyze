import { describe, expect, it } from 'vitest'
import { buildColumn, buildDataset, categoryCols, groupCols, groupLabels, numericCols, pickGroup, pickTarget } from '@/lib/infer'

describe('类型推断', () => {
  it('数字（含千分位 / 货币 / 百分号）', () => {
    const col = buildColumn('price', ['1,200', '¥300', '45%'])
    expect(col.type).toBe('number')
    expect(col.num).toEqual([1200, 300, 45])
    expect(col.missing).toBe(0)
  })

  it('日期', () => {
    const col = buildColumn('day', ['2024-01-01', '2024/02/03', '2024.03.05'])
    expect(col.type).toBe('date')
    expect(col.num?.every((v) => typeof v === 'number')).toBe(true)
  })

  it('缺失值识别与统计', () => {
    const col = buildColumn('x', ['1', '', 'NA', '3', '-'])
    expect(col.type).toBe('number')
    expect(col.missing).toBe(3)
    expect(col.uniqueCount).toBe(2)
  })

  it('类别列保留字符串标签', () => {
    const col = buildColumn('gender', ['Male', 'Female', 'Male'])
    expect(col.type).toBe('category')
    expect(col.labels).toEqual(['Male', 'Female', 'Male'])
  })
})

describe('ID 与列筛选', () => {
  it('唯一且列名像 id 的列被排除', () => {
    const ds = buildDataset('t', ['id', 'score', 'group'], [
      ['1', '10', 'A'],
      ['2', '20', 'B'],
      ['3', '30', 'A'],
    ])
    expect(ds.columns[0].isId).toBe(true)
    expect(numericCols(ds).map((c) => c.name)).toEqual(['score'])
    expect(categoryCols(ds).map((c) => c.name)).toEqual(['group'])
  })

  it('名称唯一但不是 id 的数值列不被排除', () => {
    const ds = buildDataset('t', ['score'], [['1'], ['2'], ['3']])
    expect(ds.columns[0].isId).toBe(false)
    expect(numericCols(ds).length).toBe(1)
  })
})

describe('分组列', () => {
  it('有序等级按语义排序', () => {
    const col = buildColumn('risk', ['High', 'Low', 'Medium', 'Low'])
    expect(groupLabels(col)).toEqual(['Low', 'Medium', 'High'])
  })

  it('缺失值排在最后', () => {
    const col = buildColumn('risk', ['High', '', 'Low'])
    expect(groupLabels(col)).toEqual(['Low', 'High', '(缺失)'])
  })

  it('数值分组按数值大小排序', () => {
    const col = buildColumn('grade', ['3', '1', '2'])
    expect(groupLabels(col)).toEqual(['1', '2', '3'])
  })

  it('数值列唯一值过多时不当分组列', () => {
    const rows = Array.from({ length: 20 }, (_, i) => [String(17 + i)])
    const ds = buildDataset('t', ['age'], rows)
    expect(groupCols(ds)).toEqual([])
  })

  it('2–12 个取值的数值列可作为分组列', () => {
    const rows = Array.from({ length: 8 }, (_, i) => [String((i % 4) + 1)])
    const ds = buildDataset('t', ['year'], rows)
    expect(groupCols(ds).map((c) => c.name)).toEqual(['year'])
  })
})

describe('默认选择', () => {
  it('目标优先选择 risk 类列', () => {
    const ds = buildDataset('t', ['score', 'risk_level', 'gender'], [
      ['1', 'Low', 'F'],
      ['2', 'High', 'M'],
      ['3', 'Low', 'F'],
    ])
    expect(pickTarget(ds.columns)).toBe('risk_level')
  })

  it('分组优先选择 risk / group 类列', () => {
    const ds = buildDataset('t', ['score', 'gender'], [
      ['1', 'F'],
      ['2', 'M'],
      ['3', 'F'],
    ])
    expect(pickGroup(ds.columns)).toBe('gender')
  })
})

describe('行数上限', () => {
  it('超过上限时截断', () => {
    const rows = Array.from({ length: 5 }, (_, i) => [String(i)])
    const ds = buildDataset('t', ['x'], rows, 3)
    expect(ds.truncated).toBe(true)
    expect(ds.n).toBe(3)
    expect(ds.rows.length).toBe(3)
  })
})
