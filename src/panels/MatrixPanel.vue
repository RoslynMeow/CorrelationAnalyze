<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { cramersV, pearson, ranks } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import type { Column } from '@/types'

const ds = useDatasetStore()
const narrow = useNarrow()

const mode = ref<'num' | 'cat'>('num')
const method = ref('pearson')
const mask = ref(true)
const annot = ref(true)

const cols = computed<Column[]>(() =>
  mode.value === 'num'
    ? ds.nums
    : ds.cats.filter((c) => c.uniqueCount <= 25).slice(0, 20),
)

const names = computed(() => cols.value.map((c) => c.name))

function valueOf(a: Column, b: Column): number | null {
  if (mode.value === 'num') {
    const r =
      method.value === 'spearman'
        ? pearson(ranks(a.num || []), ranks(b.num || []))
        : pearson(a.num || [], b.num || [])
    return r === null ? null : +r.toFixed(3)
  }
  const res = cramersV(a.labels || [], b.labels || [])
  return res ? +res.v.toFixed(3) : null
}

const matrix = computed(() => {
  const z: (number | null)[][] = []
  const text: string[][] = []
  for (let i = 0; i < cols.value.length; i++) {
    const zr: (number | null)[] = []
    const tr: string[] = []
    for (let j = 0; j < cols.value.length; j++) {
      if (mask.value && j > i) {
        zr.push(null)
        tr.push('')
        continue
      }
      if (i === j) {
        zr.push(mode.value === 'num' ? 1 : null)
        tr.push(mode.value === 'num' ? '1.00' : '')
        continue
      }
      const v = valueOf(cols.value[i], cols.value[j])
      zr.push(v)
      tr.push(v === null ? '' : v.toFixed(2))
    }
    z.push(zr)
    text.push(tr)
  }
  return { z, text }
})

const chartH = computed(() => {
  const cell = narrow.value ? 26 : 36
  return Math.max(narrow.value ? 300 : 420, cols.value.length * cell + (narrow.value ? 80 : 150))
})

const showText = computed(() => annot.value && cols.value.length <= 22)

const trace = computed(() => {
  const num = mode.value === 'num'
  const vmin = num ? -1 : 0
  const vmax = 1
  const scale = num
    ? [
        [0, '#60a5fa'],
        [0.25, '#bfdbfe'],
        [0.5, '#f8fafc'],
        [0.75, '#fecaca'],
        [1, '#f87171'],
      ]
    : [
        [0, '#f8fafc'],
        [0.25, '#dbeafe'],
        [0.5, '#bfdbfe'],
        [0.75, '#93c5fd'],
        [1, '#60a5fa'],
      ]
  return [
    {
      type: 'heatmap',
      z: matrix.value.z,
      x: names.value,
      y: names.value,
      colorscale: scale,
      zmin: vmin,
      zmax: vmax,
      text: showText.value ? matrix.value.text : undefined,
      texttemplate: showText.value ? '%{text}' : undefined,
      textfont: {
        size: Math.max(6, Math.min(10, (narrow.value ? 190 : 260) / cols.value.length)),
        color: '#111827',
      },
      xgap: 2,
      ygap: 2,
      colorbar: { thickness: 9, len: 0.7, outlinewidth: 0, tickfont: { size: 9 } },
      hovertemplate: num
        ? '%{y} × %{x}<br>r = %{z:.3f}<extra></extra>'
        : '%{y} × %{x}<br>V = %{z:.3f}<extra></extra>',
    },
  ]
})

const layout = computed(() =>
  baseLayout({
    height: chartH.value,
    margin: {
      l: narrow.value ? 84 : 150,
      r: narrow.value ? 12 : 30,
      t: 24,
      b: narrow.value ? 96 : 150,
    },
    xaxis: { tickangle: -45, tickfont: { size: narrow.value ? 8 : 10 }, automargin: true },
    yaxis: { tickfont: { size: narrow.value ? 8 : 10 }, autorange: 'reversed', automargin: true },
    showlegend: false,
  }),
)

const note = computed(() => {
  if (mode.value === 'num') {
    return `数值变量 ${cols.value.length} 个 · ${
      method.value === 'spearman' ? 'Spearman ρ（单调关系）' : 'Pearson r（线性关系）'
    } · 蓝色为负、红色为正`
  }
  return `类别变量 ${cols.value.length} 个（每列 ≤ 25 个取值）· V 越大关联越强（0 ~ 1），与方向无关`
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <div class="seg">
        <button type="button" :class="{ active: mode === 'num' }" @click="mode = 'num'">
          数值变量
        </button>
        <button type="button" :class="{ active: mode === 'cat' }" @click="mode = 'cat'">
          类别变量
        </button>
      </div>
      <SelectField
        v-model="method"
        label="相关方法"
        :disabled="mode === 'cat'"
        :options="[
          { value: 'pearson', label: 'Pearson（线性）' },
          { value: 'spearman', label: 'Spearman（秩相关）' },
        ]"
      />
      <label class="chk"><input v-model="mask" type="checkbox" /> 只显示下三角</label>
      <label class="chk"><input v-model="annot" type="checkbox" /> 标注数值</label>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart v-if="cols.length >= 2" :traces="trace" :layout="layout" :height="chartH" />
      <div v-else class="empty-chart">
        {{ mode === 'num' ? '数值列不足 2 个' : '类别列不足 2 个' }}，无法计算矩阵
      </div>
    </div>
    <div class="hint" style="margin-top: 8px">{{ note }}</div>
  </section>
</template>
