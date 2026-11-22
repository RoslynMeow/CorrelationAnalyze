<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import ChipPicker from '@/components/ChipPicker.vue'
import { baseLayout } from '@/lib/chartTheme'
import { divergingScale } from '@/lib/color'
import { fmtInt } from '@/lib/format'
import { corrPValueDf, partialCorrMatrix, starsForP, vifStats } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useWide } from '@/composables/useWide'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'
import type { Column } from '@/types'

const ds = useDatasetStore()
const view = useViewStore()
const settings = useSettingsStore()
const narrow = useNarrow()
const wide = useWide()

const { partialControls: controls } = storeToRefs(view)
const mask = ref(true)
const annot = ref(true)

const vars = computed<Column[]>(() =>
  ds.nums.filter((c) => !controls.value.includes(c.name)).slice(0, 20),
)
const labels = computed(() => vars.value.map((c) => settings.columnLabel(c.name)))

const controlCols = computed(() =>
  controls.value
    .map((name) => ds.column(name))
    .filter((c): c is Column => !!c && c.type === 'number'),
)

const matrix = computed(() =>
  partialCorrMatrix(
    vars.value.map((c) => c.num || []),
    controlCols.value.map((c) => c.num || []),
  ),
)

const cells = computed(() => {
  const m = matrix.value
  if (!m) return null
  const z: (number | null)[][] = []
  const text: string[][] = []
  const ps: string[][] = []
  for (let i = 0; i < m.r.length; i++) {
    const zr: (number | null)[] = []
    const tr: string[] = []
    const pr: string[] = []
    for (let j = 0; j < m.r.length; j++) {
      if (mask.value && j > i) {
        zr.push(null)
        tr.push('')
        pr.push('')
        continue
      }
      if (i === j) {
        const diag = m.r[i][i]
        zr.push(diag)
        tr.push(diag === null || !annot.value ? '' : '1.00')
        pr.push('')
        continue
      }
      const r = m.r[i][j]
      if (r === null) {
        zr.push(null)
        tr.push('')
        pr.push('')
        continue
      }
      const p = corrPValueDf(r, m.df)
      const stars = starsForP(p)
      zr.push(r)
      tr.push(annot.value ? `${r.toFixed(2)}${stars}` : stars)
      pr.push(p === null ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3))
    }
    z.push(zr)
    text.push(tr)
    ps.push(pr)
  }
  return { z, text, ps }
})

const traces = computed(() => {
  const data = cells.value
  if (!data) return []
  const hm = settings.state.charts.heatmap
  return [
    {
      type: 'heatmap',
      z: data.z,
      x: labels.value,
      y: labels.value,
      colorscale: divergingScale(hm.neg, hm.mid, hm.pos),
      zmin: -1,
      zmax: 1,
      text: data.text,
      texttemplate: '%{text}',
      textfont: {
        size: Math.max(6, Math.min(10, (narrow.value ? 190 : 260) / Math.max(1, vars.value.length))),
        color: '#111827',
      },
      xgap: 2,
      ygap: 2,
      customdata: data.ps,
      colorbar: { thickness: 9, len: 0.7, outlinewidth: 0, tickfont: { size: 9 } },
      hovertemplate: '%{y} × %{x}<br>偏相关 r = %{z:.3f}<br>p = %{customdata}<extra></extra>',
    },
  ]
})

const layout = computed(() =>
  baseLayout({
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
  const m = matrix.value
  if (!m) return t('样本量不足或控制变量共线，无法计算偏相关')
  const names = controlCols.value.map((c) => settings.columnLabel(c.name))
  const base = names.length
    ? t('控制：{list}', { list: names.join('、') })
    : t('未选择控制变量（等同普通相关）')
  return `${base} · n = ${fmtInt(m.n)} · df = ${m.df}`
})

const vifCols = computed<Column[]>(() => ds.nums.slice(0, 20))

const vif = computed(() =>
  vifStats(vifCols.value.map((c) => c.num || [])),
)

const vifRows = computed(() => {
  const res = vif.value
  if (!res) return []
  return vifCols.value
    .map((c, i) => {
      const item = res.items[i]
      const level = item ? (item.vif >= 10 ? 'bad' : item.vif >= 5 ? 'warn' : 'good') : 'none'
      return {
        name: c.name,
        label: settings.columnLabel(c.name),
        vif: item ? item.vif : null,
        r2: item ? item.r2 : null,
        level,
        levelLabel:
          level === 'bad'
            ? t('高共线')
            : level === 'warn'
              ? t('需关注')
              : level === 'good'
                ? t('正常')
                : t('无法计算'),
      }
    })
    .sort((a, b) => (b.vif ?? -1) - (a.vif ?? -1))
})

const vifNote = computed(() =>
  vif.value ? t('完整行 n = {n}', { n: fmtInt(vif.value.n) }) : t('样本量不足，无法计算 VIF'),
)
</script>

<template>
  <section class="panel panel-fit partial-panel">
    <div class="controls">
      <ChipPicker
        v-model="controls"
        :label="$t('控制变量（可多选，最多 5 个）')"
        :options="ds.nums.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
        :max="5"
        :empty-label="$t('未选择（等同普通相关）')"
      />
      <label class="chk"><input v-model="mask" type="checkbox" /> {{ $t('只显示下三角') }}</label>
      <label class="chk"><input v-model="annot" type="checkbox" /> {{ $t('标注数值') }}</label>
    </div>

    <div class="grid2 partial-grid">
      <div class="card chart-card">
        <div class="cardhead">
          <h3>{{ $t('偏相关矩阵') }}</h3>
          <span class="hint">{{ note }}</span>
        </div>
        <PlotlyChart
          v-if="matrix && vars.length >= 2"
          chart-id="partial"
          :traces="traces"
          :layout="layout"
          :height="520"
          :fill="wide"
        />
        <div v-else class="empty-chart">
          {{ $t('选择更少的控制变量，或使用至少 2 个数值列与足够的完整行') }}
        </div>
      </div>

      <div class="card vif-card">
        <div class="cardhead">
          <h3>{{ $t('共线性（VIF）') }}</h3>
          <span class="hint">{{ vifNote }}</span>
        </div>
        <div v-if="vifRows.length" class="vif-list">
          <div v-for="v in vifRows" :key="v.name" class="vif-row">
            <span class="vif-name" :title="v.name">{{ v.label }}</span>
            <span class="vif-val">{{ v.vif === null ? '—' : v.vif.toFixed(1) }}</span>
            <span class="vif-badge" :class="v.level">{{ v.levelLabel }}</span>
          </div>
        </div>
        <p v-else class="hint">{{ $t('数值列不足 2 个，无法计算 VIF。') }}</p>
        <p class="hint vif-tip">
          {{ $t('VIF < 5 正常 · 5–10 需关注 · >10 高共线。VIF 表示该列能被其余数值列解释的程度，越高说明信息越重叠。') }}
        </p>
      </div>
    </div>
  </section>
</template>
