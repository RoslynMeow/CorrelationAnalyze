<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { groupLabels } from '@/lib/infer'
import { isNull } from '@/lib/format'
import { useNarrow } from '@/composables/useNarrow'
import { useSettingsStore } from '@/stores/settings'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()

const catName = ref(ds.cats[0]?.name || ds.groups[0]?.name || '')
const stackName = ref('')
const percent = ref(false)

const chartH = computed(() => (narrow.value ? 380 : 480))

const PALETTE_FALLBACK = '#4c6ef5'

const categoryOptions = computed(() => [
  ...new Set([...ds.cats.map((c) => c.name), ...ds.groups.map((c) => c.name)]),
])

const stackOptions = computed(() => [
  { value: '', label: '（不堆叠）' },
  ...ds.groups.filter((c) => c.name !== catName.value).map((c) => c.name),
])

const built = computed(() => {
  const col = ds.column(catName.value)
  if (!col) return null
  const order = groupLabels(col)
  const labels = col.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))
  const totals: Record<string, number> = {}
  labels.forEach((l) => {
    totals[l] = (totals[l] || 0) + 1
  })

  const scol = stackName.value ? ds.column(stackName.value) : null
  const stackOrder = scol
    ? groupLabels(scol)
    : [null]
  const stackLabels = scol
    ? scol.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))
    : null

  const traces = stackOrder.map((sl, si) => {
    const ys = order.map((main) => {
      let count = 0
      for (let i = 0; i < ds.n; i++) {
        if (labels[i] !== main) continue
        if (stackLabels && stackLabels[i] !== sl) continue
        count++
      }
      return percent.value ? (totals[main] ? (count / totals[main]) * 100 : 0) : count
    })
    return {
      type: 'bar',
      name: sl === null ? col.name : sl,
      x: order,
      y: ys,
      marker: { color: settings.paletteColor(si) || PALETTE_FALLBACK },
      hovertemplate: percent.value ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>%{y} 行<extra></extra>',
    }
  })

  const maxCount = Math.max(...order.map((o) => totals[o] || 0))
  const minCount = Math.min(...order.map((o) => totals[o] || 0))

  return {
    traces,
    totals,
    maxCount,
    minCount,
    layout: baseLayout({
      height: chartH.value,
      barmode: 'stack',
      xaxis: { title: { text: catName.value }, tickangle: order.length > 6 ? -30 : 0 },
      yaxis: { title: { text: percent.value ? '百分比 (%)' : '行数' } },
      legend: { orientation: 'h', y: -0.2 },
      showlegend: !!scol,
    }),
  }
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="catName" label="类别列" :options="categoryOptions" />
      <SelectField v-model="stackName" label="堆叠分组" :options="stackOptions" />
      <label class="chk"><input v-model="percent" type="checkbox" /> 显示百分比</label>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="built"
        chart-id="category"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
      />
      <div v-else class="empty-chart">该数据集没有可用的类别列</div>
    </div>

    <div v-if="built" class="statstrip">
      <div class="stat"><span>类别数</span><b>{{ Object.keys(built.totals).length }}</b></div>
      <div class="stat"><span>最大组</span><b>{{ built.maxCount }} 行</b></div>
      <div class="stat"><span>最小组</span><b>{{ built.minCount }} 行</b></div>
      <div class="stat">
        <span>不平衡比</span>
        <b>{{ built.minCount ? (built.maxCount / built.minCount).toFixed(2) : '—' }}</b>
      </div>
    </div>
  </section>
</template>
