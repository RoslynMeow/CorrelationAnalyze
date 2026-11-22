<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ColorField from '@/components/ColorField.vue'
import { PALETTES, DEFAULT_HEATMAP } from '@/settings/defaults'
import { useDatasetStore } from '@/stores/dataset'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/composables/useToast'
import { downloadDataUrl } from '@/lib/exportChart'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const settings = useSettingsStore()
const ds = useDatasetStore()
const tab = ref<'appearance' | 'charts' | 'table' | 'data' | 'export' | 'config'>('appearance')
const fileInput = ref<HTMLInputElement | null>(null)
const colQuery = ref('')
const valueColumn = ref('')

const TABS = [
  { id: 'appearance', label: '外观' },
  { id: 'charts', label: '图表' },
  { id: 'table', label: '表格' },
  { id: 'data', label: '数据' },
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

function onColAlias(name: string, e: Event): void {
  settings.setColumnAlias(name, (e.target as HTMLInputElement).value)
}

function onValAlias(value: string, e: Event): void {
  settings.setValueAlias(valueColumn.value, value, (e.target as HTMLInputElement).value)
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
  toast('配置已导出')
}

async function onImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  try {
    const text = await f.text()
    if (settings.importJson(text)) toast('配置已导入')
    else toast('配置文件格式不正确', 3500)
  } catch {
    toast('读取配置失败', 3500)
  } finally {
    input.value = ''
  }
}

function resetAll(): void {
  if (window.confirm('恢复全部默认设置？当前自定义颜色、色板与单图配色都会清除。')) {
    settings.resetAll()
    toast('已恢复默认设置')
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
    <aside v-if="props.open" class="drawer" role="dialog" aria-label="设置">
      <header class="drawer-head">
        <h3>设置</h3>
        <span class="hint">自动保存在本机</span>
        <button class="btn icon" type="button" title="关闭" @click="emit('close')">✕</button>
      </header>

      <nav class="drawer-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>

      <div class="drawer-body">
        <!-- ================= 外观 ================= -->
        <section v-if="tab === 'appearance'" class="set-section">
          <div class="set-block">
            <div class="set-label">主题</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.appearance.mode === 'light' }"
                @click="settings.state.appearance.mode = 'light'"
              >
                浅色
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.mode === 'dark' }"
                @click="settings.state.appearance.mode = 'dark'"
              >
                深色
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.mode === 'system' }"
                @click="settings.state.appearance.mode = 'system'"
              >
                跟随系统
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">颜色</div>
            <div class="color-grid">
              <ColorField
                label="背景"
                :model-value="settings.state.appearance.colors.bg ?? null"
                :fallback="settings.cssColor('--bg')"
                @update:model-value="settings.state.appearance.colors.bg = $event ?? undefined"
              />
              <ColorField
                label="面板"
                :model-value="settings.state.appearance.colors.panel ?? null"
                :fallback="settings.cssColor('--panel')"
                @update:model-value="settings.state.appearance.colors.panel = $event ?? undefined"
              />
              <ColorField
                label="面板浅色"
                :model-value="settings.state.appearance.colors.panel2 ?? null"
                :fallback="settings.cssColor('--panel-2')"
                @update:model-value="settings.state.appearance.colors.panel2 = $event ?? undefined"
              />
              <ColorField
                label="文字"
                :model-value="settings.state.appearance.colors.text ?? null"
                :fallback="settings.cssColor('--text')"
                @update:model-value="settings.state.appearance.colors.text = $event ?? undefined"
              />
              <ColorField
                label="次要文字"
                :model-value="settings.state.appearance.colors.muted ?? null"
                :fallback="settings.cssColor('--muted')"
                @update:model-value="settings.state.appearance.colors.muted = $event ?? undefined"
              />
              <ColorField
                label="边框"
                :model-value="settings.state.appearance.colors.border ?? null"
                :fallback="settings.cssColor('--border')"
                @update:model-value="settings.state.appearance.colors.border = $event ?? undefined"
              />
              <ColorField
                label="强调色"
                :model-value="settings.state.appearance.colors.accent ?? null"
                :fallback="settings.cssColor('--accent')"
                @update:model-value="settings.state.appearance.colors.accent = $event ?? undefined"
              />
              <ColorField
                label="强调浅底"
                :model-value="settings.state.appearance.colors.accentSoft ?? null"
                :fallback="settings.cssColor('--accent-soft')"
                @update:model-value="settings.state.appearance.colors.accentSoft = $event ?? undefined"
              />
              <ColorField
                label="正相关"
                :model-value="settings.state.appearance.colors.good ?? null"
                :fallback="settings.cssColor('--good')"
                @update:model-value="settings.state.appearance.colors.good = $event ?? undefined"
              />
              <ColorField
                label="负相关"
                :model-value="settings.state.appearance.colors.bad ?? null"
                :fallback="settings.cssColor('--bad')"
                @update:model-value="settings.state.appearance.colors.bad = $event ?? undefined"
              />
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">
              圆角
              <span class="set-value">{{ radius }}px</span>
              <button
                v-if="settings.state.appearance.radius !== null"
                class="linkbtn"
                type="button"
                @click="settings.state.appearance.radius = null"
              >
                默认
              </button>
            </div>
            <input class="range" type="range" min="0" max="24" step="1" :value="radius" @input="onRadius" />
          </div>

          <div class="set-block">
            <div class="set-label">密度</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.appearance.density === 'compact' }"
                @click="settings.state.appearance.density = 'compact'"
              >
                紧凑
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.density === 'normal' }"
                @click="settings.state.appearance.density = 'normal'"
              >
                标准
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.density === 'comfortable' }"
                @click="settings.state.appearance.density = 'comfortable'"
              >
                宽松
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">卡片阴影</div>
            <div class="seg full">
              <button
                type="button"
                :class="{ active: settings.state.appearance.shadow === 'none' }"
                @click="settings.state.appearance.shadow = 'none'"
              >
                无
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.shadow === 'soft' }"
                @click="settings.state.appearance.shadow = 'soft'"
              >
                柔和
              </button>
              <button
                type="button"
                :class="{ active: settings.state.appearance.shadow === 'strong' }"
                @click="settings.state.appearance.shadow = 'strong'"
              >
                强
              </button>
            </div>
          </div>

          <button class="btn" type="button" @click="settings.resetAppearance()">恢复默认外观</button>
        </section>

        <!-- ================= 图表 ================= -->
        <section v-else-if="tab === 'charts'" class="set-section">
          <div class="set-block">
            <div class="set-label">分类色板</div>
            <div class="palette-list">
              <button
                v-for="p in PALETTES"
                :key="p.id"
                type="button"
                class="palette-card"
                :class="{ active: sameColors(settings.state.charts.palette, p.colors) }"
                @click="applyPreset(p.colors)"
              >
                <span class="palette-name">{{ p.name }}</span>
                <span class="palette-swatches">
                  <i v-for="c in p.colors" :key="c" :style="{ background: c }"></i>
                </span>
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">自定义色板</div>
            <div class="color-grid">
              <ColorField
                v-for="(c, i) in settings.state.charts.palette"
                :key="i"
                :label="`颜色 ${i + 1}`"
                :model-value="c"
                :fallback="c"
                :resettable="false"
                @update:model-value="settings.setPaletteColor(i, $event || c)"
              />
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">图表宽度上限</div>
            <select v-model.number="settings.state.charts.defaultWidth" class="set-select">
              <option :value="null">自适应（100%）</option>
              <option :value="600">600px</option>
              <option :value="760">760px</option>
              <option :value="900">900px</option>
              <option :value="1100">1100px</option>
            </select>
            <p class="hint">
              单图尺寸可在每张图左上角的「图表设置」里单独改（含小/中/大预设），优先级高于这里。
            </p>
          </div>

          <div class="set-block">
            <div class="set-label">热力图色阶</div>
            <div class="color-grid">
              <ColorField
                label="负 / 低端"
                :model-value="settings.state.charts.heatmap.neg"
                :fallback="settings.state.charts.heatmap.neg"
                :resettable="false"
                @update:model-value="setHeatmap('neg', $event)"
              />
              <ColorField
                label="中间"
                :model-value="settings.state.charts.heatmap.mid"
                :fallback="settings.state.charts.heatmap.mid"
                :resettable="false"
                @update:model-value="setHeatmap('mid', $event)"
              />
              <ColorField
                label="正 / 高端"
                :model-value="settings.state.charts.heatmap.pos"
                :fallback="settings.state.charts.heatmap.pos"
                :resettable="false"
                @update:model-value="setHeatmap('pos', $event)"
              />
              <ColorField
                label="类别矩阵低端"
                :model-value="settings.state.charts.heatmap.low"
                :fallback="settings.state.charts.heatmap.low"
                :resettable="false"
                @update:model-value="setHeatmap('low', $event)"
              />
              <ColorField
                label="类别矩阵高端"
                :model-value="settings.state.charts.heatmap.high"
                :fallback="settings.state.charts.heatmap.high"
                :resettable="false"
                @update:model-value="setHeatmap('high', $event)"
              />
            </div>
          </div>

          <div class="set-block">
            <label class="chk"><input v-model="settings.state.charts.grid" type="checkbox" /> 显示坐标轴网格</label>
            <label class="chk">
              <input v-model="settings.state.charts.transparent" type="checkbox" /> 图表背景透明
            </label>
            <label class="chk">
              <input v-model="settings.state.charts.showModeBar" type="checkbox" /> 显示 Plotly 自带工具栏
            </label>
            <p class="hint" style="margin-top: 6px">
              默认关闭，使用图左上角的应用工具条（导出、复制、重置缩放、尺寸与配色）。需要原生缩放/平移按钮时可以打开。
            </p>
          </div>
        </section>

        <!-- ================= 表格 ================= -->
        <section v-else-if="tab === 'table'" class="set-section">
          <div class="color-grid">
            <ColorField
              label="表头背景"
              :model-value="settings.state.table.headerBg"
              :fallback="tableHeaderFallback"
              @update:model-value="settings.state.table.headerBg = $event"
            />
            <ColorField
              label="表格边框"
              :model-value="settings.state.table.border"
              :fallback="tableBorderFallback"
              @update:model-value="settings.state.table.border = $event"
            />
          </div>

          <div class="set-block">
            <div class="set-label">字号</div>
            <select v-model.number="settings.state.table.fontSize" class="set-select">
              <option :value="null">默认（12.5px）</option>
              <option :value="11">11px</option>
              <option :value="12">12px</option>
              <option :value="13">13px</option>
              <option :value="14">14px</option>
            </select>
          </div>

          <label class="chk"><input v-model="settings.state.table.zebra" type="checkbox" /> 斑马纹（隔行浅底）</label>
        </section>

        <!-- ================= 数据 ================= -->
        <section v-else-if="tab === 'data'" class="set-section">
          <p class="hint">
            映射只改显示，统计、缓存与导出仍使用原始列名和取值。当前为全局配置；按文件配置在 Issue #3。
          </p>

          <template v-if="aliasColumns.length">
            <div class="set-block">
              <div class="set-label">列显示名</div>
              <input
                v-model="colQuery"
                class="alias-search"
                type="search"
                placeholder="搜索列名…"
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
                <p v-if="!filteredColumns.length" class="hint alias-empty">没有匹配的列</p>
              </div>
            </div>

            <div class="set-block">
              <div class="set-label">
                类别取值显示名
                <span class="hint">{{ valueAliasCount }} 条映射</span>
              </div>
              <select v-model="valueColumn" class="set-select">
                <option v-for="c in valueColumns" :key="c.name" :value="c.name">
                  {{ settings.columnLabel(c.name) }}（{{ c.uniqueCount }} 个取值）
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
                清除本列映射
              </button>
            </div>
          </template>
          <p v-else class="hint">载入 CSV 后可以编辑列名与类别取值。</p>
        </section>

        <!-- ================= 导出 ================= -->
        <section v-else-if="tab === 'export'" class="set-section">
          <div class="set-block">
            <div class="set-label">默认格式</div>
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
                SVG（矢量）
              </button>
            </div>
          </div>

          <div class="set-block">
            <div class="set-label">PNG 倍数</div>
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
            每张图左上角工具条：复制图片、下载 PNG / SVG、复制数据 TSV。SVG 不受倍数影响，始终为矢量。
          </p>
        </section>

        <!-- ================= 配置 ================= -->
        <section v-else class="set-section">
          <p class="hint">
            当前版本保存全局设置；列显示名与取值映射已加入「数据」页。界面文案与按文件配置会在后续 Issue 中完成。
          </p>
          <div class="set-actions">
            <button class="btn" type="button" @click="exportConfig">导出配置 JSON</button>
            <button class="btn" type="button" @click="fileInput?.click()">导入配置 JSON</button>
            <button class="btn" type="button" @click="resetAll">恢复全部默认</button>
          </div>
          <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport" />
          <p class="hint">配置保存在浏览器 localStorage（键 `ca-settings-v1`），换电脑可用导出/导入迁移。</p>
        </section>
      </div>
    </aside>
  </Teleport>
</template>
