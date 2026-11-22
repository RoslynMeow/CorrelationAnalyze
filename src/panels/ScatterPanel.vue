<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { axisValues, baseLayout } from '@/lib/chartTheme'
import { withAlpha } from '@/lib/color'
import { groupLabels } from '@/lib/infer'
import { fmt, fmtP, isNull } from '@/lib/format'
import { corrPValue, linreg, pearson, spearman } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useViewportHeight } from '@/composables/useViewportHeight'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'

const ds = useDatasetStore()
const view = useViewStore()
const settings = useSettingsStore()
const narrow = useNarrow()
const vh = useViewportHeight()

const {
  scatterX: xName,
  scatterY: yName,
  scatterColor: colorName,
  scatterSize: sizeName,
  scatterTrend: trend,
  scatterLogX: logX,
} = storeToRefs(view)

const xOptions = computed(() =>
  [...ds.nums, ...ds.dates].map((c) => ({ value: c.name, label: settings.columnLabel(c.name) })),
)
const colorOptions = computed(() => [
  { value: '', label: t('（不分组）') },
  ...ds.groups.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) })),
])
const sizeOptions = computed(() => [
  { value: '', label: t('（固定大小）') },
  ...ds.nums.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) })),
])

const chartH = computed(() =>
  Math.max(
    narrow.value ? 320 : 340,
    Math.min(narrow.value ? 600 : 560, vh.value - (narrow.value ? 240 : 280)),
  ),
)

const built = computed(() => {
  const xc = ds.column(xName.value)
  const yc = ds.column(yName.value)
  if (!xc || !yc) return null

  const xv = axisValues(xc)
  const yv = axisValues(yc)
  const xLabel = settings.columnLabel(xName.value)
  const yLabel = settings.columnLabel(yName.value)
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
      const groupLabel = settings.valueLabel(ccol.name, lab)
      const tr: Record<string, unknown> = {
        type: 'scattergl',
        mode: 'markers',
        name: `${groupLabel} (${ii.length})`,
        x: ii.map((i) => xv[i]),
        y: ii.map((i) => yv[i]),
        marker: {
          color,
          size: sv ? ii.map((i) => sv[i] || 0) : 8,
          opacity: 0.75,
          line: { width: 0 },
        },
        hovertemplate: `${groupLabel}<br>${xLabel}: %{x}<br>${yLabel}: %{y}<extra></extra>`,
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
      name: t('数据点'),
      x: idx.map((i) => xv[i]),
      y: idx.map((i) => yv[i]),
      marker: {
        color: withAlpha(settings.paletteColor(0), 0.7),
        size: sv ? idx.map((i) => sv[i] || 0) : 8,
      },
      hovertemplate: `${xLabel}: %{x}<br>${yLabel}: %{y}<extra></extra>`,
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
      name: t('拟合线'),
      x: [xmin, xmax],
      y: [reg.a + reg.b * xmin, reg.a + reg.b * xmax],
      line: { color: 'rgba(120,130,150,0.9)', width: 2, dash: 'dash' },
      hoverinfo: 'skip',
    })
  }

  const r = reg ? reg.r : pearson(validX, validY)
  const rho = spearman(validX, validY)
  let note =
    t('样本 n = {n} · Pearson r = {r} · Spearman ρ = {rho}', {
      n: idx.length,
      r: r === null ? '—' : r.toFixed(3),
      rho: rho === null ? '—' : rho.toFixed(3),
    })
  if (reg) {
    note += ` · ${t('拟合')} y = ${fmt(reg.b, 3)}x ${reg.a >= 0 ? '+' : '−'} ${fmt(Math.abs(reg.a), 3)}`
    note += ` · R² = ${reg.r2 === null ? '—' : reg.r2.toFixed(3)} · p = ${fmtP(reg.p)}`
    if (reg.slopeCi) {
      note += ` · ${t('斜率 95% CI')} [${fmt(reg.slopeCi[0], 3)}, ${fmt(reg.slopeCi[1], 3)}]`
    }
  } else {
    note += ` · p = ${fmtP(r === null ? null : corrPValue(r, idx.length))}`
  }
  if (xc.type === 'date') note += ' · ' + t('X 为日期，斜率按时间戳计算')

  return {
    traces,
    note,
    layout: baseLayout({
      height: chartH.value,
      xaxis: {
        title: { text: xLabel },
        type: logX.value ? 'log' : xc.type === 'date' ? 'date' : 'linear',
      },
      yaxis: { title: { text: yLabel } },
    }),
  }
})
</script>

<template>
  <section class="panel panel-fit">
    <div class="controls">
      <SelectField v-model="xName" :label="$t('X 轴')" :options="xOptions" />
      <SelectField
        v-model="yName"
        :label="$t('Y 轴')"
        :options="ds.nums.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
      />
      <SelectField v-model="colorName" :label="$t('颜色分组')" :options="colorOptions" />
      <SelectField v-model="sizeName" :label="$t('气泡大小')" :options="sizeOptions" />
      <label class="chk"><input v-model="trend" type="checkbox" /> {{ $t('拟合线') }}</label>
      <label class="chk"><input v-model="logX" type="checkbox" /> {{ $t('对数 X') }}</label>
    </div>

    <div class="card chart-card">
      <PlotlyChart
        v-if="built"
        chart-id="scatter"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
        :fill="!narrow"
      />
      <div v-else class="empty-chart">
        {{ xName && yName ? $t('所选变量没有有效数值对') : $t('该数据集没有足够的数值列，无法绘制散点图') }}
      </div>
    </div>
    <div class="hint" style="margin-top: 8px">{{ built?.note }}</div>
  </section>
</template>
