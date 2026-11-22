/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module 'plotly.js-dist-min' {
  export interface PlotlyStatic {
    react(
      el: HTMLElement,
      data: unknown[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>,
    ): Promise<unknown>
    purge(el: HTMLElement): void
    toImage(el: HTMLElement, opts?: Record<string, unknown>): Promise<string>
    Plots: { resize(el: HTMLElement): void }
  }
  const Plotly: PlotlyStatic
  export default Plotly
}
