import { describe, expect, it } from 'vitest'
import { emptyProfile, profileKey, sanitizeProfiles } from '@/settings/profiles'

describe('按文件配置', () => {
  it('表头签名稳定，列顺序不同视为不同文件', () => {
    expect(profileKey(['a', 'b'])).toBe(profileKey(['a', 'b']))
    expect(profileKey(['a', 'b'])).not.toBe(profileKey(['b', 'a']))
    expect(profileKey(['a'])).not.toBe(profileKey(['a', 'b']))
  })

  it('空配置结构完整', () => {
    const p = emptyProfile('data.csv')
    expect(p.name).toBe('data.csv')
    expect(p.columnAliases).toEqual({})
    expect(p.valueAliases).toEqual({})
    expect(p.series).toEqual({})
    expect(p.sizes).toEqual({})
    expect(p.titles).toEqual({})
  })

  it('校验并保留合法的列映射、颜色、尺寸与标题', () => {
    const profiles = sanitizeProfiles({
      'a\u0001b': {
        name: 'demo',
        updatedAt: 123,
        columnAliases: { a: '甲', bad: 42, empty: '  ' },
        valueAliases: { g: { Low: '低', High: '' } },
        series: { scatter: { A: '#ff0000', B: 'nope' } },
        sizes: { scatter: { width: 400, height: 9999 } },
        titles: { scatter: { title: ' 标题 ', xTitle: ' ' } },
      },
      bad: 1,
    })
    const p = profiles['a\u0001b']
    expect(p).toBeTruthy()
    expect(p.name).toBe('demo')
    expect(p.columnAliases).toEqual({ a: '甲' })
    expect(p.valueAliases).toEqual({ g: { Low: '低' } })
    expect(p.series).toEqual({ scatter: { A: '#ff0000' } })
    expect(p.sizes).toEqual({ scatter: { width: 400, height: 1200 } })
    expect(p.titles).toEqual({ scatter: { title: '标题' } })
    expect(profiles.bad).toBeUndefined()
  })

  it('非对象输入返回空配置', () => {
    expect(sanitizeProfiles(null)).toEqual({})
    expect(sanitizeProfiles('oops')).toEqual({})
  })
})
