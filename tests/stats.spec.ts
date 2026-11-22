import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseCSV } from '@/lib/csv'
import { buildDataset } from '@/lib/infer'
import { assoc } from '@/lib/associations'
import { cramersV, describe as desc, etaStats, kde, linreg, pearson, ranks, spearman } from '@/lib/stats'
import type { Dataset } from '@/types'

let ds: Dataset
const col = (name: string) => ds.columns.find((c) => c.name === name)!

beforeAll(() => {
  const text = readFileSync(resolve(__dirname, './fixtures/sample.csv'), 'utf8')
  const { headers, rows } = parseCSV(text)
  ds = buildDataset('test', headers, rows)
})

describe('基础统计', () => {
  it('Pearson：完全正相关为 1', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12)
  })

  it('Pearson：成对剔除缺失值', () => {
    expect(pearson([1, 2, null, 4, 5], [2, null, 6, 8, 10])).toBeCloseTo(1, 12)
  })

  it('Pearson：n < 3 或零方差返回 null', () => {
    expect(pearson([1, 2], [1, 2])).toBeNull()
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
  })

  it('秩：并列取平均名次', () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(ranks([3, null, 1])).toEqual([2, null, 1])
  })

  it('Spearman 对有单调非线性关系为 1', () => {
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])).toBeCloseTo(1, 12)
  })

  it('描述统计含分位数', () => {
    const s = desc([1, 2, 3, 4])!
    expect(s.n).toBe(4)
    expect(s.mean).toBeCloseTo(2.5, 12)
    expect(s.median).toBeCloseTo(2.5, 12)
    expect(s.q1).toBeCloseTo(1.75, 12)
    expect(s.q3).toBeCloseTo(3.25, 12)
  })

  it('KDE 积分为密度（峰值 > 0 且有限）', () => {
    const xs = [0, 0.5, 1, 1.5, 2]
    const y = kde([0, 1, 1, 2], xs)
    expect(y.every((v) => Number.isFinite(v) && v >= 0)).toBe(true)
    expect(Math.max(...y)).toBeGreaterThan(0)
  })
})

describe('与 pandas / scipy 对照（test.csv）', () => {
  it('数据规模 30 × 20，无截断', () => {
    expect(ds.n).toBe(30)
    expect(ds.headers.length).toBe(20)
    expect(ds.truncated).toBe(false)
  })

  it('Pearson / Spearman 与 scipy 一致', () => {
    const cases: [string, string, number, number][] = [
      ['stress_level', 'mental_health_index', -0.974410393042, -0.946607341491],
      ['study_hours_per_day', 'academic_performance', 0.365536847554, 0.279199110122],
      ['sleep_hours', 'stress_level', -0.208767050323, -0.141713014461],
      ['burnout_score', 'dropout_risk', 0.720913495346, 0.641059897573],
    ]
    for (const [a, b, r, rho] of cases) {
      const c1 = col(a)
      const c2 = col(b)
      const pr = assoc(c1, c2, 'pearson')!
      const sp = assoc(c1, c2, 'spearman')!
      expect(pr.type).toBe('r')
      expect(sp.type).toBe('ρ')
      expect(pr.signed).toBeCloseTo(r, 9)
      expect(sp.signed).toBeCloseTo(rho, 9)
      expect(pr.n).toBe(30)
    }
  })

  it("相关比 η（数值 × 类别）与 pandas 分组计算一致", () => {
    const res = etaStats(col('stress_level').num!, col('risk_level').labels!)
    expect(res).not.toBeNull()
    expect(Math.sqrt(res!.e2)).toBeCloseTo(0.719637734744, 9)
    expect(res!.n).toBe(30)
  })

  it("Cramér's V（类别 × 类别）与 scipy 卡方一致", () => {
    const res = cramersV(col('gender').labels!, col('risk_level').labels!)
    expect(res).not.toBeNull()
    expect(res!.v).toBeCloseTo(0.183791360553, 9)
    expect(res!.n).toBe(30)
  })

  it('一元线性回归与 scipy.linregress 一致', () => {
    const reg = linreg(col('sleep_hours').num!, col('stress_level').num!)!
    expect(reg.b).toBeCloseTo(-0.330057856601, 9)
    expect(reg.a).toBeCloseTo(6.468330077718, 9)
    expect(reg.n).toBe(30)
  })

  it('描述统计与 pandas 一致', () => {
    const s = desc(col('stress_level').num!)!
    expect(s.mean).toBeCloseTo(4.426150785967, 9)
    expect(s.sd).toBeCloseTo(1.889895023661, 9)
    expect(s.median).toBeCloseTo(4.1382842155, 9)
    expect(s.q1).toBeCloseTo(3.2520462185, 9)
    expect(s.q3).toBeCloseTo(5.313211319, 9)
  })

  it('自动选择度量类型', () => {
    expect(assoc(col('stress_level'), col('sleep_hours'))!.type).toBe('r')
    expect(assoc(col('stress_level'), col('risk_level'))!.type).toBe('η')
    expect(assoc(col('gender'), col('risk_level'))!.type).toBe('V')
  })
})
