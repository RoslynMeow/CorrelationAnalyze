import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCSV } from '@/lib/csv'
import { buildDataset } from '@/lib/infer'
import { useViewStore } from '@/stores/view'
import { BUILTIN_PRESETS } from '@/presets/builtin'
import { presetColumns } from '@/presets/types'
import { sanitizePresets } from '@/presets/sanitize'

const text = readFileSync(resolve(__dirname, './fixtures/sample.csv'), 'utf8')
const { headers, rows } = parseCSV(text)
const ds = buildDataset('sample', headers, rows)

describe('预设模板', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('内置预设包含自动推荐与心理健康模板', () => {
    expect(BUILTIN_PRESETS.map((p) => p.id)).toContain('auto')
    expect(BUILTIN_PRESETS.map((p) => p.id)).toContain('mental-health')
  })

  it('收集预设涉及的列名', () => {
    const p = BUILTIN_PRESETS.find((x) => x.id === 'mental-health')!
    const cols = presetColumns(p)
    expect(cols).toContain('risk_level')
    expect(cols).toContain('mental_health_index')
    expect(new Set(cols).size).toBe(cols.length)
  })

  it('自动推荐初始化面板选择', () => {
    const view = useViewStore()
    view.init(ds)
    expect(view.targetCol).toBe('risk_level')
    expect(view.groupCol).toBe('risk_level')
    expect(view.groupVars.length).toBeGreaterThan(0)
    expect(view.radarDims.length).toBeGreaterThanOrEqual(3)
    expect(view.pairDims.length).toBeGreaterThanOrEqual(2)
  })

  it('心理健康预设应用存在的列，忽略不存在的列', () => {
    const view = useViewStore()
    view.init(ds)
    const preset = BUILTIN_PRESETS.find((x) => x.id === 'mental-health')!
    view.apply(
      {
        ...preset.config,
        scatterY: 'not_a_column',
        radarDims: [...(preset.config.radarDims || []), 'not_a_column'],
      },
      ds,
    )
    expect(view.targetCol).toBe('risk_level')
    expect(view.scatterX).toBe('stress_level')
    expect(view.scatterY).not.toBe('not_a_column')
    expect(view.groupVars).toContain('burnout_score')
    expect(view.radarDims).not.toContain('not_a_column')
    expect(view.categoryCol).toBe('risk_level')
  })

  it('快照包含当前选择，可再次应用', () => {
    const view = useViewStore()
    view.init(ds)
    view.scatterX = 'sleep_hours'
    view.radarDims = ['stress_level', 'sleep_hours', 'anxiety_score']
    const snap = view.snapshot()
    expect(snap.scatterX).toBe('sleep_hours')
    expect(snap.radarDims).toEqual(['stress_level', 'sleep_hours', 'anxiety_score'])
  })

  it('校验导入的自定义预设', () => {
    const list = sanitizePresets([
      {
        id: 'custom-1',
        name: '我的模板',
        config: {
          target: 'risk_level',
          groupVars: ['stress_level', 'stress_level', ''],
          radarDims: 'bad',
        },
      },
      { id: 'custom-1', name: '重复 id' },
      { id: '', name: '无 id' },
      { id: 'custom-2', name: '' },
    ])
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('custom-1')
    expect(list[0].builtin).toBe(false)
    expect(list[0].config.target).toBe('risk_level')
    expect(list[0].config.groupVars).toEqual(['stress_level'])
    expect(list[0].config.radarDims).toBeUndefined()
  })
})
