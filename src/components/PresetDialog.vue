<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePresetsStore } from '@/stores/presets'
import { useDatasetStore } from '@/stores/dataset'
import { presetColumns } from '@/presets/types'
import { downloadDataUrl } from '@/lib/exportChart'
import { toast } from '@/composables/useToast'
import { t } from '@/i18n'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const presets = usePresetsStore()
const ds = useDatasetStore()
const selected = ref('auto')
const newName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const matchMap = computed(() => {
  const map = new Map<string, number>()
  for (const p of presets.all) {
    if (p.id === 'auto') map.set(p.id, 999)
    else {
      const cols = presetColumns(p)
      map.set(
        p.id,
        ds.dataset ? cols.filter((n) => !!ds.column(n)).length : 0,
      )
    }
  }
  return map
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const active = presets.activeId
    if (active && presets.all.some((p) => p.id === active)) selected.value = active
    else selected.value = presets.all[0]?.id || 'auto'
    newName.value = ''
  },
  { immediate: true },
)

function apply(): void {
  if (!presets.apply(selected.value)) return
  emit('close')
}

function saveCurrent(): void {
  if (presets.saveCurrent(newName.value)) newName.value = ''
}

function remove(id: string, name: string): void {
  if (window.confirm(t('删除预设「{name}」？', { name }))) presets.remove(id)
}

function exportPresets(): void {
  const blob = new Blob([presets.toJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, 'correlation-presets.json')
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  toast(t('预设已导出'))
}

async function onImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  try {
    const text = await f.text()
    if (presets.importJson(text)) toast(t('预设已导入'))
    else toast(t('预设文件格式不正确'), 3500)
  } catch {
    toast(t('读取预设失败'), 3500)
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="report-veil" @click.self="emit('close')">
      <div class="report-dialog preset-dialog" role="dialog" aria-modal="true" :aria-label="$t('预设模板')">
        <header class="report-dialog-head">
          <h3>{{ $t('预设模板') }}</h3>
          <button class="btn icon" type="button" :title="$t('关闭')" @click="emit('close')">✕</button>
        </header>

        <div class="report-dialog-body">
          <p class="hint">
            {{ $t('预设会一次性设置目标、分组、散点、雷达等面板的选择。自定义预设保存在本机。') }}
          </p>

          <div class="preset-list">
            <div
              v-for="p in presets.all"
              :key="p.id"
              class="preset-item"
              :class="{ active: selected === p.id }"
              role="button"
              tabindex="0"
              @click="selected = p.id"
              @keydown.enter.prevent="selected = p.id"
              @keydown.space.prevent="selected = p.id"
            >
              <span class="preset-main">
                <b>{{ $t(p.name) }}</b>
                <span v-if="p.description" class="hint">{{ $t(p.description) }}</span>
              </span>
              <span class="preset-meta">
                <span v-if="matchMap.get(p.id) === 999" class="sumtag">{{ $t('自动') }}</span>
                <span v-else class="hint">{{ $t('匹配 {n} 列', { n: matchMap.get(p.id) || 0 }) }}</span>
                <button
                  v-if="!p.builtin"
                  class="linkbtn"
                  type="button"
                  :title="$t('删除')"
                  @click.stop="remove(p.id, p.name)"
                >
                  {{ $t('删除') }}
                </button>
              </span>
            </div>
          </div>

          <div class="preset-divider">
            <span>{{ $t('保存当前配置') }}</span>
          </div>
          <div class="report-actions">
            <input
              v-model="newName"
              class="alias-search"
              type="text"
              :placeholder="$t('预设名称，例如「我的分析模板」')"
              maxlength="60"
            />
            <button class="btn" type="button" :disabled="!newName.trim()" @click="saveCurrent">
              {{ $t('保存') }}
            </button>
          </div>

          <div class="preset-divider"><span>{{ $t('导入 / 导出') }}</span></div>
          <div class="report-actions">
            <button class="btn" type="button" @click="exportPresets">{{ $t('导出预设 JSON') }}</button>
            <button class="btn" type="button" @click="fileInput?.click()">{{ $t('导入预设 JSON') }}</button>
            <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport" />
          </div>
        </div>

        <footer class="report-dialog-foot">
          <button class="btn" type="button" @click="emit('close')">{{ $t('取消') }}</button>
          <button class="btn primary" type="button" @click="apply">{{ $t('应用预设') }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
