<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import ChipGroup from '@/components/ChipGroup.vue'
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

const { pairColor: colorName, pairDims: dims } = storeToRefs(view)

const colorOptions = computed(() => [
  { value: '', label: t('（不分组）') },
  ...ds.groups.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) })),
])
const chartH = computed(() =>
  Math.max(
    narrow.value ? 360 : 360,
    Math.min(narrow.value ? 640 : 620, vh.value - (narrow.value ? 230 : 220)),
  ),
)

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

  const dimensions = use.map((c) => ({
    label: settings.columnLabel(c.name),
    values: sample.map((i) => c.num?.[i]),
  }))
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
    const labels = ccol.raw.map((v) => (isNull(v) ? t('(缺失)') : String(v).trim()))
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
        name: settings.valueLabel(ccol.name, l),
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
    }),
  }
})
</script>

<template>
  <section class="panel">
    <div class="controls controls-chips">
      <SelectField v-model="colorName" :label="$t('颜色分组')" :options="colorOptions" />
      <div class="chipfield">
        <span class="chipfield-label">{{ $t('维度（最多 6 个）') }}</span>
        <ChipGroup
          v-model="dims"
          :options="ds.nums.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
          :max="6"
        />
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
        {{ dims.length < 2 ? $t('请至少选择 2 个数值维度') : $t('所选维度没有完整的行') }}
      </div>
    </div>
  </section>
</template>
