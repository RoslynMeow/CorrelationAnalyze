import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { chartThemeTick, bumpTheme } from '@/lib/themeBus'
import { defaultSettings, TOKEN_VARS, type ChartSize, type ChartTitle, type ColorToken, type FileProfile, type Profiles, type Settings } from '@/settings/defaults'
import { mergeSettings } from '@/settings/merge'
import { emptyProfile, profileKey, sanitizeProfiles } from '@/settings/profiles'

const STORAGE_KEY = 'ca-settings-v1'
const PROFILES_KEY = 'ca-profiles-v1'

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

function loadProfiles(): Profiles {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    return raw ? sanitizeProfiles(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const state = ref<Settings>(loadInitial())
  const profiles = ref<Profiles>(loadProfiles())
  const activeProfileKey = ref<string | null>(null)
  const systemDark = ref(false)
  let inited = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let bumpTimer: ReturnType<typeof setTimeout> | undefined
  let profilesTimer: ReturnType<typeof setTimeout> | undefined

  const activeProfile = computed<FileProfile | undefined>(() =>
    activeProfileKey.value ? profiles.value[activeProfileKey.value] : undefined,
  )
  const profileCount = computed(() => Object.keys(profiles.value).length)
  const activeProfileName = computed(() => activeProfile.value?.name ?? '')

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

  /* ---------------- 按文件配置 ---------------- */

  function saveProfilesNow(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.value))
    } catch {
      /* 配额或隐私模式：忽略 */
    }
  }

  function scheduleProfilesSave(): void {
    if (profilesTimer) clearTimeout(profilesTimer)
    profilesTimer = setTimeout(saveProfilesNow, 300)
  }

  function mutateProfile(fn: (p: FileProfile) => FileProfile): boolean {
    const key = activeProfileKey.value
    const cur = key ? profiles.value[key] : undefined
    if (!key || !cur) return false
    const next = fn({ ...cur })
    profiles.value = { ...profiles.value, [key]: { ...next, updatedAt: Date.now() } }
    scheduleProfilesSave()
    return true
  }

  /** 载入新数据时切换当前文件的配置；headers 为 null 时停用 */
  function activateProfile(headers: string[] | null, name = ''): void {
    if (!headers) {
      activeProfileKey.value = null
      return
    }
    const key = profileKey(headers)
    const existing = profiles.value[key]
    if (existing) {
      profiles.value = {
        ...profiles.value,
        [key]: { ...existing, name: name || existing.name, updatedAt: Date.now() },
      }
    } else {
      const all = { ...profiles.value }
      // 只保留最近使用的 80 个文件配置
      if (Object.keys(all).length >= 80) {
        const oldest = Object.entries(all).sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0]
        if (oldest) delete all[oldest[0]]
      }
      all[key] = emptyProfile(name)
      profiles.value = all
    }
    activeProfileKey.value = key
    scheduleProfilesSave()
  }

  function clearCurrentProfile(): void {
    const key = activeProfileKey.value
    if (!key) return
    profiles.value = { ...profiles.value, [key]: emptyProfile(activeProfile.value?.name ?? '') }
    saveProfilesNow()
  }

  function clearAllProfiles(): void {
    const key = activeProfileKey.value
    const name = activeProfile.value?.name ?? ''
    profiles.value = key ? { [key]: emptyProfile(name) } : {}
    saveProfilesNow()
    bumpTheme()
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
    return {
      ...(state.value.charts.series[chartId] ?? {}),
      ...(activeProfile.value?.series[chartId] ?? {}),
    }
  }

  function setSeriesColor(chartId: string, seriesKey: string, color: string): void {
    const done = mutateProfile((p) => {
      const series = { ...p.series }
      const cur = { ...(series[chartId] ?? {}) }
      if (color) cur[seriesKey] = color
      else delete cur[seriesKey]
      if (Object.keys(cur).length) series[chartId] = cur
      else delete series[chartId]
      return { ...p, series }
    })
    if (done) return
    const all = { ...state.value.charts.series }
    const cur = { ...(all[chartId] ?? {}) }
    if (color) cur[seriesKey] = color
    else delete cur[seriesKey]
    if (Object.keys(cur).length) all[chartId] = cur
    else delete all[chartId]
    state.value.charts.series = all
  }

  function clearChartSeries(chartId: string): void {
    mutateProfile((p) => {
      const series = { ...p.series }
      delete series[chartId]
      return { ...p, series }
    })
    const all = { ...state.value.charts.series }
    delete all[chartId]
    state.value.charts.series = all
  }

  /* ---------------- 单图尺寸 ---------------- */

  function chartSize(chartId: string): ChartSize {
    return {
      ...(state.value.charts.sizes[chartId] ?? {}),
      ...(activeProfile.value?.sizes[chartId] ?? {}),
    }
  }

  function setChartSize(
    chartId: string,
    patch: { width?: number | null; height?: number | null },
  ): void {
    const apply = (all: Record<string, ChartSize>): void => {
      const cur: ChartSize = { ...(all[chartId] ?? {}) }
      if (patch.width !== undefined) {
        if (patch.width === null) delete cur.width
        else cur.width = Math.min(1600, Math.max(280, Math.round(patch.width)))
      }
      if (patch.height !== undefined) {
        if (patch.height === null) delete cur.height
        else cur.height = Math.min(1200, Math.max(200, Math.round(patch.height)))
      }
      if (Object.keys(cur).length) all[chartId] = cur
      else delete all[chartId]
    }

    const done = mutateProfile((p) => {
      const sizes = { ...p.sizes }
      apply(sizes)
      return { ...p, sizes }
    })
    if (done) return
    const all = { ...state.value.charts.sizes }
    apply(all)
    state.value.charts.sizes = all
  }

  function clearChartSize(chartId: string): void {
    mutateProfile((p) => {
      const sizes = { ...p.sizes }
      delete sizes[chartId]
      return { ...p, sizes }
    })
    const all = { ...state.value.charts.sizes }
    delete all[chartId]
    state.value.charts.sizes = all
  }

  /* ---------------- 单图标题 ---------------- */

  function chartTitle(chartId: string): ChartTitle {
    return {
      ...(state.value.charts.titles[chartId] ?? {}),
      ...(activeProfile.value?.titles[chartId] ?? {}),
    }
  }

  function setChartTitle(chartId: string, patch: Partial<ChartTitle>): void {
    const apply = (all: Record<string, ChartTitle>): void => {
      const cur: ChartTitle = { ...(all[chartId] ?? {}) }
      for (const key of ['title', 'xTitle', 'yTitle'] as const) {
        const v = patch[key]
        if (v === undefined) continue
        const text = v.trim()
        if (text) cur[key] = text.slice(0, 120)
        else delete cur[key]
      }
      if (Object.keys(cur).length) all[chartId] = cur
      else delete all[chartId]
    }

    const done = mutateProfile((p) => {
      const titles = { ...p.titles }
      apply(titles)
      return { ...p, titles }
    })
    if (done) return
    const all = { ...state.value.charts.titles }
    apply(all)
    state.value.charts.titles = all
  }

  function clearChartTitle(chartId: string): void {
    mutateProfile((p) => {
      const titles = { ...p.titles }
      delete titles[chartId]
      return { ...p, titles }
    })
    const all = { ...state.value.charts.titles }
    delete all[chartId]
    state.value.charts.titles = all
  }

  /* ---------------- 列名 / 取值显示映射 ---------------- */

  function columnLabel(name: string): string {
    return (
      activeProfile.value?.columnAliases[name] ||
      state.value.data.columnAliases[name] ||
      name
    )
  }

  function valueLabel(column: string, value: string): string {
    const raw = String(value)
    const map =
      activeProfile.value?.valueAliases[column] ?? state.value.data.valueAliases[column]
    if (!map) return raw
    return map[raw] ?? map[raw.trim()] ?? raw
  }

  function setColumnAlias(name: string, label: string): void {
    const text = label.trim().slice(0, 120)
    const done = mutateProfile((p) => {
      const columnAliases = { ...p.columnAliases }
      if (text) columnAliases[name] = text
      else delete columnAliases[name]
      return { ...p, columnAliases }
    })
    if (done) return
    const next = { ...state.value.data.columnAliases }
    if (text) next[name] = text
    else delete next[name]
    state.value.data.columnAliases = next
  }

  function setValueAlias(column: string, value: string, label: string): void {
    const key = value.trim()
    const text = label.trim().slice(0, 120)
    const done = mutateProfile((p) => {
      const valueAliases = { ...p.valueAliases }
      const cur = { ...(valueAliases[column] ?? {}) }
      if (text) cur[key] = text
      else delete cur[key]
      if (Object.keys(cur).length) valueAliases[column] = cur
      else delete valueAliases[column]
      return { ...p, valueAliases }
    })
    if (done) return
    const all = { ...state.value.data.valueAliases }
    const cur = { ...(all[column] ?? {}) }
    if (text) cur[key] = text
    else delete cur[key]
    if (Object.keys(cur).length) all[column] = cur
    else delete all[column]
    state.value.data.valueAliases = all
  }

  function clearValueAliases(column: string): void {
    mutateProfile((p) => {
      const valueAliases = { ...p.valueAliases }
      delete valueAliases[column]
      return { ...p, valueAliases }
    })
    const all = { ...state.value.data.valueAliases }
    delete all[column]
    state.value.data.valueAliases = all
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
    return JSON.stringify({ ...state.value, profiles: profiles.value }, null, 2)
  }

  function importJson(text: string): boolean {
    try {
      const raw = JSON.parse(text)
      const oldName = activeProfile.value?.name ?? ''
      state.value = mergeSettings(raw)
      if (raw && typeof raw === 'object' && 'profiles' in raw) {
        profiles.value = sanitizeProfiles((raw as { profiles?: unknown }).profiles)
        const key = activeProfileKey.value
        if (key && !profiles.value[key]) {
          profiles.value = { ...profiles.value, [key]: emptyProfile(oldName) }
        }
        saveProfilesNow()
      }
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
    profiles,
    activeProfileKey,
    activeProfile,
    profileCount,
    activeProfileName,
    isDark,
    palette,
    cssColor,
    assocColor,
    paletteColor,
    init,
    toggleMode,
    activateProfile,
    clearCurrentProfile,
    clearAllProfiles,
    chartSeries,
    setSeriesColor,
    clearChartSeries,
    chartSize,
    setChartSize,
    clearChartSize,
    chartTitle,
    setChartTitle,
    clearChartTitle,
    columnLabel,
    valueLabel,
    setColumnAlias,
    setValueAlias,
    clearValueAliases,
    setPalette,
    setPaletteColor,
    toJson,
    importJson,
    resetAll,
    resetAppearance,
    saveNow,
  }
})
