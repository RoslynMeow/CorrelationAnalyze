import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseCSV } from '@/lib/csv'
import { buildDataset } from '@/lib/infer'
import { assoc, computePairs } from '@/lib/associations'
import {
  betai,
  bhAdjust,
  chi2UpperP,
  corrPValue,
  corrPValueDf,
  cramersV,
  describe as desc,
  etaStats,
  fUpperP,
  fisherCI,
  invertMatrix,
  kde,
  linreg,
  normInv,
  partialCorrMatrix,
  pearson,
  ranks,
  spearman,
  starsForP,
  studentTCritical,
  studentTTwoSidedP,
  vifStats,
} from '@/lib/stats'
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

describe('分布函数与推断统计（scipy 基准）', () => {
  it('标准正态分位数', () => {
    expect(normInv(0.975)).toBeCloseTo(1.959963984540054, 8)
    expect(normInv(0.5)).toBeCloseTo(0, 8)
  })

  it('不完全 Beta 与 t 分布', () => {
    expect(betai(2, 3, 0.4)).toBeCloseTo(0.5248, 10)
    expect(studentTTwoSidedP(2.048407141795244, 28)).toBeCloseTo(0.05, 10)
    expect(studentTCritical(28)).toBeCloseTo(2.048407141795244, 6)
  })

  it('卡方与 F 分布上尾概率', () => {
    expect(chi2UpperP(2.0267558528428093, 4)).toBeCloseTo(0.730837564067129, 10)
    expect(fUpperP(14.501238566327883, 2, 27)).toBeCloseTo(5.2797469920797834e-5, 12)
  })

  it('相关系数 p 值与 Fisher 置信区间', () => {
    const strong = corrPValue(-0.9744103930417336, 30)!
    expect(strong / 1.0814084177802038e-19).toBeCloseTo(1, 5)
    expect(corrPValue(0.36553684755421323, 30)).toBeCloseTo(0.04698880582546862, 10)
    const ci = fisherCI(-0.9744103930417336, 30)!
    expect(ci[0]).toBeCloseTo(-0.9878831588418897, 9)
    expect(ci[1]).toBeCloseTo(-0.9463614164800268, 9)
  })

  it('Cramér V 附带卡方 p 与自由度', () => {
    const res = cramersV(col('gender').labels!, col('risk_level').labels!)!
    expect(res.df).toBe(4)
    expect(res.chi2).toBeCloseTo(2.0267558528428093, 9)
    expect(res.p).toBeCloseTo(0.730837564067129, 10)
  })

  it('η 附带 F 检验 p 值', () => {
    const res = etaStats(col('stress_level').num!, col('risk_level').labels!)!
    expect(res.k).toBe(3)
    expect(res.f).toBeCloseTo(14.501238566327883, 9)
    expect(res.p / 5.2797469920797834e-5).toBeCloseTo(1, 6)
  })

  it('回归含 R²、斜率标准误与置信区间', () => {
    const reg = linreg(col('sleep_hours').num!, col('stress_level').num!)!
    expect(reg.r2).toBeCloseTo(0.04358368130044028, 10)
    expect(reg.seB).toBeCloseTo(0.2921948741732997, 10)
    expect(reg.p).toBeCloseTo(0.2682371944576718, 10)
    expect(reg.slopeCi![0]).toBeCloseTo(-0.9285919236537125, 9)
    expect(reg.slopeCi![1]).toBeCloseTo(0.26847621045138725, 9)
  })

  it('BH 校正：p 值单调映射到 q 值', () => {
    const q = bhAdjust([0.001, 0.008, 0.039, 0.041, 0.042]) as number[]
    expect(q[0]).toBeCloseTo(0.005, 12)
    expect(q[1]).toBeCloseTo(0.02, 12)
    expect(q[2]).toBeCloseTo(0.042, 12)
    expect(q[3]).toBeCloseTo(0.042, 12)
    expect(q[4]).toBeCloseTo(0.042, 12)
    expect(bhAdjust([null, 0.04])).toEqual([null, 0.04])
  })

  it('显著性星号', () => {
    expect(starsForP(0.0009)).toBe('***')
    expect(starsForP(0.009)).toBe('**')
    expect(starsForP(0.049)).toBe('*')
    expect(starsForP(0.05)).toBe('')
    expect(starsForP(null)).toBe('')
  })

  it('变量对结果附带 p、CI 与 FDR q', () => {
    const pairs = computePairs(ds.columns)
    const hit = pairs.find(
      (p) =>
        (p.a === 'stress_level' && p.b === 'mental_health_index') ||
        (p.a === 'mental_health_index' && p.b === 'stress_level'),
    )!
    expect(hit.p).not.toBeNull()
    expect(hit.p! / 1.0814084177802038e-19).toBeCloseTo(1, 6)
    expect(hit.ci![0]).toBeCloseTo(-0.9878831588418897, 9)
    expect(hit.q).not.toBeNull()
    expect(hit.q!).toBeGreaterThanOrEqual(hit.p!)
    expect(hit.q!).toBeLessThanOrEqual(1)
    const byP = pairs
      .filter((p) => p.p !== null && p.q !== null)
      .sort((a, b) => a.p! - b.p!)
    for (let i = 0; i < byP.length; i++) {
      expect(byP[i].q!).toBeGreaterThanOrEqual(byP[i].p! - 1e-15)
      if (i) expect(byP[i].q! + 1e-15).toBeGreaterThanOrEqual(byP[i - 1].q!)
    }
  })
})

describe('偏相关与共线性（scipy / statsmodels 基准）', () => {
  it('矩阵求逆', () => {
    const inv = invertMatrix([
      [4, 7],
      [2, 6],
    ])!
    expect(inv[0][0]).toBeCloseTo(0.6, 12)
    expect(inv[0][1]).toBeCloseTo(-0.7, 12)
    expect(inv[1][0]).toBeCloseTo(-0.2, 12)
    expect(inv[1][1]).toBeCloseTo(0.4, 12)
    expect(invertMatrix([[1, 1], [1, 1]])).toBeNull()
  })

  it('控制单变量后的偏相关与 p 值', () => {
    const a = col('stress_level').num!
    const b = col('mental_health_index').num!
    const c = col('sleep_hours').num!
    const res = partialCorrMatrix([a, b], [c])!
    expect(res.n).toBe(30)
    expect(res.df).toBe(27)
    expect(res.r[0][1]).toBeCloseTo(-0.9734799784135981, 9)
    expect(corrPValueDf(res.r[0][1]!, res.df)! / 7.888173245703816e-19).toBeCloseTo(1, 6)

    const res2 = partialCorrMatrix(
      [col('study_hours_per_day').num!, col('academic_performance').num!],
      [col('stress_level').num!],
    )!
    expect(res2.r[0][1]).toBeCloseTo(0.2963245300361346, 9)
    expect(corrPValueDf(res2.r[0][1]!, res2.df)).toBeCloseTo(0.11855797786399706, 9)
  })

  it('控制两个变量后的偏相关', () => {
    const res = partialCorrMatrix(
      [col('burnout_score').num!, col('dropout_risk').num!],
      [col('stress_level').num!, col('sleep_hours').num!],
    )!
    expect(res.df).toBe(26)
    expect(res.r[0][1]).toBeCloseTo(0.3331685093723759, 9)
  })

  it('VIF 与标准化回归 R² 一致', () => {
    const nums = ds.columns.filter((c) => c.type === 'number')
    const vars = nums.map((c) => c.num || [])
    const res = vifStats(vars)!
    expect(res.n).toBe(30)
    const vifOf = (name: string): number => {
      const i = nums.findIndex((c) => c.name === name)
      return res.items[i]!.vif
    }
    expect(vifOf('age') / 2.3628582554357385).toBeCloseTo(1, 6)
    expect(vifOf('study_hours_per_day') / 8.351964018884292).toBeCloseTo(1, 6)
    expect(vifOf('physical_activity') / 1.6821509479449377).toBeCloseTo(1, 6)
    // 完全共线的列无法得到有限 VIF
    expect(res.items[nums.findIndex((c) => c.name === 'stress_level')]).toBeNull()
  })
})
