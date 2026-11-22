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
  categoryCol: catName,
  categoryStack: stackName,
  categoryPercent: percent,
} = storeToRefs(view)

const chartH = computed(() =>
  Math.max(
    narrow.value ? 300 : 300,
    Math.min(narrow.value ? 600 : 480, vh.value - (narrow.value ? 260 : 260)),
  ),
)

const PALETTE_FALLBACK = '#4c6ef5'

const categoryOptions = computed(() => {
  const names = [...new Set([...ds.cats.map((c) => c.name), ...ds.groups.map((c) => c.name)])]
  return names.map((name) => ({ value: name, label: settings.columnLabel(name) }))
})

const stackOptions = computed(() => [
  { value: '', label: t('（不堆叠）') },
  ...ds.groups
    .filter((c) => c.name !== catName.value)
    .map((c) => ({ value: c.name, label: settings.columnLabel(c.name) })),
])

const built = computed(() => {
  const col = ds.column(catName.value)
  if (!col) return null
  const order = groupLabels(col)
  const labels = col.raw.map((v) => (isNull(v) ? t('(缺失)') : String(v).trim()))
  const totals: Record<string, number> = {}
  labels.forEach((l) => {
    totals[l] = (totals[l] || 0) + 1
  })

  const scol = stackName.value ? ds.column(stackName.value) : null
  const stackOrder = scol
    ? groupLabels(scol)
    : [null]
  const stackLabels = scol
    ? scol.raw.map((v) => (isNull(v) ? t('(缺失)') : String(v).trim()))
    : null
  const orderDisplay = order.map((v) =>
    v === t('(缺失)') ? v : settings.valueLabel(col.name, v),
  )

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
      name:
        sl === null || !scol
          ? settings.columnLabel(col.name)
          : settings.valueLabel(scol.name, sl),
      x: orderDisplay,
      y: ys,
      marker: { color: settings.paletteColor(si) || PALETTE_FALLBACK },
      hovertemplate: percent.value
        ? t('%{x}<br>%{y:.1f}%<extra></extra>')
        : t('%{x}<br>%{y} 行<extra></extra>'),
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
      xaxis: {
        title: { text: settings.columnLabel(catName.value) },
        tickangle: order.length > 6 ? -30 : 0,
      },
      yaxis: { title: { text: percent.value ? t('百分比 (%)') : t('行数') } },
      showlegend: !!scol,
    }),
  }
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="catName" :label="$t('类别列')" :options="categoryOptions" />
      <SelectField v-model="stackName" :label="$t('堆叠分组')" :options="stackOptions" />
      <label class="chk"><input v-model="percent" type="checkbox" /> {{ $t('显示百分比') }}</label>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="built"
        chart-id="category"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
      />
      <div v-else class="empty-chart">{{ $t('该数据集没有可用的类别列') }}</div>
    </div>

    <div v-if="built" class="statstrip">
      <div class="stat"><span>{{ $t('类别数') }}</span><b>{{ Object.keys(built.totals).length }}</b></div>
      <div class="stat"><span>{{ $t('最大组') }}</span><b>{{ built.maxCount }} 行</b></div>
      <div class="stat"><span>{{ $t('最小组') }}</span><b>{{ built.minCount }} 行</b></div>
      <div class="stat">
        <span>{{ $t('不平衡比') }}</span>
        <b>{{ built.minCount ? (built.maxCount / built.minCount).toFixed(2) : '—' }}</b>
      </div>
    </div>
  </section>
</template>
