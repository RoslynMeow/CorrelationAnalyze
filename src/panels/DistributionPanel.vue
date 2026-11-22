<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { groupLabels } from '@/lib/infer'
import { isNull } from '@/lib/format'
import { describe, kde } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useSettingsStore } from '@/stores/settings'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()

const varName = ref(ds.nums[0]?.name || '')
const groupName = ref('')
const showKde = ref(true)
const bins = ref('0')

const chartH = computed(() => (narrow.value ? 360 : 460))

const PALETTE_FALLBACK = '#4c6ef5'

const built = computed(() => {
  const col = ds.column(varName.value)
  if (!col || !col.num) return null

  const values = col.num.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!values.length) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.04 || 1
  const grid: number[] = []
  const G = 128
  for (let i = 0; i < G; i++) grid.push(min - pad + ((max - min + 2 * pad) * i) / (G - 1))

  const traces: Record<string, unknown>[] = []
  const nbins = Number(bins.value) || 0
  const histExtra = nbins ? { nbinsx: nbins } : { autobinx: true }
  const gcol = groupName.value ? ds.column(groupName.value) : null

  if (gcol) {
    const labels = gcol.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))
    groupLabels(gcol).forEach((lab, gi) => {
      const vals = col.num!.filter((v, i) => v !== null && labels[i] === lab) as number[]
      if (!vals.length) return
      const color = settings.paletteColor(gi) || PALETTE_FALLBACK
      traces.push({
        type: 'histogram',
        x: vals,
        name: lab,
        histnorm: 'probability density',
        marker: { color, opacity: 0.5, line: { width: 0 } },
        ...histExtra,
      })
      if (showKde.value && vals.length >= 3) {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: grid,
          y: kde(vals, grid),
          name: `${lab} KDE`,
          line: { color, width: 2 },
          hoverinfo: 'skip',
          showlegend: false,
        })
      }
    })
  } else {
    traces.push({
      type: 'histogram',
      x: values,
      name: varName.value,
      histnorm: 'probability density',
      marker: { color: settings.paletteColor(0) || PALETTE_FALLBACK, opacity: 0.6, line: { width: 0 } },
      ...histExtra,
    })
    if (showKde.value && values.length >= 3) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: grid,
        y: kde(values, grid),
        name: 'KDE',
        line: { color: settings.paletteColor(1) || '#d64545', width: 2 },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }
  }

  return {
    traces,
    layout: baseLayout({
      height: chartH.value,
      barmode: 'overlay',
      bargap: 0.02,
      xaxis: { title: { text: varName.value } },
      yaxis: { title: { text: '密度' } },
      legend: { orientation: 'h', y: -0.16 },
      showlegend: !!gcol,
    }),
  }
})

const stats = computed(() => {
  const col = ds.column(varName.value)
  if (!col || !col.num) return []
  const s = describe(col.num)
  if (!s) return []
  return [
    { k: '有效样本', v: `${s.n}` },
    { k: '均值', v: s.mean.toFixed(3) },
    { k: '标准差', v: s.sd.toFixed(3) },
    { k: '中位数', v: s.median.toFixed(3) },
    { k: '范围', v: `${s.min.toFixed(2)} ~ ${s.max.toFixed(2)}` },
  ]
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="varName" label="数值变量" :options="ds.nums.map((c) => c.name)" />
      <SelectField
        v-model="groupName"
        label="分组叠加"
        :options="[{ value: '', label: '（不分组）' }, ...ds.groups.map((c) => c.name)]"
      />
      <SelectField
        v-model="bins"
        label="分箱数"
        :options="[
          { value: '0', label: '自动' },
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '30', label: '30' },
          { value: '50', label: '50' },
        ]"
      />
      <label class="chk"><input v-model="showKde" type="checkbox" /> 核密度曲线</label>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="built"
        chart-id="distribution"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
      />
      <div v-else class="empty-chart">该列没有可用的数值，无法绘制分布</div>
    </div>

    <div class="statstrip">
      <div v-for="s in stats" :key="s.k" class="stat"><span>{{ s.k }}</span><b>{{ s.v }}</b></div>
    </div>
  </section>
</template>
