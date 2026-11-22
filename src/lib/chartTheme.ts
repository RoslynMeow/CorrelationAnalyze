import { chartThemeTick } from './themeBus'
import { useSettingsStore } from '@/stores/settings'
import type { Column } from '@/types'

export function cssv(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const CHART_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
  toImageButtonOptions: { format: 'png', filename: 'association-chart', scale: 2 },
}

type AnyRec = Record<string, unknown>

/** 统一图表布局：跟随主题、色板、坐标轴网格与图例位置 */
export function baseLayout(extra: AnyRec = {}): AnyRec {
  // 订阅主题变化
  void chartThemeTick.value

  const settings = useSettingsStore()
  const text = cssv('--text')
  const grid = cssv('--border')
  const muted = cssv('--muted')
  const transparent = settings.state.charts.transparent
  const showGrid = settings.state.charts.grid
  const legendPos = settings.state.charts.legendPosition
  const bg = transparent ? 'rgba(0,0,0,0)' : cssv('--panel')

  const legendLayout: AnyRec =
    legendPos === 'top'
      ? { orientation: 'h', x: 0, y: 1.02, xanchor: 'left', yanchor: 'bottom' }
      : legendPos === 'right'
        ? { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top' }
        : legendPos === 'hidden'
          ? {}
          : { orientation: 'h', x: 0, y: -0.14, xanchor: 'left', yanchor: 'top' }

  const lay: AnyRec = {
    paper_bgcolor: bg,
    plot_bgcolor: bg,
    font: { family: "'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif", size: 12, color: text },
    colorway: [...settings.palette],
    margin: { l: 64, r: 24, t: 46, b: 56 },
    hoverlabel: { bgcolor: cssv('--panel'), bordercolor: grid, font: { color: text, size: 12 } },
    legend: { ...legendLayout, font: { size: 11, color: muted } },
    xaxis: {
      gridcolor: grid,
      showgrid: showGrid,
      zerolinecolor: grid,
      linecolor: grid,
      tickfont: { size: 11, color: muted },
      title: { font: { size: 12, color: text } },
    },
    yaxis: {
      gridcolor: grid,
      showgrid: showGrid,
      zerolinecolor: grid,
      linecolor: grid,
      tickfont: { size: 11, color: muted },
      title: { font: { size: 12, color: text } },
    },
  }

  const merge = (base: unknown, add: unknown): AnyRec => ({
    ...(base as AnyRec),
    ...(add as AnyRec),
  })
  if (extra.xaxis) {
    lay.xaxis = merge(lay.xaxis, extra.xaxis)
    delete extra.xaxis
  }
  if (extra.yaxis) {
    lay.yaxis = merge(lay.yaxis, extra.yaxis)
    delete extra.yaxis
  }
  if (extra.legend) {
    lay.legend = merge(lay.legend, extra.legend)
    delete extra.legend
  }
  if (extra.margin) {
    lay.margin = merge(lay.margin, extra.margin)
    delete extra.margin
  }

  Object.assign(lay, extra)

  if (legendPos === 'hidden') {
    lay.showlegend = false
  } else if (lay.showlegend !== false) {
    const m = { ...(lay.margin as AnyRec) }
    const num = (v: unknown, fallback: number): number =>
      Number.isFinite(Number(v)) ? Number(v) : fallback
    if (legendPos === 'bottom') {
      m.b = Math.max(num(m.b, 56), 96)
    } else if (legendPos === 'top') {
      m.t = Math.max(num(m.t, 46), lay.title ? 96 : 72)
    } else {
      m.r = Math.max(num(m.r, 24), 150)
    }
    lay.margin = m
  }

  return lay
}

/** 日期列转 Date 数组，供 Plotly 时间轴使用 */
export const axisValues = (c: Column): (number | Date | null)[] =>
  c.type === 'date' && c.num
    ? c.num.map((v) => (v === null ? null : new Date(v)))
    : c.num || []
