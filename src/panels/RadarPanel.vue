<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import ChipPicker from '@/components/ChipPicker.vue'
import { baseLayout, cssv } from '@/lib/chartTheme'
import { withAlpha } from '@/lib/color'
import { groupLabels } from '@/lib/infer'
import { isNull } from '@/lib/format'
import { describe } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useViewportHeight } from '@/composables/useViewportHeight'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'

const ds = useDatasetStore()
const view = useViewStore()
const settings = useSettingsStore()
const narrow = useNarrow()
const vh = useViewportHeight()

const { radarGroup: groupName, radarDims: dims, radarNorm: norm } = storeToRefs(view)

const chartH = computed(() =>
  Math.max(
    narrow.value ? 320 : 340,
    Math.min(narrow.value ? 600 : 520, vh.value - (narrow.value ? 240 : 360)),
  ),
)

const PALETTE_FALLBACK = '#4c6ef5'

const built = computed(() => {
  const gcol = groupName.value ? ds.column(groupName.value) : null
  if (!gcol) return null
  const names = dims.value.slice(0, 12)
  if (names.length < 3) return null
  const displayNames = names.map((n) => settings.columnLabel(n))

  const groups = groupLabels(gcol)
  const labels = gcol.raw.map((v) => (isNull(v) ? t('(缺失)') : String(v).trim()))

  // 每个维度先整体标准化，再按组求均值
  const normed = names.map((name) => {
    const col = ds.column(name)
    const raw = col?.num || []
    const s = describe(raw)
    const out: (number | null)[] = raw.map(() => null)
    if (!s) return out
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i]
      if (v === null || !Number.isFinite(v)) continue
      if (norm.value === 'zscore') {
        out[i] = s.sd ? (v - s.mean) / s.sd : 0
      } else {
        out[i] = s.max - s.min ? (v - s.min) / (s.max - s.min) : 0
      }
    }
    return out
  })

  const traces = groups.map((g, gi) => {
    const r = names.map((_, di) => {
      const vals = normed[di].filter(
        (v, i): v is number => v !== null && labels[i] === g,
      )
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    })
    const color = settings.paletteColor(gi) || PALETTE_FALLBACK
    const groupLabel = settings.valueLabel(gcol.name, g)
    return {
      type: 'scatterpolar',
      mode: 'lines+markers',
      r: [...r, r[0]],
      theta: [...displayNames, displayNames[0]],
      name: groupLabel,
      fill: 'toself',
      fillcolor: withAlpha(color, 0.12),
      line: { color, width: 2 },
      marker: { color, size: 5 },
      hovertemplate: '%{theta}<br>%{r:.3f}<extra>' + groupLabel + '</extra>',
    }
  })

  return {
    traces,
    layout: baseLayout({
      height: chartH.value,
      margin: narrow.value
        ? { l: 28, r: 28, t: 36, b: 36 }
        : { l: 60, r: 60, t: 50, b: 60 },
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        radialaxis: {
          gridcolor: cssv('--border'),
          linecolor: cssv('--border'),
          tickfont: { size: 8, color: cssv('--muted') },
          angle: 90,
          tickangle: 90,
        },
        angularaxis: {
          gridcolor: cssv('--border'),
          linecolor: cssv('--border'),
          tickfont: { size: narrow.value ? 8 : 10, color: cssv('--text') },
        },
      },
      showlegend: true,
    }),
  }
})
</script>

<template>
  <section class="panel panel-fit">
    <div class="controls">
      <SelectField
        v-model="groupName"
        :label="$t('分组列')"
        :options="ds.groups.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
      />
      <SelectField
        v-model="norm"
        :label="$t('标准化')"
        :options="[
          { value: 'minmax', label: $t('Min-Max（0–1）') },
          { value: 'zscore', label: $t('Z-Score') },
        ]"
      />
      <ChipPicker
        v-model="dims"
        :label="$t('画像维度（3–12 个）')"
        :options="ds.nums.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
        :max="12"
      />
    </div>

    <div class="card chart-card">
      <PlotlyChart
        v-if="built"
        chart-id="radar"
        :traces="built.traces"
        :layout="built.layout"
        :height="chartH"
        :fill="!narrow"
      />
      <div v-else class="empty-chart">
        {{
          !groupName
            ? $t('该数据集没有适合分组的列')
            : $t('请至少选择 3 个数值维度来绘制雷达画像')
        }}
      </div>
    </div>
    <div class="hint" style="margin-top: 8px">
      {{
        $t('各维度先按全样本标准化（{mode}），再按组求均值。标准化后 0.5 附近的差异不代表原始量级，仅用于形状对比。', {
          mode: norm === 'zscore' ? 'Z-Score' : 'Min-Max 0–1',
        })
      }}
    </div>
  </section>
</template>
