import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { BUILTIN_PRESETS } from '@/presets/builtin'
import { sanitizePresets } from '@/presets/sanitize'
import type { Preset } from '@/presets/types'
import { useDatasetStore } from './dataset'
import { useViewStore } from './view'
import { toast } from '@/composables/useToast'
import { t } from '@/i18n'

const KEY = 'ca-presets-v1'
const BUILTIN_IDS = new Set(BUILTIN_PRESETS.map((p) => p.id))

function loadCustom(): Preset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? sanitizePresets(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export const usePresetsStore = defineStore('presets', () => {
  const custom = ref<Preset[]>(loadCustom())
  const activeId = ref('')
  const all = computed<Preset[]>(() => [...BUILTIN_PRESETS, ...custom.value])

  function save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(custom.value))
    } catch {
      /* 忽略 */
    }
  }

  function apply(id: string): boolean {
    const preset = all.value.find((p) => p.id === id)
    const ds = useDatasetStore().dataset
    if (!preset || !ds) return false
    const view = useViewStore()
    if (preset.id === 'auto') view.init(ds)
    else view.apply(preset.config, ds)
    activeId.value = id
    toast(t('已应用预设：{name}', { name: t(preset.name) }))
    return true
  }

  function saveCurrent(name: string): boolean {
    const ds = useDatasetStore().dataset
    if (!ds) return false
    const view = useViewStore()
    const preset: Preset = {
      id: `custom-${Date.now()}`,
      name: name.trim().slice(0, 60) || t('自定义预设'),
      builtin: false,
      config: view.snapshot(),
    }
    custom.value = [...custom.value, preset]
    activeId.value = preset.id
    save()
    toast(t('已保存预设：{name}', { name: preset.name }))
    return true
  }

  function remove(id: string): void {
    custom.value = custom.value.filter((p) => p.id !== id)
    if (activeId.value === id) activeId.value = ''
    save()
    toast(t('已删除预设'))
  }

  function toJson(): string {
    return JSON.stringify(custom.value, null, 2)
  }

  function importJson(text: string): boolean {
    try {
      const incoming = sanitizePresets(JSON.parse(text)).filter((p) => !BUILTIN_IDS.has(p.id))
      if (!incoming.length) return false
      const map = new Map(custom.value.map((p) => [p.id, p]))
      for (const p of incoming) map.set(p.id, p)
      custom.value = [...map.values()]
      save()
      return true
    } catch {
      return false
    }
  }

  return {
    custom,
    all,
    activeId,
    apply,
    saveCurrent,
    remove,
    toJson,
    importJson,
  }
})
