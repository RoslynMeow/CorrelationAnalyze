<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { divergingScale, sequentialScale } from '@/lib/color'
import { cramersV, pearson, ranks } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useViewportHeight } from '@/composables/useViewportHeight'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'
import type { Column } from '@/types'

const ds = useDatasetStore()
const view = useViewStore()
const settings = useSettingsStore()
const narrow = useNarrow()
const vh = useViewportHeight()

const {
  matrixMode: mode,
  matrixMethod: method,
  matrixMask: mask,
  matrixAnnot: annot,
} = storeToRefs(view)

const cols = computed<Column[]>(() =>
  mode.value === 'num'
    ? ds.nums
    : ds.cats.filter((c) => c.uniqueCount <= 25).slice(0, 20),
)

const names = computed(() => cols.value.map((c) => settings.columnLabel(c.name)))

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
  const needed = cols.value.length * cell + (narrow.value ? 80 : 130)
  const max = vh.value - (narrow.value ? 230 : 250)
  return Math.max(narrow.value ? 260 : 300, Math.min(needed, Math.max(280, max)))
})

/** 列少时不要把 2×2 矩阵拉满整张卡片 */
const chartW = computed(() => {
  const per = narrow.value ? 36 : 48
  return Math.max(
    narrow.value ? 300 : 380,
    cols.value.length * per + (narrow.value ? 110 : 210),
  )
})

const showText = computed(() => annot.value && cols.value.length <= 22)

const numScale = computed(() => {
  const hm = settings.state.charts.heatmap
  return divergingScale(hm.neg, hm.mid, hm.pos)
})
const catScale = computed(() => {
  const hm = settings.state.charts.heatmap
  return sequentialScale(hm.low, hm.high)
})

const trace = computed(() => {
  const num = mode.value === 'num'
  const vmin = num ? -1 : 0
  const vmax = 1
  return [
    {
      type: 'heatmap',
      z: matrix.value.z,
      x: names.value,
      y: names.value,
      colorscale: num ? numScale.value : catScale.value,
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
    return t('数值变量 {n} 个 · {method} · 蓝色为负、红色为正', {
      n: cols.value.length,
      method:
        method.value === 'spearman'
          ? t('Spearman ρ（单调关系）')
          : t('Pearson r（线性关系）'),
    })
  }
  return t(
    '类别变量 {n} 个（每列 ≤ 25 个取值）· V 越大关联越强（0 ~ 1），与方向无关',
    { n: cols.value.length },
  )
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <div class="seg">
        <button type="button" :class="{ active: mode === 'num' }" @click="mode = 'num'">
          {{ $t('数值变量') }}
        </button>
        <button type="button" :class="{ active: mode === 'cat' }" @click="mode = 'cat'">
          {{ $t('类别变量') }}
        </button>
      </div>
      <SelectField
        v-model="method"
        :label="$t('相关方法')"
        :disabled="mode === 'cat'"
        :options="[
          { value: 'pearson', label: $t('Pearson（线性）') },
          { value: 'spearman', label: $t('Spearman（秩相关）') },
        ]"
      />
      <label class="chk"><input v-model="mask" type="checkbox" /> {{ $t('只显示下三角') }}</label>
      <label class="chk"><input v-model="annot" type="checkbox" /> {{ $t('标注数值') }}</label>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="cols.length >= 2"
        chart-id="matrix"
        :traces="trace"
        :layout="layout"
        :height="chartH"
        :max-width="chartW"
      />
      <div v-else class="empty-chart">
        {{ $t('{msg}，无法计算矩阵', { msg: mode === 'num' ? $t('数值列不足 2 个') : $t('类别列不足 2 个') }) }}
      </div>
    </div>
    <div class="hint" style="margin-top: 8px">{{ note }}</div>
  </section>
</template>
