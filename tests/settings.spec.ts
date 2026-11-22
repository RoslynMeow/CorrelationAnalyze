import { describe, expect, it } from 'vitest'
import { defaultSettings, PALETTES } from '@/settings/defaults'
import { mergeSettings } from '@/settings/merge'
import { divergingScale, isHexColor, mixHex, sequentialScale, withAlpha } from '@/lib/color'

describe('颜色工具', () => {
  it('识别合法十六进制', () => {
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('#4c6ef5')).toBe(true)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#12345')).toBe(false)
  })

  it('混合颜色', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('透明度后缀', () => {
    expect(withAlpha('#4c6ef5', 0.5)).toBe('#4c6ef580')
    expect(withAlpha('rgba(0,0,0,.5)', 0.5)).toBe('rgba(0,0,0,.5)')
  })

  it('色阶为递增位置', () => {
    const d = divergingScale('#0000ff', '#ffffff', '#ff0000')
    expect(d.map(([p]) => p)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(sequentialScale('#ffffff', '#0000ff')).toHaveLength(3)
  })
})

describe('配置合并与校验', () => {
  it('空值 / 垃圾输入回退默认值', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings())
    expect(mergeSettings('oops')).toEqual(defaultSettings())
    expect(mergeSettings({ appearance: 42 })).toEqual(defaultSettings())
  })

  it('保留合法的外观颜色，丢弃非法值', () => {
    const s = mergeSettings({
      appearance: { mode: 'dark', colors: { bg: '#112233', text: 'not-a-color' }, radius: 10 },
    })
    expect(s.appearance.mode).toBe('dark')
    expect(s.appearance.colors.bg).toBe('#112233')
    expect(s.appearance.colors.text).toBeUndefined()
    expect(s.appearance.radius).toBe(10)
  })

  it('模式 / 密度 / 阴影枚举非法时回退', () => {
    const s = mergeSettings({
      appearance: { mode: 'neon', density: 'huge', shadow: 'heavy' },
    })
    expect(s.appearance.mode).toBe('system')
    expect(s.appearance.density).toBe('normal')
    expect(s.appearance.shadow).toBe('soft')
  })

  it('圆角与导出倍数限幅', () => {
    expect(mergeSettings({ appearance: { radius: 999 } }).appearance.radius).toBe(28)
    expect(mergeSettings({ appearance: { radius: -3 } }).appearance.radius).toBe(0)
    expect(mergeSettings({ exportSettings: { scale: 99 } }).exportSettings.scale).toBe(4)
    expect(mergeSettings({ exportSettings: { scale: 0 } }).exportSettings.scale).toBe(1)
  })

  it('色板至少两个合法颜色才采用', () => {
    const custom = ['#111111', '#222222', '#333333']
    expect(mergeSettings({ charts: { palette: custom } }).charts.palette).toEqual(custom)
    expect(mergeSettings({ charts: { palette: ['#111111', 'bad'] } }).charts.palette).toEqual(
      PALETTES[0].colors,
    )
  })

  it('单图系列颜色只保留合法项', () => {
    const s = mergeSettings({
      charts: { series: { scatter: { A: '#ff0000', B: 'oops' }, bad: 'x' } },
    })
    expect(s.charts.series.scatter).toEqual({ A: '#ff0000' })
    expect(s.charts.series.bad).toBeUndefined()
  })

  it('表格字号限幅，斑马纹保留布尔值', () => {
    const s = mergeSettings({ table: { fontSize: 99, zebra: true } })
    expect(s.table.fontSize).toBe(18)
    expect(s.table.zebra).toBe(true)
  })

  it('单图宽高限幅，非法尺寸被丢弃', () => {
    const s = mergeSettings({
      charts: {
        sizes: {
          matrix: { width: 400, height: 9999 },
          scatter: { width: 'x' },
          bad: 1,
        },
      },
    })
    expect(s.charts.sizes.matrix).toEqual({ width: 400, height: 1200 })
    expect(s.charts.sizes.scatter).toBeUndefined()
    expect(s.charts.sizes.bad).toBeUndefined()
  })

  it('单图标题覆盖只保留非空文本', () => {
    const s = mergeSettings({
      charts: {
        titles: {
          scatter: { title: '压力 vs 心理健康', xTitle: '   ', yTitle: '指数' },
          bad: 'x',
        },
      },
    })
    expect(s.charts.titles.scatter).toEqual({ title: '压力 vs 心理健康', yTitle: '指数' })
    expect(s.charts.titles.bad).toBeUndefined()
  })

  it('Plotly 原生工具栏默认关闭，可手动开启', () => {
    expect(mergeSettings({}).charts.showModeBar).toBe(false)
    expect(mergeSettings({ charts: { showModeBar: true } }).charts.showModeBar).toBe(true)
  })

  it('全局图表宽度默认 null，越界时限幅', () => {
    expect(mergeSettings({}).charts.defaultWidth).toBeNull()
    expect(mergeSettings({ charts: { defaultWidth: 900 } }).charts.defaultWidth).toBe(900)
    expect(mergeSettings({ charts: { defaultWidth: 100 } }).charts.defaultWidth).toBe(280)
  })

  it('导出格式非法时回退 PNG', () => {
    expect(mergeSettings({ exportSettings: { format: 'pdf' } }).exportSettings.format).toBe('png')
    expect(mergeSettings({ exportSettings: { format: 'svg' } }).exportSettings.format).toBe('svg')
  })

  it('配置 JSON 往返保持一致', () => {
    const s = mergeSettings({
      appearance: { mode: 'system', colors: { accent: '#123456' }, density: 'compact' },
      charts: { palette: ['#000000', '#ffffff'], grid: false, series: { radar: { A: '#abcdef' } } },
      table: { headerBg: '#eeeeee', zebra: true },
      exportSettings: { format: 'svg', scale: 3 },
    })
    const round = mergeSettings(JSON.parse(JSON.stringify(s)))
    expect(round).toEqual(s)
  })

  it('文案与数据映射结构被保留（为第 2 期预留）', () => {
    const s = mergeSettings({
      text: { overrides: { 'tab.overview': '总览' } },
      data: { columnAliases: { age: '年龄' }, valueAliases: { risk: { Low: '低' } } },
    })
    expect(s.text.overrides['tab.overview']).toBe('总览')
    expect(s.data.columnAliases.age).toBe('年龄')
    expect(s.data.valueAliases.risk.Low).toBe('低')
  })

  it('列名与取值映射保留合法字符串，丢弃空值', () => {
    const s = mergeSettings({
      data: {
        columnAliases: { age: '年龄', empty: '   ', bad: 42 },
        valueAliases: { risk: { Low: '低', High: '' } },
      },
    })
    expect(s.data.columnAliases).toEqual({ age: '年龄' })
    expect(s.data.valueAliases).toEqual({ risk: { Low: '低' } })
  })
})
