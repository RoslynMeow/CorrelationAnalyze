<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import { baseLayout } from '@/lib/chartTheme'
import { groupLabels, pickGroup, preferredNums } from '@/lib/infer'
import { isNull } from '@/lib/format'
import { useNarrow } from '@/composables/useNarrow'
import { useSettingsStore } from '@/stores/settings'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()

const colorName = ref(pickGroup(ds.groups))
const dims = ref(preferredNums(ds.nums, 4))

const colorOptions = computed(() => [
  { value: '', label: '（不分组）' },
  ...ds.groups.map((c) => c.name),
])
const chartH = computed(() => (narrow.value ? 430 : 620))

const built = computed(() => {
  const cols = dims.value.slice(0, 6).map((n) => ds.column(n))
  if (cols.length < 2 || cols.some((c) => !c)) return null
  const use = cols as NonNullable<(typeof cols)[number]>[]

  const idx: number[] = []
  for (let i = 0; i < ds.n; i++) {
    if (use.every((c) => c.num?.[i] !== null && c.num?.[i] !== undefined && Number.isFinite(c.num[i] as number))) {
      idx.push(i)
    }
  }
  if (!idx.length) return null
  const sample = idx.length > 3000 ? idx.slice(0, 3000) : idx

  const dimensions = use.map((c) => ({ label: c.name, values: sample.map((i) => c.num?.[i]) }))
  const ccol = colorName.value ? ds.column(colorName.value) : null

  const trace: Record<string, unknown> = {
    type: 'splom',
    dimensions,
    showupperhalf: false,
    diagonal: { visible: true },
    marker: { size: 4.5, opacity: 0.72, line: { width: 0.4 } },
  }

  const legendTraces: Record<string, unknown>[] = []
  if (ccol) {
    const labels = ccol.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))
    const order = groupLabels(ccol)
    const map = new Map(order.map((l, i) => [l, settings.paletteColor(i)]))
    ;(trace.marker as Record<string, unknown>).color = sample.map(
      (i) => map.get(labels[i]) || '#94a3b8',
    )
    order.forEach((l) => {
      legendTraces.push({
        type: 'scatter',
        mode: 'markers',
        x: [null],
        y: [null],
        name: l,
        marker: { color: map.get(l), size: 8 },
        showlegend: true,
        hoverinfo: 'skip',
      })
    })
  } else {
    ;(trace.marker as Record<string, unknown>).color = settings.paletteColor(0)
  }

  return {
    traces: [trace, ...legendTraces],
    layout: baseLayout({
      height: chartH.value,
      dragmode: 'select',
      margin: { l: 60, r: 30, t: 40, b: 60 },
      xaxis: { tickfont: { size: 9 } },
      yaxis: { tickfont: { size: 9 } },
      showlegend: !!ccol,
      legend: { orientation: 'h', y: -0.1 },
    }),
  }
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="colorName" label="颜色分组" :options="colorOptions" />
      <div class="chipfield">
        <span class="chipfield-label">维度（最多 6 个）</span>
        <ChipGroup v-model="dims" :options="ds.nums.map((c) => c.name)" :max="6" />
      </div>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="built"
        chart-id="pairs"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
      />
      <div v-else class="empty-chart">
        {{ dims.length < 2 ? '请至少选择 2 个数值维度' : '所选维度没有完整的行' }}
      </div>
    </div>
  </section>
</template>
