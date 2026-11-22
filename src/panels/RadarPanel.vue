<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import { baseLayout, cssv } from '@/lib/chartTheme'
import { groupLabels, pickGroup, preferredNums } from '@/lib/infer'
import { hexA, isNull } from '@/lib/format'
import { describe } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'

const ds = useDatasetStore()
const narrow = useNarrow()

const groupName = ref(pickGroup(ds.groups))
const dims = ref(preferredNums(ds.nums, 8))
const norm = ref('minmax')

const chartH = computed(() => (narrow.value ? 420 : 560))

const PALETTE = [
  '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494',
  '#b3b3b3', '#80b1d3', '#fb8072', '#bebada', '#ffffb3', '#1b9e77', '#d95f02',
]

const built = computed(() => {
  const gcol = groupName.value ? ds.column(groupName.value) : null
  if (!gcol) return null
  const names = dims.value.slice(0, 12)
  if (names.length < 3) return null

  const groups = groupLabels(gcol)
  const labels = gcol.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))

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
    const color = PALETTE[gi % PALETTE.length]
    return {
      type: 'scatterpolar',
      mode: 'lines+markers',
      r: [...r, r[0]],
      theta: [...names, names[0]],
      name: g,
      fill: 'toself',
      fillcolor: hexA(color, 0.12),
      line: { color, width: 2 },
      marker: { color, size: 5 },
      hovertemplate: '%{theta}<br>%{r:.3f}<extra>' + g + '</extra>',
    }
  })

  return {
    traces,
    layout: baseLayout({
      height: chartH.value,
      margin: { l: 60, r: 60, t: 50, b: 60 },
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        radialaxis: {
          gridcolor: cssv('--border'),
          linecolor: cssv('--border'),
          tickfont: { size: 9, color: cssv('--muted') },
          angle: 90,
          tickangle: 90,
        },
        angularaxis: {
          gridcolor: cssv('--border'),
          linecolor: cssv('--border'),
          tickfont: { size: 10, color: cssv('--text') },
        },
      },
      showlegend: true,
      legend: { orientation: 'h', y: -0.08 },
    }),
  }
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="groupName" label="分组列" :options="ds.groups.map((c) => c.name)" />
      <SelectField
        v-model="norm"
        label="标准化"
        :options="[
          { value: 'minmax', label: 'Min-Max（0–1）' },
          { value: 'zscore', label: 'Z-Score' },
        ]"
      />
      <div class="grow">
        <div class="field" style="margin-bottom: 4px">画像维度（3–12 个）</div>
        <ChipGroup v-model="dims" :options="ds.nums.map((c) => c.name)" :max="12" />
      </div>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart v-if="built" :traces="built.traces" :layout="built.layout" :height="chartH" />
      <div v-else class="empty-chart">
        {{
          !groupName
            ? '该数据集没有适合分组的列'
            : '请至少选择 3 个数值维度来绘制雷达画像'
        }}
      </div>
    </div>
    <div class="hint" style="margin-top: 8px">
      各维度先按全样本标准化（{{ norm === 'zscore' ? 'Z-Score' : 'Min-Max 0–1' }}），再按组求均值。
      标准化后 0.5 附近的差异不代表原始量级，仅用于形状对比。
    </div>
  </section>
</template>
