<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import { useThemeStore } from '@/stores/theme'
import DropZone from '@/components/DropZone.vue'
import AppBar from '@/components/AppBar.vue'
import Toast from '@/components/Toast.vue'
import OverviewPanel from '@/panels/OverviewPanel.vue'
import MatrixPanel from '@/panels/MatrixPanel.vue'
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
const theme = useThemeStore()

const active = ref(readHash())
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
})

const current = computed(() => TABS.find((t) => t.key === active.value) ?? TABS[0])

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
  <DropZone v-if="!ds.hasData" :drag="dragging" @pick="pick" @sample="ds.loadSample()" />

  <template v-else>
    <AppBar
      :tabs="TABS"
      :active="active"
      :file-name="ds.fileName"
      :chip-title="ds.chipTitle"
      @select="active = $event"
      @change="pick"
      @theme="theme.toggle()"
    />
    <main class="wrap">
      <div v-if="ds.error" class="banner warn">⚠️ {{ ds.error }}</div>
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
    正在读取…
  </div>

  <div class="dragveil" :class="{ on: dragging }">
    <div class="vbox">松开即可载入新的 CSV</div>
  </div>

  <Toast />
</template>
