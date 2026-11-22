import { useSettingsStore } from '@/stores/settings'

/** 支持 {name} 形式的占位符 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    params[key] === undefined ? match : String(params[key]),
  )
}

/**
 * 翻译界面文案。key 就是默认中文原文，便于用户直接编辑；
 * 覆盖值保存在 settings.text.overrides 中。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = key
  try {
    const settings = useSettingsStore()
    text = settings.state.text.overrides[key] || key
  } catch {
    // 没有激活的 Pinia（例如纯函数测试）时回退到默认文案
  }
  return interpolate(text, params)
}
