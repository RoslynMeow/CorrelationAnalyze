type PlotlyModule = typeof import('plotly.js-dist-min')
export type PlotlyInstance = PlotlyModule['default']

let promise: Promise<PlotlyInstance> | null = null

/**
 * 动态加载 Plotly。首屏不下载 4.6 MB 的图表库，
 * 载入 CSV 时预取，进入图表页时通常已就绪。
 */
export function loadPlotly(): Promise<PlotlyInstance> {
  if (!promise) {
    promise = import('plotly.js-dist-min')
      .then((m) => m.default)
      .catch((err) => {
        promise = null
        throw err
      })
  }
  return promise
}
