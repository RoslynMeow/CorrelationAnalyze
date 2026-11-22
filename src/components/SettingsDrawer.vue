<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ColorField from '@/components/ColorField.vue'
import { PALETTES, DEFAULT_HEATMAP } from '@/settings/defaults'
import { TEXT_CATALOG } from '@/i18n/catalog'
import { t } from '@/i18n'
import { useDatasetStore } from '@/stores/dataset'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/composables/useToast'
import { downloadDataUrl } from '@/lib/exportChart'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const settings = useSettingsStore()
const ds = useDatasetStore()
const tab = ref<'appearance' | 'charts' | 'table' | 'data' | 'text' | 'export' | 'config'>('appearance')
const fileInput = ref<HTMLInputElement | null>(null)
const colQuery = ref('')
const valueColumn = ref('')
const textQuery = ref('')
const overridesOnly = ref(false)

const TABS = [
  { id: 'appearance', label: '外观' },
  { id: 'charts', label: '图表' },
  { id: 'table', label: '表格' },
  { id: 'data', label: '数据' },
  { id: 'text', label: '文案' },
  { id: 'export', label: '导出' },
  { id: 'config', label: '配置' },
] as const

const aliasColumns = computed(() => ds.dataset?.columns ?? [])

const filteredColumns = computed(() => {
  const q = colQuery.value.trim().toLowerCase()
  if (!q) return aliasColumns.value
  return aliasColumns.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) || settings.columnLabel(c.name).toLowerCase().includes(q),
  )
})

const valueColumns = computed(() =>
  aliasColumns.value.filter((c) => c.uniqueCount >= 2 && c.uniqueCount <= 80),
)

watch(
  () => ds.datasetId,
  () => {
    const first =
      valueColumns.value.find((c) => c.type === 'category') || valueColumns.value[0]
    valueColumn.value = first?.name ?? ''
  },
  { immediate: true },
)

watch(valueColumns, (list) => {
  if (!list.some((c) => c.name === valueColumn.value)) {
    valueColumn.value = list[0]?.name ?? ''
  }
})

const valueCol = computed(() => (valueColumn.value ? ds.column(valueColumn.value) : undefined))
const valueAliasCount = computed(
  () => Object.keys(settings.state.data.valueAliases[valueColumn.value] ?? {}).length,
)

const filteredTexts = computed(() => {
  const q = textQuery.value.trim().toLowerCase()
  return TEXT_CATALOG.filter((key) => {
    const ov = settings.state.text.overrides[key] || ''
    if (overridesOnly.value && !ov) return false
    if (!q) return true
    return key.toLowerCase().includes(q) || ov.toLowerCase().includes(q)
  })
})

function onColAlias(name: string, e: Event): void {
  settings.setColumnAlias(name, (e.target as HTMLInputElement).value)
}

function onValAlias(value: string, e: Event): void {
  settings.setValueAlias(valueColumn.value, value, (e.target as HTMLInputElement).value)
}

function onText(key: string, e: Event): void {
  settings.setTextOverride(key, (e.target as HTMLInputElement).value)
}

function resetTextAll(): void {
  if (window.confirm(t('恢复全部界面文案？'))) {
    settings.clearTextOverrides()
    toast(t('已恢复默认文案'))
  }
}

const radius = computed(() => settings.state.appearance.radius ?? 14)
const tableHeaderFallback = computed(() => settings.cssColor('--panel-2') || '#f8fafc')
const tableBorderFallback = computed(() => settings.cssColor('--border') || '#e4e9f2')

function sameColors(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase())
}

function applyPreset(colors: string[]): void {
  settings.setPalette(colors)
}

function onRadius(e: Event): void {
  settings.state.appearance.radius = Number((e.target as HTMLInputElement).value)
}

function setHeatmap(key: 'neg' | 'mid' | 'pos' | 'low' | 'high', v: string | null): void {
  settings.state.charts.heatmap[key] = v || DEFAULT_HEATMAP[key]
}

function exportConfig(): void {
  const blob = new Blob([settings.toJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, 'association-analyzer-settings.json')
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  toast(t('配置已导出'))
}

async function onImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  try {
    const text = await f.text()
    if (settings.importJson(text)) toast(t('配置已导入'))
    else toast(t('配置文件格式不正确'), 3500)
  } catch {
    toast(t('读取配置失败'), 3500)
  } finally {
    input.value = ''
  }
}

function resetAll(): void {
  if (window.confirm(t('恢复全部默认设置？当前自定义颜色、色板与单图配色都会清除。'))) {
    settings.resetAll()
    toast(t('已恢复默认设置'))
  }
}

function clearCurrentProfile(): void {
  if (window.confirm(t('清除当前 CSV 的列映射与单图配置？全局外观设置不受影响。'))) {
    settings.clearCurrentProfile()
    toast(t('已清除当前文件配置'))
  }
}

function clearAllProfiles(): void {
  if (window.confirm(t('清除所有按文件保存的列映射与图表配置？全局外观设置不受影响。'))) {
    settings.clearAllProfiles()
    toast(t('已清除全部文件配置'))
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="drawer-veil" @click="emit('close')"></div>
    <aside v-if="props.open" class="drawer" role="dialog" :aria-label="$t('设置')">
      <header class="drawer-head">
        <h3>{{ $t('设置') }}</h3>
        <span class="hint">{{ $t('自动保存在本机') }}</span>
        <button class="btn icon" type="button" :title="$t('关闭')" @click="emit('close')">✕</button>
      </header>

      <nav class="drawer-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ $t(t.label) }}
        </button>
      </nav>

      <div class="drawer-body">
        <!-- ================= 外观 ================= -->
        <section v-if="tab === 'appearance'" class="set-section">
          <div class="set-block">
            <div class="set-label">{{ $t('主题') }}</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.appearance.mode === 'light' }"
                @click="settings.state.appearance.mode = 'light'"
              >
                {{ $t('浅色') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.mode === 'dark' }"
                @click="settings.state.appearance.mode = 'dark'"
              >
                {{ $t('深色') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.mode === 'system' }"
                @click="settings.state.appearance.mode = 'system'"
              >
                {{ $t('跟随系统') }}
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('颜色') }}</div>
            <div class="color-grid">
              <ColorField
                :label="$t('背景')"
                :model-value="settings.state.appearance.colors.bg ?? null"
                :fallback="settings.cssColor('--bg')"
                @update:model-value="settings.state.appearance.colors.bg = $event ?? undefined"
              />
              <ColorField
                :label="$t('面板')"
                :model-value="settings.state.appearance.colors.panel ?? null"
                :fallback="settings.cssColor('--panel')"
                @update:model-value="settings.state.appearance.colors.panel = $event ?? undefined"
              />
              <ColorField
                :label="$t('面板浅色')"
                :model-value="settings.state.appearance.colors.panel2 ?? null"
                :fallback="settings.cssColor('--panel-2')"
                @update:model-value="settings.state.appearance.colors.panel2 = $event ?? undefined"
              />
              <ColorField
                :label="$t('文字')"
                :model-value="settings.state.appearance.colors.text ?? null"
                :fallback="settings.cssColor('--text')"
                @update:model-value="settings.state.appearance.colors.text = $event ?? undefined"
              />
              <ColorField
                :label="$t('次要文字')"
                :model-value="settings.state.appearance.colors.muted ?? null"
                :fallback="settings.cssColor('--muted')"
                @update:model-value="settings.state.appearance.colors.muted = $event ?? undefined"
              />
              <ColorField
                :label="$t('边框')"
                :model-value="settings.state.appearance.colors.border ?? null"
                :fallback="settings.cssColor('--border')"
                @update:model-value="settings.state.appearance.colors.border = $event ?? undefined"
              />
              <ColorField
                :label="$t('强调色')"
                :model-value="settings.state.appearance.colors.accent ?? null"
                :fallback="settings.cssColor('--accent')"
                @update:model-value="settings.state.appearance.colors.accent = $event ?? undefined"
              />
              <ColorField
                :label="$t('强调浅底')"
                :model-value="settings.state.appearance.colors.accentSoft ?? null"
                :fallback="settings.cssColor('--accent-soft')"
                @update:model-value="settings.state.appearance.colors.accentSoft = $event ?? undefined"
              />
              <ColorField
                :label="$t('正相关')"
                :model-value="settings.state.appearance.colors.good ?? null"
                :fallback="settings.cssColor('--good')"
                @update:model-value="settings.state.appearance.colors.good = $event ?? undefined"
              />
              <ColorField
                :label="$t('负相关')"
                :model-value="settings.state.appearance.colors.bad ?? null"
                :fallback="settings.cssColor('--bad')"
                @update:model-value="settings.state.appearance.colors.bad = $event ?? undefined"
              />
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">
              {{ $t('圆角') }}
              <span class="set-value">{{ radius }}px</span>
              <button
                v-if="settings.state.appearance.radius !== null"
                class="linkbtn"
                type="button"
                @click="settings.state.appearance.radius = null"
              >
                {{ $t('默认') }}
              </button>
            </div>
            <input class="range" type="range" min="0" max="24" step="1" :value="radius" @input="onRadius" />
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('密度') }}</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.appearance.density === 'compact' }"
                @click="settings.state.appearance.density = 'compact'"
              >
                {{ $t('紧凑') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.density === 'normal' }"
                @click="settings.state.appearance.density = 'normal'"
              >
                {{ $t('标准') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.density === 'comfortable' }"
                @click="settings.state.appearance.density = 'comfortable'"
              >
                {{ $t('宽松') }}
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('卡片阴影') }}</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.appearance.shadow === 'none' }"
                @click="settings.state.appearance.shadow = 'none'"
              >
                {{ $t('无') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.shadow === 'soft' }"
                @click="settings.state.appearance.shadow = 'soft'"
              >
                {{ $t('柔和') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.shadow === 'strong' }"
                @click="settings.state.appearance.shadow = 'strong'"
              >
                {{ $t('强') }}
              </button>
            </div>
          </div>

          <button class="btn" type="button" @click="settings.resetAppearance()">{{ $t('恢复默认外观') }}</button>
        </section>

        <!-- ================= 图表 ================= -->
        <section v-else-if="tab === 'charts'" class="set-section">
          <div class="set-block">
            <div class="set-label">{{ $t('分类色板') }}</div>
            <div class="palette-list">
              <button
                v-for="p in PALETTES"
                :key="p.id"
                type="button"
                class="palette-card"
                :class="{ active: sameColors(settings.state.charts.palette, p.colors) }"
                @click="applyPreset(p.colors)"
              >
                <span class="palette-name">{{ $t(p.name) }}</span>
                <span class="palette-swatches">
                  <i v-for="c in p.colors" :key="c" :style="{ background: c }"></i>
                </span>
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('自定义色板') }}</div>
            <div class="color-grid">
              <ColorField
                v-for="(c, i) in settings.state.charts.palette"
                :key="i"
                :label="$t('颜色 {n}', { n: i + 1 })"
                :model-value="c"
                :fallback="c"
                :resettable="false"
                @update:model-value="settings.setPaletteColor(i, $event || c)"
              />
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('图例位置') }}</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.charts.legendPosition === 'bottom' }"
                @click="settings.state.charts.legendPosition = 'bottom'"
              >
                {{ $t('底部') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.charts.legendPosition === 'top' }"
                @click="settings.state.charts.legendPosition = 'top'"
              >
                {{ $t('顶部') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.charts.legendPosition === 'right' }"
                @click="settings.state.charts.legendPosition = 'right'"
              >
                {{ $t('右侧') }}
              </button>
              <button
                type="button"
                :class="{ active: settings.state.charts.legendPosition === 'hidden' }"
                @click="settings.state.charts.legendPosition = 'hidden'"
              >
                {{ $t('隐藏') }}
              </button>
            </div>
            <p class="hint">{{ $t('图例与 X 轴标题重叠时，可改为顶部或右侧。') }}</p>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('图表宽度上限') }}</div>
            <select v-model.number="settings.state.charts.defaultWidth" class="set-select">
              <option :value="null">{{ $t('自适应（100%）') }}</option>
              <option :value="600">600px</option>
              <option :value="760">760px</option>
              <option :value="900">900px</option>
              <option :value="1100">1100px</option>
            </select>
            <p class="hint">
              {{ $t('单图尺寸可在每张图左上角的「图表设置」里单独改（含小/中/大预设），优先级高于这里。') }}
            </p>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('热力图色阶') }}</div>
            <div class="color-grid">
              <ColorField
                :label="$t('负 / 低端')"
                :model-value="settings.state.charts.heatmap.neg"
                :fallback="settings.state.charts.heatmap.neg"
                :resettable="false"
                @update:model-value="setHeatmap('neg', $event)"
              />
              <ColorField
                :label="$t('中间')"
                :model-value="settings.state.charts.heatmap.mid"
                :fallback="settings.state.charts.heatmap.mid"
                :resettable="false"
                @update:model-value="setHeatmap('mid', $event)"
              />
              <ColorField
                :label="$t('正 / 高端')"
                :model-value="settings.state.charts.heatmap.pos"
                :fallback="settings.state.charts.heatmap.pos"
                :resettable="false"
                @update:model-value="setHeatmap('pos', $event)"
              />
              <ColorField
                :label="$t('类别矩阵低端')"
                :model-value="settings.state.charts.heatmap.low"
                :fallback="settings.state.charts.heatmap.low"
                :resettable="false"
                @update:model-value="setHeatmap('low', $event)"
              />
              <ColorField
                :label="$t('类别矩阵高端')"
                :model-value="settings.state.charts.heatmap.high"
                :fallback="settings.state.charts.heatmap.high"
                :resettable="false"
                @update:model-value="setHeatmap('high', $event)"
              />
            </div>
          </div>

          <div class="set-block">
            <label class="chk"><input v-model="settings.state.charts.grid" type="checkbox" /> {{ $t('显示坐标轴网格') }}</label>
            <label class="chk">
              <input v-model="settings.state.charts.transparent" type="checkbox" /> {{ $t('图表背景透明') }}
            </label>
            <label class="chk">
              <input v-model="settings.state.charts.showModeBar" type="checkbox" /> {{ $t('显示 Plotly 自带工具栏') }}
            </label>
            <p class="hint" style="margin-top: 6px">
              {{ $t('默认关闭，使用图左上角的应用工具条（导出、复制、重置缩放、尺寸与配色）。需要原生缩放/平移按钮时可以打开。') }}
            </p>
          </div>
        </section>

        <!-- ================= 表格 ================= -->
        <section v-else-if="tab === 'table'" class="set-section">
          <div class="color-grid">
            <ColorField
              :label="$t('表头背景')"
              :model-value="settings.state.table.headerBg"
              :fallback="tableHeaderFallback"
              @update:model-value="settings.state.table.headerBg = $event"
            />
            <ColorField
              :label="$t('表格边框')"
              :model-value="settings.state.table.border"
              :fallback="tableBorderFallback"
              @update:model-value="settings.state.table.border = $event"
            />
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('字号') }}</div>
            <select v-model.number="settings.state.table.fontSize" class="set-select">
              <option :value="null">{{ $t('默认（12.5px）') }}</option>
              <option :value="11">11px</option>
              <option :value="12">12px</option>
              <option :value="13">13px</option>
              <option :value="14">14px</option>
            </select>
          </div>

          <label class="chk"><input v-model="settings.state.table.zebra" type="checkbox" /> {{ $t('斑马纹（隔行浅底）') }}</label>
        </section>

        <!-- ================= 数据 ================= -->
        <section v-else-if="tab === 'data'" class="set-section">
          <p class="hint">
            {{ $t('映射只改显示，统计、缓存与导出仍使用原始列名和取值。映射按 CSV 表头自动保存，同一组列再次打开会恢复。') }}
          </p>

          <template v-if="aliasColumns.length">
            <div class="set-block">
              <div class="set-label">{{ $t('列显示名') }}</div>
              <input
                v-model="colQuery"
                class="alias-search"
                type="search"
                :placeholder="$t('搜索列名…')"
              />
              <div class="alias-list">
                <div v-for="c in filteredColumns" :key="c.name" class="alias-row">
                  <span class="alias-orig" :title="c.name">{{ c.name }}</span>
                  <input
                    class="alias-input"
                    :value="settings.columnLabel(c.name) === c.name ? '' : settings.columnLabel(c.name)"
                    :placeholder="c.name"
                    @change="onColAlias(c.name, $event)"
                  />
                </div>
                <p v-if="!filteredColumns.length" class="hint alias-empty">{{ $t('没有匹配的列') }}</p>
              </div>
            </div>

            <div class="set-block">
              <div class="set-label">
                {{ $t('类别取值显示名') }}
                <span class="hint">{{ $t('{n} 条映射', { n: valueAliasCount }) }}</span>
              </div>
              <select v-model="valueColumn" class="set-select">
                <option v-for="c in valueColumns" :key="c.name" :value="c.name">
                  {{
                    $t('{name}（{n} 个取值）', {
                      name: settings.columnLabel(c.name),
                      n: c.uniqueCount,
                    })
                  }}
                </option>
              </select>
              <div v-if="valueCol" class="alias-list">
                <div v-for="v in valueCol.unique" :key="v" class="alias-row">
                  <span class="alias-orig" :title="v">{{ v }}</span>
                  <input
                    class="alias-input"
                    :value="settings.valueLabel(valueColumn, v) === v ? '' : settings.valueLabel(valueColumn, v)"
                    :placeholder="v"
                    @change="onValAlias(v, $event)"
                  />
                </div>
              </div>
              <button
                v-if="valueAliasCount"
                class="linkbtn"
                type="button"
                style="align-self: flex-start"
                @click="settings.clearValueAliases(valueColumn)"
              >
                {{ $t('清除本列映射') }}
              </button>
            </div>
          </template>
          <p v-else class="hint">{{ $t('载入 CSV 后可以编辑列名与类别取值。') }}</p>
        </section>

        <!-- ================= 文案 ================= -->
        <section v-else-if="tab === 'text'" class="set-section">
          <p class="hint">
            {{ $t('左边是默认文案，右边填写自定义文案；留空恢复默认。只影响界面显示，不影响数据列名与取值。') }}
          </p>
          <div class="text-toolbar">
            <input
              v-model="textQuery"
              class="alias-search"
              type="search"
              :placeholder="$t('搜索文案…')"
            />
            <label class="chk"><input v-model="overridesOnly" type="checkbox" /> {{ $t('只看已修改') }}</label>
          </div>
          <div class="text-list">
            <div v-for="key in filteredTexts" :key="key" class="text-row">
              <span class="text-key" :title="key">{{ key }}</span>
              <input
                class="text-input"
                :value="settings.state.text.overrides[key] ?? ''"
                :placeholder="key"
                @change="onText(key, $event)"
              />
              <button
                v-if="settings.state.text.overrides[key]"
                class="linkbtn"
                type="button"
                @click="settings.setTextOverride(key, '')"
              >
                {{ $t('重置') }}
              </button>
            </div>
            <p v-if="!filteredTexts.length" class="hint alias-empty">{{ $t('没有匹配的文案') }}</p>
          </div>
          <div class="set-actions">
            <span class="hint">{{ $t('已修改 {n} 条', { n: settings.textOverrideCount }) }}</span>
            <button
              class="btn"
              type="button"
              :disabled="!settings.textOverrideCount"
              @click="resetTextAll"
            >
              {{ $t('恢复全部文案') }}
            </button>
          </div>
        </section>

        <!-- ================= 导出 ================= -->
        <section v-else-if="tab === 'export'" class="set-section">
          <div class="set-block">
            <div class="set-label">{{ $t('默认格式') }}</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.exportSettings.format === 'png' }"
                @click="settings.state.exportSettings.format = 'png'"
              >
                PNG
              </button>
              <button
                type="button"
                :class="{ active: settings.state.exportSettings.format === 'svg' }"
                @click="settings.state.exportSettings.format = 'svg'"
              >
                {{ $t('SVG（矢量）') }}
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('PNG 倍数') }}</div>
            <div class="seg full">
              <button
                v-for="s in [1, 2, 3]"
                :key="s"
                type="button"
                :class="{ active: settings.state.exportSettings.scale === s }"
                @click="settings.state.exportSettings.scale = s"
              >
                {{ s }}x
              </button>
            </div>
          </div>

          <p class="hint">
            {{ $t('每张图左上角工具条：复制图片、下载 PNG / SVG、复制数据 TSV。SVG 不受倍数影响，始终为矢量。') }}
          </p>
        </section>

        <!-- ================= 配置 ================= -->
        <section v-else class="set-section">
          <div class="set-block">
            <div class="set-label">
              {{ $t('按文件配置') }}
              <span class="hint">{{ $t('{n} 个文件', { n: settings.profileCount }) }}</span>
            </div>
            <p class="hint">
              {{
                $t('当前文件：{name}。列映射、单图尺寸 / 标题 / 配色按 CSV 表头保存。', {
                  name: settings.activeProfileName || $t('未载入'),
                })
              }}
            </p>
            <div class="set-actions">
              <button
                class="btn"
                type="button"
                :disabled="!settings.activeProfileKey"
                @click="clearCurrentProfile"
              >
                {{ $t('清除当前文件配置') }}
              </button>
              <button class="btn" type="button" :disabled="!settings.profileCount" @click="clearAllProfiles">
                {{ $t('清除全部文件配置') }}
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">{{ $t('导入 / 导出') }}</div>
            <div class="set-actions">
              <button class="btn" type="button" @click="exportConfig">{{ $t('导出配置 JSON') }}</button>
              <button class="btn" type="button" @click="fileInput?.click()">{{ $t('导入配置 JSON') }}</button>
              <button class="btn" type="button" @click="resetAll">{{ $t('恢复全部默认') }}</button>
            </div>
            <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport" />
            <p class="hint">
              {{ $t('全局设置保存在 `ca-settings-v1`，按文件配置保存在 `ca-profiles-v1`；导出的 JSON 会同时包含两者。') }}
            </p>
          </div>
        </section>
      </div>
    </aside>
  </Teleport>
</template>
