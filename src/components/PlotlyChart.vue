<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import Plotly from 'plotly.js-dist-min'
import { CHART_CONFIG } from '@/lib/chartTheme'
import { withAlpha } from '@/lib/color'
import {
  chartImage,
  copyImageUrl,
  copyText,
  downloadDataUrl,
  safeFilename,
  tracesToTsv,
} from '@/lib/exportChart'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    traces: unknown[]
    layout?: Record<string, unknown>
    config?: Record<string, unknown>
    height?: number | string
    /** 稳定的图表 ID，用于保存本图配色与导出文件名 */
    chartId?: string
  }>(),
  { chartId: 'chart' },
)

const settings = useSettingsStore()
const el = ref<HTMLDivElement | null>(null)
const styleOpen = ref(false)

const wrapStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height || '430px',
}))

function seriesKeyOf(t: Record<string, unknown>): string {
  const name = t.name
  return typeof name === 'string' && name.trim() ? name : '__default__'
}

function traceColor(t: Record<string, unknown>): string | null {
  const marker = t.marker as { color?: unknown } | undefined
  if (marker && typeof marker.color === 'string') return marker.color
  const line = t.line as { color?: unknown } | undefined
  if (line && typeof line.color === 'string') return line.color
  return null
}

function normalizeHex(c: string | null): string {
  if (!c) return '#4c6ef5'
  if (/^#[0-9a-f]{6}$/i.test(c)) return c
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return '#' + c.slice(1).split('').map((x) => x + x).join('')
  }
  return '#4c6ef5'
}

function applyOverrides(
  traces: unknown[],
  overrides: Record<string, string>,
): unknown[] {
  if (!Object.keys(overrides).length) return traces
  return traces.map((raw) => {
    const t = raw as Record<string, unknown>
    const key = seriesKeyOf(t)
    const color = overrides[key] || overrides[key.replace(/ KDE$/, '')]
    if (!color) return raw
    const markerRaw = t.marker as Record<string, unknown> | undefined
    // 每个点单独着色（例如热力条形图）时不覆盖
    if (markerRaw && Array.isArray(markerRaw.color)) return raw
    const clone: Record<string, unknown> = { ...t }
    if (markerRaw && typeof markerRaw === 'object') {
      clone.marker = { ...markerRaw, color }
    }
    if (t.line && typeof t.line === 'object') {
      clone.line = { ...(t.line as Record<string, unknown>), color }
    }
    if (t.type === 'box' || t.fill === 'toself') {
      clone.fillcolor = withAlpha(color, 0.15)
    }
    return clone
  })
}

const overrides = computed(() => settings.chartSeries(props.chartId))
const styledTraces = computed(() => applyOverrides(props.traces, overrides.value))

const seriesList = computed(() => {
  // 热力图 / SPLOM 没有“系列”概念（颜色是色阶或每点颜色）
  if (
    props.traces.some((raw) => {
      const type = (raw as Record<string, unknown>).type
      return type === 'heatmap' || type === 'splom'
    })
  ) {
    return []
  }
  const seen = new Map<string, { key: string; label: string; color: string }>()
  props.traces.forEach((raw, i) => {
    const t = raw as Record<string, unknown>
    if (t.showlegend === false) return
    if (t.type === 'heatmap' || t.type === 'splom') return
    const marker = t.marker as { color?: unknown } | undefined
    if (marker && Array.isArray(marker.color)) return
    const key = seriesKeyOf(t)
    if (seen.has(key)) return
    seen.set(key, {
      key,
      label: key === '__default__' ? '数据系列' : key,
      color: normalizeHex(overrides.value[key] || traceColor(t) || settings.paletteColor(i)),
    })
  })
  return [...seen.values()]
})

const hasOverrides = computed(() => Object.keys(overrides.value).length > 0)
const hasWebgl = computed(() =>
  props.traces.some((raw) => (raw as Record<string, unknown>).type === 'scattergl'),
)

async function draw(): Promise<void> {
  if (!el.value) return
  const config = { ...CHART_CONFIG, ...(props.config || {}) }
  try {
    await Plotly.react(el.value, styledTraces.value, props.layout || {}, config)
  } catch (err) {
    console.error('Plotly 渲染失败', err)
  }
}

onMounted(draw)
onActivated(() => {
  void draw()
})
onDeactivated(() => {
  styleOpen.value = false
})

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !el.value) return
  resizeObserver = new ResizeObserver(() => {
    if (!el.value) return
    try {
      Plotly.Plots.resize(el.value)
    } catch {
      /* 忽略 */
    }
  })
  resizeObserver.observe(el.value)
})
watch(styledTraces, draw, { flush: 'post' })
watch(
  () => props.layout,
  () => {
    void draw()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (el.value) {
    try {
      Plotly.purge(el.value)
    } catch {
      /* 忽略 */
    }
  }
})

/* ---------------- 工具条动作 ---------------- */

async function copyImage(): Promise<void> {
  if (!el.value) return
  try {
    const url = await chartImage(el.value, 'png', settings.state.exportSettings.scale)
    if (await copyImageUrl(url)) {
      toast('图片已复制到剪贴板')
    } else {
      downloadDataUrl(url, `${safeFilename(props.chartId)}.png`)
      toast('当前环境不支持复制图片，已改为下载')
    }
  } catch {
    toast('复制图片失败，请改用下载')
  }
}

async function download(format: 'png' | 'svg'): Promise<void> {
  if (!el.value) return
  let fmt = format
  if (fmt === 'svg' && hasWebgl.value) {
    fmt = 'png'
    toast('WebGL 散点图不支持 SVG，已改为 PNG')
  }
  try {
    const url = await chartImage(el.value, fmt, settings.state.exportSettings.scale)
    downloadDataUrl(url, `${safeFilename(props.chartId)}.${fmt}`)
    toast(`已下载 ${fmt.toUpperCase()}`)
  } catch {
    toast('导出失败，请重试')
  }
}

async function copyData(): Promise<void> {
  const tsv = tracesToTsv(props.traces, props.layout)
  if (!tsv) {
    toast('该图暂不支持复制数据')
    return
  }
  const ok = await copyText(tsv)
  toast(ok ? '数据已复制（TSV，可直接粘进表格）' : '复制失败，请重试')
}

function onSeriesColor(key: string, e: Event): void {
  settings.setSeriesColor(props.chartId, key, (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="chart-wrap" :style="wrapStyle">
    <div ref="el" class="chart-host" data-plotly-host></div>

    <div class="chart-tools" @mousedown.stop @click.stop>
      <button class="chart-tool" type="button" title="复制图片" @click="copyImage">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="5.2" y="5.2" width="8" height="8" rx="1.5" />
          <path d="M11 5V3.6A1.6 1.6 0 0 0 9.4 2h-5A1.6 1.6 0 0 0 2.8 3.6v5A1.6 1.6 0 0 0 4.4 10H5" />
        </svg>
      </button>
      <button class="chart-tool" type="button" title="下载 PNG" @click="download('png')">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2.5v7" />
          <path d="m5 6.5 3 3 3-3" />
          <path d="M3.5 12.5v1h9v-1" />
        </svg>
      </button>
      <button class="chart-tool text" type="button" title="下载 SVG（矢量）" @click="download('svg')">
        SVG
      </button>
      <button class="chart-tool text" type="button" title="复制数据（TSV）" @click="copyData">
        TSV
      </button>
      <button
        v-if="seriesList.length"
        class="chart-tool"
        type="button"
        title="本图配色"
        :class="{ active: styleOpen }"
        @click="styleOpen = !styleOpen"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2">
          <circle cx="8" cy="8" r="5.6" />
          <circle cx="6" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="6" cy="10" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>

    <template v-if="styleOpen">
      <div class="chart-style-veil" @click="styleOpen = false"></div>
      <div class="chart-style" @click.stop>
        <div class="cs-head">
          <b>本图配色</b>
          <span class="hint">只影响这张图</span>
          <button class="linkbtn" type="button" @click="styleOpen = false">关闭</button>
        </div>
        <div class="cs-body">
          <div v-for="s in seriesList" :key="s.key" class="cs-row">
            <span class="cs-name" :title="s.label">{{ s.label }}</span>
            <input
              class="cs-color"
              type="color"
              :value="s.color"
              @input="onSeriesColor(s.key, $event)"
            />
            <button
              class="linkbtn"
              type="button"
              :disabled="!overrides[s.key]"
              @click="settings.setSeriesColor(chartId, s.key, '')"
            >
              重置
            </button>
          </div>
        </div>
        <div class="cs-foot">
          <button
            class="btn ghost"
            type="button"
            :disabled="!hasOverrides"
            @click="settings.clearChartSeries(chartId)"
          >
            恢复全局色板
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
