<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { groupLabels } from '@/lib/infer'
import { isNull } from '@/lib/format'
import { describe, kde } from '@/lib/stats'
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
  distributionVar: varName,
  distributionGroup: groupName,
  distributionKde: showKde,
  distributionBins: bins,
} = storeToRefs(view)

const chartH = computed(() =>
  Math.max(
    narrow.value ? 300 : 300,
    Math.min(narrow.value ? 580 : 480, vh.value - (narrow.value ? 260 : 260)),
  ),
)

const PALETTE_FALLBACK = '#4c6ef5'

const built = computed(() => {
  const col = ds.column(varName.value)
  if (!col || !col.num) return null

  const values = col.num.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!values.length) return null
  const varLabel = settings.columnLabel(varName.value)

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
    const labels = gcol.raw.map((v) => (isNull(v) ? t('(缺失)') : String(v).trim()))
    groupLabels(gcol).forEach((lab, gi) => {
      const vals = col.num!.filter((v, i) => v !== null && labels[i] === lab) as number[]
      if (!vals.length) return
      const color = settings.paletteColor(gi) || PALETTE_FALLBACK
      const groupLabel = settings.valueLabel(gcol.name, lab)
      traces.push({
        type: 'histogram',
        x: vals,
        name: groupLabel,
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
          name: `${groupLabel} KDE`,
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
      name: varLabel,
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
      xaxis: { title: { text: varLabel } },
      yaxis: { title: { text: t('密度') } },
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
    { k: t('有效样本'), v: `${s.n}` },
    { k: t('均值'), v: s.mean.toFixed(3) },
    { k: t('标准差'), v: s.sd.toFixed(3) },
    { k: t('中位数'), v: s.median.toFixed(3) },
    { k: t('范围'), v: `${s.min.toFixed(2)} ~ ${s.max.toFixed(2)}` },
  ]
})
</script>

<template>
  <section class="panel panel-fit">
    <div class="controls">
      <SelectField
        v-model="varName"
        :label="$t('数值变量')"
        :options="ds.nums.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
      />
      <SelectField
        v-model="groupName"
        :label="$t('分组叠加')"
        :options="[
          { value: '', label: $t('（不分组）') },
          ...ds.groups.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) })),
        ]"
      />
      <SelectField
        v-model="bins"
        :label="$t('分箱数')"
        :options="[
          { value: '0', label: $t('自动') },
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '30', label: '30' },
          { value: '50', label: '50' },
        ]"
      />
      <label class="chk"><input v-model="showKde" type="checkbox" /> {{ $t('核密度曲线') }}</label>
    </div>

    <div class="card chart-card">
      <PlotlyChart
        v-if="built"
        chart-id="distribution"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
        :fill="!narrow"
      />
      <div v-else class="empty-chart">{{ $t('该列没有可用的数值，无法绘制分布') }}</div>
    </div>

    <div class="statstrip">
      <div v-for="s in stats" :key="s.k" class="stat"><span>{{ s.k }}</span><b>{{ s.v }}</b></div>
    </div>
  </section>
</template>
