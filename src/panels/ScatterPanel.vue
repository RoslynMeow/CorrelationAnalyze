<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { axisValues, baseLayout } from '@/lib/chartTheme'
import { withAlpha } from '@/lib/color'
import { groupLabels, pickDefault, pickGroup } from '@/lib/infer'
import { fmt, isNull } from '@/lib/format'
import { linreg, pearson, spearman } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useSettingsStore } from '@/stores/settings'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()

const xName = ref(pickDefault(ds.nums, /stress|hours|score/i))
const yName = ref(
  pickDefault(
    ds.nums.filter((c) => c.name !== xName.value),
    /index|performance|score|value|rate/i,
  ),
)
const colorName = ref(pickGroup(ds.groups))
const sizeName = ref('')
const trend = ref(true)
const logX = ref(false)

const xOptions = computed(() => [...ds.nums.map((c) => c.name), ...ds.dates.map((c) => c.name)])
const colorOptions = computed(() => [
  { value: '', label: '（不分组）' },
  ...ds.groups.map((c) => c.name),
])
const sizeOptions = computed(() => [
  { value: '', label: '（固定大小）' },
  ...ds.nums.map((c) => c.name),
])

const chartH = computed(() => (narrow.value ? 380 : 520))

const built = computed(() => {
  const xc = ds.column(xName.value)
  const yc = ds.column(yName.value)
  if (!xc || !yc) return null

  const xv = axisValues(xc)
  const yv = axisValues(yc)
  let idx: number[] = []
  for (let i = 0; i < ds.n; i++) {
    const x = xv[i]
    const y = yv[i]
    if (x === null || y === null || x === undefined || y === undefined) continue
    if (logX.value && (typeof x !== 'number' || x <= 0)) continue
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) continue
    idx.push(i)
  }
  if (!idx.length) return null
  if (idx.length > 6000) idx = idx.slice(0, 6000)

  const scol = sizeName.value ? ds.column(sizeName.value) : null
  const sv = scol?.num || null
  const maxSize = sv ? Math.max(...idx.map((i) => sv[i] || 0), 1e-9) : 1
  const sizeref = (2 * maxSize) / (34 * 34)

  const traces: Record<string, unknown>[] = []
  const ccol = colorName.value ? ds.column(colorName.value) : null

  if (ccol) {
    const labels = ccol.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))
    const order = groupLabels(ccol)
    order.forEach((lab, gi) => {
      const ii = idx.filter((i) => labels[i] === lab)
      if (!ii.length) return
      const color = settings.paletteColor(gi)
      const tr: Record<string, unknown> = {
        type: 'scattergl',
        mode: 'markers',
        name: `${lab} (${ii.length})`,
        x: ii.map((i) => xv[i]),
        y: ii.map((i) => yv[i]),
        marker: {
          color,
          size: sv ? ii.map((i) => sv[i] || 0) : 8,
          opacity: 0.75,
          line: { width: 0 },
        },
        hovertemplate: `${lab}<br>${xName.value}: %{x}<br>${yName.value}: %{y}<extra></extra>`,
      }
      if (sv) {
        ;(tr.marker as Record<string, unknown>).sizemode = 'area'
        ;(tr.marker as Record<string, unknown>).sizeref = sizeref
        ;(tr.marker as Record<string, unknown>).sizemin = 4
      }
      traces.push(tr)
    })
  } else {
    const tr: Record<string, unknown> = {
      type: 'scattergl',
      mode: 'markers',
      name: '数据点',
      x: idx.map((i) => xv[i]),
      y: idx.map((i) => yv[i]),
      marker: {
        color: withAlpha(settings.paletteColor(0), 0.7),
        size: sv ? idx.map((i) => sv[i] || 0) : 8,
      },
      hovertemplate: `${xName.value}: %{x}<br>${yName.value}: %{y}<extra></extra>`,
    }
    if (sv) {
      ;(tr.marker as Record<string, unknown>).sizemode = 'area'
      ;(tr.marker as Record<string, unknown>).sizeref = sizeref
      ;(tr.marker as Record<string, unknown>).sizemin = 4
    }
    traces.push(tr)
  }

  const validX = idx.map((i) => Number(xv[i]))
  const validY = idx.map((i) => Number(yv[i]))
  const reg = trend.value ? linreg(validX, validY) : null
  if (reg) {
    const xmin = Math.min(...validX)
    const xmax = Math.max(...validX)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      name: '拟合线',
      x: [xmin, xmax],
      y: [reg.a + reg.b * xmin, reg.a + reg.b * xmax],
      line: { color: 'rgba(120,130,150,0.9)', width: 2, dash: 'dash' },
      hoverinfo: 'skip',
    })
  }

  const r = reg ? reg.r : pearson(validX, validY)
  const rho = spearman(validX, validY)
  let note =
    `样本 n = ${idx.length} · Pearson r = ${r === null ? '—' : r.toFixed(3)}` +
    ` · Spearman ρ = ${rho === null ? '—' : rho.toFixed(3)}`
  if (reg) {
    note += ` · 拟合 y = ${fmt(reg.b, 3)}x ${reg.a >= 0 ? '+' : '−'} ${fmt(Math.abs(reg.a), 3)}`
  }
  if (xc.type === 'date') note += ' · X 为日期，斜率按时间戳计算'

  return {
    traces,
    note,
    layout: baseLayout({
      height: chartH.value,
      xaxis: {
        title: { text: xName.value },
        type: logX.value ? 'log' : xc.type === 'date' ? 'date' : 'linear',
      },
      yaxis: { title: { text: yName.value } },
      legend: { orientation: 'h', y: -0.14 },
    }),
  }
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="xName" label="X 轴" :options="xOptions" />
      <SelectField v-model="yName" label="Y 轴" :options="ds.nums.map((c) => c.name)" />
      <SelectField v-model="colorName" label="颜色分组" :options="colorOptions" />
      <SelectField v-model="sizeName" label="气泡大小" :options="sizeOptions" />
      <label class="chk"><input v-model="trend" type="checkbox" /> 拟合线</label>
      <label class="chk"><input v-model="logX" type="checkbox" /> 对数 X</label>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="built"
        chart-id="scatter"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
      />
      <div v-else class="empty-chart">
        {{ xName && yName ? '所选变量没有有效数值对' : '该数据集没有足够的数值列，无法绘制散点图' }}
      </div>
    </div>
    <div class="hint" style="margin-top: 8px">{{ built?.note }}</div>
  </section>
</template>
