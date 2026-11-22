import { ref } from 'vue'
import type { Column } from '@/types'

/** 主题切换时 +1，用于让依赖 CSS 变量的布局 computed 重新计算 */
export const chartThemeTick = ref(0)
export function notifyThemeChange(): void {
  chartThemeTick.value++
}

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

  const text = cssv('--text')
  const grid = cssv('--border')
  const muted = cssv('--muted')
  const lay: AnyRec = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: "'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif", size: 12, color: text },
    colorway: [
      '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494',
      '#b3b3b3', '#80b1d3', '#fb8072', '#bebada', '#ffffb3', '#1b9e77', '#d95f02',
    ],
    margin: { l: 64, r: 24, t: 46, b: 56 },
    hoverlabel: { bgcolor: cssv('--panel'), bordercolor: grid, font: { color: text, size: 12 } },
    legend: { orientation: 'h', y: -0.2, x: 0, font: { size: 11, color: muted } },
    xaxis: {
      gridcolor: grid,
      zerolinecolor: grid,
      linecolor: grid,
      tickfont: { size: 11, color: muted },
      title: { font: { size: 12, color: text } },
    },
    yaxis: {
      gridcolor: grid,
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
  if (extra.margin) {
    lay.margin = merge(lay.margin, extra.margin)
    delete extra.margin
  }
  return Object.assign(lay, extra)
}

/** 日期列转 Date 数组，供 Plotly 时间轴使用 */
export const axisValues = (c: Column): (number | Date | null)[] =>
  c.type === 'date' && c.num
    ? c.num.map((v) => (v === null ? null : new Date(v)))
    : c.num || []
