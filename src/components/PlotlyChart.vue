<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, watch } from 'vue'
import type { PlotlyInstance } from '@/lib/plotly'
import { loadPlotly } from '@/lib/plotly'
import { CHART_CONFIG, applyLegendPosition } from '@/lib/chartTheme'
import type { LegendPosition } from '@/settings/defaults'
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
import { t as translate } from '@/i18n'

const props = withDefaults(
  defineProps<{
    traces: unknown[]
    layout?: Record<string, unknown>
    config?: Record<string, unknown>
    height?: number | string
    /** 稳定图表 ID，用于保存本图配色/尺寸/标题与导出文件名 */
    chartId?: string
    /** 系列配色使用的 ID；默认为 chartId（分组对比的多张小图共享一套分组颜色） */
    styleId?: string
    /** 面板给这张图算出的默认最大宽度（可被单图设置覆盖） */
    maxWidth?: number
    /** 填满父容器剩余高度（父级需是 flex 列，用于图表页一屏展示） */
    fill?: boolean
  }>(),
  { chartId: 'chart' },
)

const settings = useSettingsStore()
const plotly = shallowRef<PlotlyInstance | null>(null)
const chartLoading = ref(true)
const chartError = ref(false)
const el = ref<HTMLDivElement | null>(null)
const wrapEl = ref<HTMLDivElement | null>(null)
const styleOpen = ref(false)
const resizing = ref(false)
const preview = ref<{ width: number; height: number } | null>(null)
const dragBase = ref<{ w: number; h: number } | null>(null)

const legendOverride = computed(() => settings.chartLegend(props.chartId))
const globalLegendLabel = computed(() => {
  const labels: Record<LegendPosition, string> = {
    bottom: translate('底部'),
    top: translate('顶部'),
    right: translate('右侧'),
    hidden: translate('隐藏'),
  }
  return labels[settings.state.charts.legendPosition]
})

function onLegend(e: Event): void {
  const value = (e.target as HTMLSelectElement).value as LegendPosition | ''
  settings.setChartLegend(props.chartId, value || null)
}

const size = computed(() => settings.chartSize(props.chartId))
const titleOverride = computed(() => settings.chartTitle(props.chartId))
const hasTitleOverride = computed(() => Object.keys(titleOverride.value).length > 0)
const isPolar = computed(() =>
  props.traces.some((raw) => (raw as Record<string, unknown>).type === 'scatterpolar'),
)
const effectiveHeight = computed<number | null>(() => {
  if (size.value.height) return size.value.height
  return typeof props.height === 'number' ? props.height : null
})
const effectiveWidth = computed<number | null>(
  () => size.value.width ?? settings.state.charts.defaultWidth ?? props.maxWidth ?? null,
)

/** 无单图高度覆盖时，自动填满父容器 */
const fillHost = computed(
  () => !!props.fill && !size.value.height && !preview.value,
)

const wrapStyle = computed(() => {
  if (preview.value) {
    return {
      height: `${preview.value.height}px`,
      width: `${preview.value.width}px`,
      maxWidth: '100%',
      margin: '0 auto',
    }
  }
  const w = effectiveWidth.value
  if (fillHost.value) {
    return {
      height: 'auto',
      width: w ? `${w}px` : '100%',
      maxWidth: '100%',
      margin: w ? '0 auto' : '0',
      flex: '1 1 auto',
    }
  }
  const h = effectiveHeight.value
  return {
    height: h ? `${h}px` : props.height || '430px',
    width: w ? `${w}px` : '100%',
    maxWidth: '100%',
    margin: w ? '0 auto' : '0',
  }
})

const styledLayout = computed(() => {
  const base = { ...(props.layout || {}) }
  if (fillHost.value) {
    // 由容器高度决定；Plotly 的 autosize 会跟随容器
    delete base.height
    base.autosize = true
  } else if (effectiveHeight.value) {
    base.height = effectiveHeight.value
  }
  const t = titleOverride.value
  if (t.title) {
    base.title = { ...(base.title as Record<string, unknown> | undefined), text: t.title }
    const m = base.margin as Record<string, unknown> | undefined
    base.margin = { ...m, t: Math.max(34, Number(m?.t) || 0) }
  }
  if (t.xTitle) {
    const x = base.xaxis as Record<string, unknown> | undefined
    base.xaxis = {
      ...x,
      title: { ...(x?.title as Record<string, unknown> | undefined), text: t.xTitle },
    }
  }
  if (t.yTitle) {
    const y = base.yaxis as Record<string, unknown> | undefined
    base.yaxis = {
      ...y,
      title: { ...(y?.title as Record<string, unknown> | undefined), text: t.yTitle },
    }
  }
  if (legendOverride.value) {
    applyLegendPosition(base, legendOverride.value)
  }
  return base
})

function onTitle(key: 'title' | 'xTitle' | 'yTitle', e: Event): void {
  settings.setChartTitle(props.chartId, {
    [key]: (e.target as HTMLInputElement).value,
  })
}

/**
 * 拖动时不做真实重绘：把图表按原尺寸渲染后整体 CSS 缩放，
 * 松手才执行一次 Plotly 重绘，避免每帧 resize 造成的卡顿。
 */
const hostStyle = computed(() => {
  if (!resizing.value || !preview.value || !dragBase.value) return {}
  const sx = preview.value.width / dragBase.value.w
  const sy = preview.value.height / dragBase.value.h
  return {
    position: 'absolute' as const,
    top: '0',
    left: '0',
    width: `${dragBase.value.w}px`,
    height: `${dragBase.value.h}px`,
    transform: `scale(${sx}, ${sy})`,
    transformOrigin: 'top left',
  }
})

function onSize(key: 'width' | 'height', e: Event): void {
  const raw = (e.target as HTMLInputElement).value.trim()
  const n = Number(raw)
  settings.setChartSize(props.chartId, {
    [key]: raw === '' || !Number.isFinite(n) ? null : n,
  })
}

function applySize(width: number | null, height: number | null): void {
  settings.setChartSize(props.chartId, { width, height })
}

function clearSize(): void {
  settings.clearChartSize(props.chartId)
}

/* ---------------- 拖拽调整尺寸 ---------------- */

const clampW = (v: number, max: number): number => Math.min(Math.max(v, 280), max)
const clampH = (v: number): number => Math.min(Math.max(v, 200), 1200)

let dragStart: { x: number; y: number; w: number; h: number; maxW: number } | null = null
let moved = false

function onResizeStart(e: PointerEvent): void {
  if (e.button !== 0 || !el.value || !wrapEl.value) return
  e.preventDefault()
  e.stopPropagation()
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  } catch {
    /* 忽略 */
  }
  const rect = el.value.getBoundingClientRect()
  const parentW = wrapEl.value.parentElement?.clientWidth ?? rect.width
  dragStart = {
    x: e.clientX,
    y: e.clientY,
    w: rect.width,
    h: rect.height,
    maxW: Math.min(1600, Math.max(280, parentW)),
  }
  preview.value = { width: Math.round(rect.width), height: Math.round(rect.height) }
  dragBase.value = { w: rect.width, h: rect.height }
  resizing.value = true
  moved = false
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'nwse-resize'
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
}

function onResizeMove(e: PointerEvent): void {
  if (!dragStart) return
  const w = clampW(dragStart.w + (e.clientX - dragStart.x), dragStart.maxW)
  const h = clampH(dragStart.h + (e.clientY - dragStart.y))
  if (Math.abs(w - preview.value!.width) > 0 || Math.abs(h - preview.value!.height) > 0) {
    moved = true
  }
  preview.value = { width: Math.round(w), height: Math.round(h) }
}

function onResizeEnd(): void {
  window.removeEventListener('pointermove', onResizeMove)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  if (moved && preview.value) {
    settings.setChartSize(props.chartId, { ...preview.value })
  }
  preview.value = null
  resizing.value = false
  dragStart = null
  dragBase.value = null
  moved = false
  // 等下一帧布局恢复后再真实重绘一次
  requestAnimationFrame(() => {
    void draw()
  })
}

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

const overrides = computed(() => settings.chartSeries(props.styleId || props.chartId))
const colorChartId = computed(() => props.styleId || props.chartId)
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
      label: key === '__default__' ? translate('数据系列') : key,
      color: normalizeHex(overrides.value[key] || traceColor(t) || settings.paletteColor(i)),
    })
  })
  return [...seen.values()]
})

const hasOverrides = computed(() => Object.keys(overrides.value).length > 0)
const hasWebgl = computed(() =>
  props.traces.some((raw) => (raw as Record<string, unknown>).type === 'scattergl'),
)

const hasZoomableAxes = computed(() =>
  props.traces.some((raw) => {
    const type = (raw as Record<string, unknown>).type
    return type !== 'scatterpolar' && type !== 'pie'
  }),
)

async function resetZoom(): Promise<void> {
  if (!el.value || !plotly.value) return
  try {
    await plotly.value.relayout(el.value, {
      'xaxis.autorange': true,
      'yaxis.autorange': true,
    })
    toast(translate('已重置缩放'))
  } catch {
    toast(translate('重置失败'))
  }
}

function isDisplayed(element: HTMLElement | null): element is HTMLElement {
  return (
    !!element &&
    element.isConnected &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  )
}

let needsDraw = false

async function draw(): Promise<void> {
  if (!el.value) return
  // 隐藏的页签 / 被折叠的图表不能被 Plotly.resize 处理
  if (!isDisplayed(el.value)) {
    needsDraw = true
    return
  }
  if (!plotly.value) {
    needsDraw = true
    return
  }
  const config = {
    ...CHART_CONFIG,
    ...(props.config || {}),
    displayModeBar: settings.state.charts.showModeBar ? 'hover' : false,
  } as Parameters<PlotlyInstance['react']>[3]
  try {
    const data = styledTraces.value as Parameters<PlotlyInstance['react']>[1]
    const layout = styledLayout.value as Parameters<PlotlyInstance['react']>[2]
    await plotly.value.react(el.value, data, layout, config)
    needsDraw = false
  } catch (err) {
    console.error('Plotly 渲染失败', err)
  }
}

onMounted(async () => {
  try {
    plotly.value = await loadPlotly()
    chartLoading.value = false
    await draw()
  } catch (err) {
    console.error(err)
    chartError.value = true
    chartLoading.value = false
  }
})
onActivated(() => {
  requestAnimationFrame(() => {
    void draw()
  })
})
onDeactivated(() => {
  styleOpen.value = false
})

function onEscKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && styleOpen.value) styleOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onEscKey))

let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !el.value) return
  resizeObserver = new ResizeObserver(() => {
    if (resizeRaf || resizing.value) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      if (!isDisplayed(el.value)) {
        needsDraw = true
        return
      }
      if (needsDraw) {
        void draw()
        return
      }
      if (!plotly.value) return
      try {
        // Plotly 4 的 resize 可能返回 Promise，需显式捕获
        const result = plotly.value.Plots.resize(el.value) as unknown
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          ;(result as Promise<unknown>).catch(() => {})
        }
      } catch {
        /* 忽略隐藏 / 未初始化的情况 */
      }
    })
  })
  resizeObserver.observe(el.value)
})
watch(styledTraces, draw, { flush: 'post' })
watch(
  () => settings.state.charts.showModeBar,
  () => {
    void draw()
  },
  { flush: 'post' },
)
watch(
  styledLayout,
  () => {
    void draw()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('keydown', onEscKey)
  if (resizing.value) {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  if (el.value && plotly.value) {
    try {
      plotly.value.purge(el.value)
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
      toast(translate('图片已复制到剪贴板'))
    } else {
      downloadDataUrl(url, `${safeFilename(props.chartId)}.png`)
      toast(translate('当前环境不支持复制图片，已改为下载'))
    }
  } catch {
    toast(translate('复制图片失败，请改用下载'))
  }
}

async function download(format: 'png' | 'svg'): Promise<void> {
  if (!el.value) return
  let fmt = format
  if (fmt === 'svg' && hasWebgl.value) {
    fmt = 'png'
    toast(translate('WebGL 散点图不支持 SVG，已改为 PNG'))
  }
  try {
    const url = await chartImage(el.value, fmt, settings.state.exportSettings.scale)
    downloadDataUrl(url, `${safeFilename(props.chartId)}.${fmt}`)
    toast(translate('已下载 {format}', { format: fmt.toUpperCase() }))
  } catch {
    toast(translate('导出失败，请重试'))
  }
}

async function copyData(): Promise<void> {
  const tsv = tracesToTsv(props.traces, props.layout)
  if (!tsv) {
    toast(translate('该图暂不支持复制数据'))
    return
  }
  const ok = await copyText(tsv)
  toast(ok ? translate('数据已复制（TSV，可直接粘进表格）') : translate('复制失败，请重试'))
}

function onSeriesColor(key: string, e: Event): void {
  settings.setSeriesColor(colorChartId.value, key, (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div
    ref="wrapEl"
    class="chart-wrap"
    :class="{ resizing, fill: fillHost }"
    :style="wrapStyle"
    :data-chart-id="chartId"
  >
    <div ref="el" class="chart-host" data-plotly-host :style="hostStyle"></div>

    <div v-if="chartLoading" class="chart-loading">{{ $t('正在加载图表库…') }}</div>
    <div v-else-if="chartError" class="chart-loading error">{{ $t('图表库加载失败') }}</div>

    <div v-if="!chartLoading && !chartError" class="chart-tools" @mousedown.stop @click.stop>
      <button class="chart-tool" type="button" :title="$t('复制图片')" @click="copyImage">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="5.2" y="5.2" width="8" height="8" rx="1.5" />
          <path d="M11 5V3.6A1.6 1.6 0 0 0 9.4 2h-5A1.6 1.6 0 0 0 2.8 3.6v5A1.6 1.6 0 0 0 4.4 10H5" />
        </svg>
      </button>
      <button class="chart-tool" type="button" :title="$t('下载 PNG')" @click="download('png')">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2.5v7" />
          <path d="m5 6.5 3 3 3-3" />
          <path d="M3.5 12.5v1h9v-1" />
        </svg>
      </button>
      <button class="chart-tool text" type="button" :title="$t('下载 SVG（矢量）')" @click="download('svg')">
        SVG
      </button>
      <button class="chart-tool text" type="button" :title="$t('复制数据（TSV）')" @click="copyData">
        TSV
      </button>
      <button
        v-if="hasZoomableAxes"
        class="chart-tool"
        type="button"
        :title="$t('重置缩放 / 平移')"
        @click="resetZoom"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.4 8a4.6 4.6 0 1 0 1.4-3.3" />
          <path d="M3 2.6v3h3" />
        </svg>
      </button>
      <button
        class="chart-tool"
        type="button"
        :title="$t('图表设置（尺寸 / 配色）')"
        :class="{ active: styleOpen }"
        @click="styleOpen = !styleOpen"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M3 4h10M3 8h10M3 12h10" />
          <circle cx="6" cy="4" r="1.6" fill="var(--panel)" />
          <circle cx="10.5" cy="8" r="1.6" fill="var(--panel)" />
          <circle cx="5" cy="12" r="1.6" fill="var(--panel)" />
        </svg>
      </button>
    </div>

    <template v-if="styleOpen">
      <div class="chart-style-veil" @click="styleOpen = false"></div>
      <div class="chart-style" @click.stop>
        <div class="cs-head">
          <b>{{ $t('图表设置') }}</b>
          <span class="hint">{{ $t('只影响这张图') }}</span>
          <button class="linkbtn" type="button" @click="styleOpen = false">{{ $t('关闭') }}</button>
        </div>
        <div class="cs-body">
          <div class="cs-sub">{{ $t('尺寸（px）') }}</div>
          <div class="cs-size-row">
            <label>
              {{ $t('宽') }}
              <input
                type="number"
                min="280"
                max="1600"
                step="20"
                :value="size.width ?? ''"
                :placeholder="$t('自适应')"
                @change="onSize('width', $event)"
              />
            </label>
            <label>
              {{ $t('高') }}
              <input
                type="number"
                min="200"
                max="1200"
                step="20"
                :value="size.height ?? ''"
                :placeholder="$t('默认')"
                @change="onSize('height', $event)"
              />
            </label>
          </div>
          <div class="cs-presets">
            <button class="linkbtn" type="button" @click="applySize(480, 320)">{{ $t('小 480×320') }}</button>
            <button class="linkbtn" type="button" @click="applySize(720, 440)">{{ $t('中 720×440') }}</button>
            <button class="linkbtn" type="button" @click="applySize(960, 600)">{{ $t('大 960×600') }}</button>
            <button class="linkbtn" type="button" @click="clearSize">{{ $t('自动') }}</button>
          </div>
          <p class="hint" style="margin: 2px 0 4px">
            {{ $t('也可以直接拖动图表右下角的手柄实时缩放；双击手柄恢复自动尺寸。') }}
          </p>

          <div class="cs-sub">{{ $t('标题') }}</div>
          <div class="cs-title-row">
            <input
              :value="titleOverride.title ?? ''"
              :placeholder="$t('图表标题（可选）')"
              maxlength="120"
              @change="onTitle('title', $event)"
            />
            <input
              v-if="!isPolar"
              :value="titleOverride.xTitle ?? ''"
              :placeholder="$t('X 轴标题')"
              maxlength="120"
              @change="onTitle('xTitle', $event)"
            />
            <input
              v-if="!isPolar"
              :value="titleOverride.yTitle ?? ''"
              :placeholder="$t('Y 轴标题')"
              maxlength="120"
              @change="onTitle('yTitle', $event)"
            />
          </div>
          <button
            v-if="hasTitleOverride"
            class="linkbtn"
            type="button"
            style="align-self: flex-start"
            @click="settings.clearChartTitle(chartId)"
          >
            {{ $t('恢复默认标题') }}
          </button>

          <div class="cs-sub">{{ $t('图例') }}</div>
          <select class="cs-select" :value="legendOverride ?? ''" @change="onLegend">
            <option value="">
              {{ $t('跟随全局（{pos}）', { pos: globalLegendLabel }) }}
            </option>
            <option value="bottom">{{ $t('底部') }}</option>
            <option value="top">{{ $t('顶部') }}</option>
            <option value="right">{{ $t('右侧') }}</option>
            <option value="hidden">{{ $t('隐藏') }}</option>
          </select>

          <template v-if="seriesList.length">
            <div class="cs-sub">{{ $t('配色') }}</div>
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
                @click="settings.setSeriesColor(colorChartId, s.key, '')"
              >
                {{ $t('重置') }}
              </button>
            </div>
          </template>
          <p v-else class="hint">{{ $t('该图没有可单独着色的序列；热力图色阶与全局色板在「设置 → 图表」里调整。') }}</p>
        </div>
        <div v-if="seriesList.length" class="cs-foot">
          <button
            class="btn ghost"
            type="button"
            :disabled="!hasOverrides"
            @click="settings.clearChartSeries(colorChartId)"
          >
            {{ $t('恢复全局配色') }}
          </button>
        </div>
      </div>
    </template>

    <div
      class="chart-resize"
      :title="$t('拖动调整大小，双击恢复自动尺寸')"
      @pointerdown="onResizeStart"
      @dblclick.stop="clearSize()"
    ></div>
    <div v-if="resizing && preview" class="chart-size-badge">
      {{ preview.width }} × {{ preview.height }}
    </div>
  </div>
</template>
