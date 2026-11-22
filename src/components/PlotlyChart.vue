<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Plotly from 'plotly.js-dist-min'
import { CHART_CONFIG } from '@/lib/chartTheme'

const props = defineProps<{
  traces: unknown[]
  layout?: Record<string, unknown>
  config?: Record<string, unknown>
  height?: number | string
}>()

const el = ref<HTMLDivElement | null>(null)

async function draw(): Promise<void> {
  if (!el.value) return
  const config = { ...CHART_CONFIG, ...(props.config || {}) }
  try {
    await Plotly.react(el.value, props.traces, props.layout || {}, config)
  } catch (err) {
    console.error('Plotly 渲染失败', err)
  }
}

onMounted(draw)
watch(
  () => [props.traces, props.layout],
  () => {
    void draw()
  },
  { flush: 'post' },
)
onBeforeUnmount(() => {
  if (el.value) {
    try {
      Plotly.purge(el.value)
    } catch {
      /* 忽略 */
    }
  }
})
</script>

<template>
  <div
    ref="el"
    class="chart-host"
    data-plotly-host
    :style="{ height: typeof height === 'number' ? height + 'px' : height }"
  ></div>
</template>
