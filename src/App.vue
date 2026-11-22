<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import DropZone from '@/components/DropZone.vue'
import AppBar from '@/components/AppBar.vue'
import SettingsDrawer from '@/components/SettingsDrawer.vue'
import PresetDialog from '@/components/PresetDialog.vue'
import FilterDialog from '@/components/FilterDialog.vue'
import { toast } from '@/composables/useToast'
import { t } from '@/i18n'
import { copyText } from '@/lib/exportChart'
import { decodeShare, shareUrl } from '@/lib/share'
import { useViewStore } from '@/stores/view'
import type { FilterRule } from '@/types'
import Toast from '@/components/Toast.vue'
import OverviewPanel from '@/panels/OverviewPanel.vue'
import MatrixPanel from '@/panels/MatrixPanel.vue'
import PartialPanel from '@/panels/PartialPanel.vue'
import TargetPanel from '@/panels/TargetPanel.vue'
import ScatterPanel from '@/panels/ScatterPanel.vue'
import GroupPanel from '@/panels/GroupPanel.vue'
import PairsPanel from '@/panels/PairsPanel.vue'
import DistributionPanel from '@/panels/DistributionPanel.vue'
import CategoryPanel from '@/panels/CategoryPanel.vue'
import RadarPanel from '@/panels/RadarPanel.vue'
import InsightPanel from '@/panels/InsightPanel.vue'
import DataPanel from '@/panels/DataPanel.vue'

const TABS = [
  { key: 'overview', label: '关联总览', component: OverviewPanel },
  { key: 'matrix', label: '相关矩阵', component: MatrixPanel },
  { key: 'partial', label: '偏相关 / VIF', component: PartialPanel },
  { key: 'target', label: '目标关联', component: TargetPanel },
  { key: 'scatter', label: '散点拟合', component: ScatterPanel },
  { key: 'group', label: '分组对比', component: GroupPanel },
  { key: 'pairs', label: '成对关系', component: PairsPanel },
  { key: 'distribution', label: '分布分析', component: DistributionPanel },
  { key: 'category', label: '类别计数', component: CategoryPanel },
  { key: 'radar', label: '雷达画像', component: RadarPanel },
  { key: 'insight', label: '分析结论', component: InsightPanel },
  { key: 'data', label: '数据预览', component: DataPanel },
]

const ds = useDatasetStore()
const view = useViewStore()
const settingsOpen = ref(false)
const presetOpen = ref(false)
const filterOpen = ref(false)

let pendingShare = decodeShare(new URLSearchParams(location.search).get('view'))

const active = ref(readHash())
const mainEl = ref<HTMLElement | null>(null)
function readHash(): string {
  const h = location.hash.replace(/^#\/?/, '')
  return TABS.some((t) => t.key === h) ? h : 'overview'
}
watch(active, (v) => {
  try {
    history.replaceState(null, '', `#${v}`)
  } catch {
    /* file:// 下可能受限 */
  }
  mainEl.value?.scrollTo({ top: 0 })
})

const current = computed(() => TABS.find((t) => t.key === active.value) ?? TABS[0])

// 分享链接：载入 CSV 后应用其中的页签与视图选择
watch(
  () => ds.datasetId,
  async (id) => {
    if (!id || !pendingShare) return
    const shared = pendingShare
    pendingShare = null
    await nextTick()
    const data = ds.dataset
    if (!data) return
    if (shared.tab && TABS.some((t) => t.key === shared.tab)) active.value = shared.tab
    view.apply(shared.view, data)
    if (shared.filter?.length) ds.applyFilters(shared.filter)
    toast(t('已应用分享的视图'))
  },
)

async function shareView(): Promise<void> {
  try {
    const url = shareUrl(location.href, active.value, view.snapshot(), ds.filterRules)
    const ok = await copyText(url)
    toast(
      ok
        ? t('视图链接已复制；打开后载入同一份 CSV 即可复现')
        : t('复制失败，请重试'),
      4000,
    )
  } catch {
    toast(t('复制失败，请重试'))
  }
}

function applyFilter(rules: FilterRule[]): void {
  const matched = ds.applyFilters(rules)
  filterOpen.value = false
  toast(t('已筛选 {n} / {total} 行', { n: matched, total: ds.sourceN }))
}

function clearFilter(): void {
  ds.clearFilters()
  filterOpen.value = false
  toast(t('已清除筛选'))
}

function settingsAction(kind: 'filter' | 'presets' | 'share' | 'change'): void {
  settingsOpen.value = false
  if (kind === 'filter') filterOpen.value = true
  else if (kind === 'presets') presetOpen.value = true
  else if (kind === 'share') void shareView()
  else pick()
}

const fileInput = ref<HTMLInputElement | null>(null)
function pick(): void {
  fileInput.value?.click()
}
async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) await ds.loadFile(f)
  input.value = ''
}

const dragging = ref(false)
let depth = 0

function hasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')
}
function onDragEnter(e: DragEvent): void {
  if (!hasFiles(e)) return
  e.preventDefault()
  depth++
  dragging.value = true
}
function onDragOver(e: DragEvent): void {
  if (hasFiles(e)) e.preventDefault()
}
function onDragLeave(e: DragEvent): void {
  if (!hasFiles(e)) return
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}
async function onDrop(e: DragEvent): Promise<void> {
  e.preventDefault()
  depth = 0
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) await ds.loadFile(f)
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  window.addEventListener('hashchange', () => {
    const h = readHash()
    if (h !== active.value) active.value = h
  })
})
onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <DropZone v-if="!ds.hasData" :drag="dragging" @pick="pick" />

  <template v-else>
    <AppBar
      :tabs="TABS"
      :active="active"
      :file-name="ds.fileName"
      :chip-title="ds.chipTitle"
      @select="active = $event"
      @settings="settingsOpen = true"
    />
    <main ref="mainEl" class="wrap">
      <div v-if="ds.error" class="banner warn">⚠️ {{ ds.error }}</div>
      <div v-if="ds.filterActive" class="banner filter-banner">
        <span>
          🔎 {{ $t('已筛选 {n} / {total} 行，分析仅基于筛选后的数据', { n: ds.n, total: ds.sourceN }) }}
        </span>
        <button class="linkbtn" type="button" @click="filterOpen = true">{{ $t('修改') }}</button>
        <button class="linkbtn" type="button" @click="clearFilter">{{ $t('清除') }}</button>
      </div>
      <!-- KeepAlive 用 key 做缓存索引；key 必须按「数据集 + 页签」唯一，
           否则不同页签会复用同一个组件实例 -->
      <KeepAlive :max="12">
        <component :is="current.component" :key="`${ds.datasetId}:${active}`" />
      </KeepAlive>
    </main>
  </template>

  <input
    ref="fileInput"
    type="file"
    accept=".csv,.tsv,.txt"
    hidden
    @change="onFileChange"
  />

  <div v-if="ds.loading" class="banner" style="position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 120">
    {{ $t('正在读取…') }}
  </div>

  <div class="dragveil" :class="{ on: dragging }">
    <div class="vbox">{{ $t('松开即可载入新的 CSV') }}</div>
  </div>

  <Toast />
  <SettingsDrawer
    :open="settingsOpen"
    :filter-active="ds.filterActive"
    :filtered-rows="ds.n"
    :total-rows="ds.sourceN"
    @close="settingsOpen = false"
    @filter="settingsAction('filter')"
    @presets="settingsAction('presets')"
    @share="settingsAction('share')"
    @change="settingsAction('change')"
  />
  <PresetDialog :open="presetOpen" @close="presetOpen = false" />
  <FilterDialog
    :open="filterOpen"
    :columns="ds.sourceColumns"
    :total="ds.sourceN"
    :rules="ds.filterRules"
    @close="filterOpen = false"
    @apply="applyFilter"
    @clear="clearFilter"
  />
</template>
