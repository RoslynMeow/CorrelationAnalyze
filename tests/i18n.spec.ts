import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { interpolate, t } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'

describe('界面文案', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('占位符替换与缺失占位符保留', () => {
    expect(interpolate('{a} / {b}', { a: 1, b: 'x' })).toBe('1 / x')
    expect(interpolate('{a} / {b}', { a: 1 })).toBe('1 / {b}')
    expect(interpolate('无占位符')).toBe('无占位符')
  })

  it('没有覆盖时返回默认文案', () => {
    expect(t('关联总览')).toBe('关联总览')
    expect(t('{n} 行', { n: 3 })).toBe('3 行')
  })

  it('设置覆盖后立即生效，并可清除', () => {
    const settings = useSettingsStore()
    settings.setTextOverride('关联总览', 'Overview')
    expect(t('关联总览')).toBe('Overview')
    expect(t('相关矩阵')).toBe('相关矩阵')

    settings.setTextOverride('关联总览', '')
    expect(t('关联总览')).toBe('关联总览')
  })

  it('恢复全部文案', () => {
    const settings = useSettingsStore()
    settings.setTextOverride('关联总览', 'Overview')
    settings.setTextOverride('相关矩阵', 'Matrix')
    expect(settings.textOverrideCount).toBe(2)
    settings.clearTextOverrides()
    expect(settings.textOverrideCount).toBe(0)
    expect(t('关联总览')).toBe('关联总览')
  })
})
