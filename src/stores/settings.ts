import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { chartThemeTick, bumpTheme } from '@/lib/themeBus'
import { defaultSettings, TOKEN_VARS, type ColorToken, type Settings } from '@/settings/defaults'
import { mergeSettings } from '@/settings/merge'

const STORAGE_KEY = 'ca-settings-v1'

function loadInitial(): Settings {
  if (typeof window === 'undefined') return defaultSettings()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return mergeSettings(JSON.parse(raw))
    // 兼容旧的主题键
    const legacy = localStorage.getItem('ca-theme')
    if (legacy === 'light' || legacy === 'dark') {
      const s = defaultSettings()
      s.appearance.mode = legacy
      return s
    }
  } catch {
    /* 忽略损坏的本地配置 */
  }
  return defaultSettings()
}

export const useSettingsStore = defineStore('settings', () => {
  const state = ref<Settings>(loadInitial())
  const systemDark = ref(false)
  let inited = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let bumpTimer: ReturnType<typeof setTimeout> | undefined

  const isDark = computed(
    () =>
      state.value.appearance.mode === 'dark' ||
      (state.value.appearance.mode === 'system' && systemDark.value),
  )

  const palette = computed(() => state.value.charts.palette)

  function cssColor(cssVar: string): string {
    void chartThemeTick.value
    if (typeof window === 'undefined') return ''
    return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  }

  function assocColor(signed: number | null): string {
    if (signed === null) return cssColor('--accent') || '#4c6ef5'
    return signed >= 0
      ? cssColor('--good') || '#2f9e6e'
      : cssColor('--bad') || '#d64545'
  }

  function paletteColor(index: number): string {
    const p = palette.value
    return p.length ? p[index % p.length] : '#4c6ef5'
  }

  /* ---------------- 应用外观 ---------------- */

  function applyAppearance(): void {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const a = state.value.appearance

    html.dataset.theme = isDark.value ? 'dark' : 'light'

    for (const key of Object.keys(TOKEN_VARS) as ColorToken[]) {
      const v = a.colors[key]
      const cssVar = TOKEN_VARS[key]
      if (v) html.style.setProperty(cssVar, v)
      else html.style.removeProperty(cssVar)
    }

    if (a.radius === null) {
      html.style.removeProperty('--radius-card')
      html.style.removeProperty('--radius-ctl')
    } else {
      html.style.setProperty('--radius-card', `${a.radius}px`)
      html.style.setProperty('--radius-ctl', `${Math.max(3, a.radius - 6)}px`)
    }

    if (a.shadow === 'none') {
      html.style.setProperty('--shadow', 'none')
    } else if (a.shadow === 'strong') {
      html.style.setProperty(
        '--shadow',
        '0 2px 4px rgba(16,24,40,.10), 0 18px 48px rgba(16,24,40,.20)',
      )
    } else {
      html.style.removeProperty('--shadow')
    }

    if (a.density === 'normal') delete html.dataset.density
    else html.dataset.density = a.density

    const t = state.value.table
    if (t.headerBg) html.style.setProperty('--thead-bg', t.headerBg)
    else html.style.removeProperty('--thead-bg')
    if (t.border) html.style.setProperty('--table-border', t.border)
    else html.style.removeProperty('--table-border')
    if (t.fontSize) html.style.setProperty('--table-font', `${t.fontSize}px`)
    else html.style.removeProperty('--table-font')
    if (t.zebra) html.dataset.zebra = 'true'
    else delete html.dataset.zebra

    html.dataset.chartGrid = state.value.charts.grid ? 'true' : 'false'
  }

  function scheduleBump(): void {
    if (bumpTimer) clearTimeout(bumpTimer)
    bumpTimer = setTimeout(() => bumpTheme(), 80)
  }

  function saveNow(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
      localStorage.setItem('ca-theme', isDark.value ? 'dark' : 'light')
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 250)
  }

  watch(
    state,
    () => {
      applyAppearance()
      scheduleBump()
      scheduleSave()
    },
    { deep: true },
  )

  /* ---------------- 初始化 ---------------- */

  function init(): void {
    if (inited || typeof window === 'undefined') return
    inited = true
    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      systemDark.value = mql.matches
      mql.addEventListener('change', (e) => {
        systemDark.value = e.matches
        if (state.value.appearance.mode === 'system') {
          applyAppearance()
          bumpTheme()
        }
      })
    }
    applyAppearance()
    bumpTheme()
  }

  function toggleMode(): void {
    state.value.appearance.mode = isDark.value ? 'light' : 'dark'
  }

  /* ---------------- 图表系列覆盖 ---------------- */

  function chartSeries(chartId: string): Record<string, string> {
    return state.value.charts.series[chartId] ?? {}
  }

  function setSeriesColor(chartId: string, seriesKey: string, color: string): void {
    const all = { ...state.value.charts.series }
    const cur = { ...(all[chartId] ?? {}) }
    if (color) cur[seriesKey] = color
    else delete cur[seriesKey]
    if (Object.keys(cur).length) all[chartId] = cur
    else delete all[chartId]
    state.value.charts.series = all
  }

  function clearChartSeries(chartId: string): void {
    const all = { ...state.value.charts.series }
    delete all[chartId]
    state.value.charts.series = all
  }

  /* ---------------- 色板 ---------------- */

  function setPalette(colors: string[]): void {
    if (colors.length >= 2) state.value.charts.palette = [...colors]
  }

  function setPaletteColor(index: number, color: string): void {
    const next = [...state.value.charts.palette]
    next[index] = color
    state.value.charts.palette = next
  }

  /* ---------------- 导入 / 导出 / 重置 ---------------- */

  function toJson(): string {
    return JSON.stringify(state.value, null, 2)
  }

  function importJson(text: string): boolean {
    try {
      state.value = mergeSettings(JSON.parse(text))
      return true
    } catch {
      return false
    }
  }

  function resetAll(): void {
    state.value = defaultSettings()
  }

  function resetAppearance(): void {
    state.value.appearance = defaultSettings().appearance
  }

  return {
    state,
    isDark,
    palette,
    cssColor,
    assocColor,
    paletteColor,
    init,
    toggleMode,
    chartSeries,
    setSeriesColor,
    clearChartSeries,
    setPalette,
    setPaletteColor,
    toJson,
    importJson,
    resetAll,
    resetAppearance,
    saveNow,
  }
})
