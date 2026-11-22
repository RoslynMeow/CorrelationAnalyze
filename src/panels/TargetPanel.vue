<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDatasetStore } from '@/stores/dataset'
import { useViewStore } from '@/stores/view'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { fmtInt, fmtP, shortName } from '@/lib/format'
import { starsForP } from '@/lib/stats'
import { useNarrow } from '@/composables/useNarrow'
import { useViewportHeight } from '@/composables/useViewportHeight'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'
import type { AssocMethod } from '@/types'

const ds = useDatasetStore()
const view = useViewStore()
const settings = useSettingsStore()
const narrow = useNarrow()
const vh = useViewportHeight()

const { targetCol: targetName, targetMethod: method } = storeToRefs(view)

const target = computed(() => ds.column(targetName.value))
const list = computed(() =>
  target.value ? ds.assocWithTarget(target.value, method.value as AssocMethod) : [],
)
const ordered = computed(() => [...list.value].reverse())

const chartH = computed(() => {
  const needed = list.value.length * (narrow.value ? 26 : 28) + (narrow.value ? 90 : 110)
  const max = vh.value - (narrow.value ? 230 : 320)
  return Math.max(narrow.value ? 280 : 320, Math.min(needed, Math.max(300, max)))
})

const traces = computed(() => [
  {
    type: 'bar',
    orientation: 'h',
    x: ordered.value.map((d) => d.strength),
    y: ordered.value.map((d) =>
      narrow.value ? shortName(settings.columnLabel(d.name), 16) : settings.columnLabel(d.name),
    ),
    marker: { color: ordered.value.map((d) => settings.assocColor(d.signed)) },
    text: ordered.value.map((d) => `${d.strength.toFixed(2)}${starsForP(d.q)} ${d.type}`),
    textposition: 'outside',
    cliponaxis: false,
    bargap: 0.32,
    customdata: ordered.value.map((d) => [
      settings.columnLabel(d.name),
      d.type,
      d.signed === null ? '—' : d.signed.toFixed(2),
      d.n,
      fmtP(d.p),
      fmtP(d.q),
      d.ci ? `${d.ci[0].toFixed(2)} ~ ${d.ci[1].toFixed(2)}` : '—',
    ]),
    hovertemplate: t(
      '<b>%{customdata[0]}</b><br>关联强度 %{x:.3f}（%{customdata[1]}）<br>有符号值 %{customdata[2]} · n=%{customdata[3]}<br>p = %{customdata[4]} · FDR q = %{customdata[5]}<br>95% CI %{customdata[6]}<extra></extra>',
    ),
  },
])

const layout = computed(() =>
  baseLayout({
    height: chartH.value,
    margin: {
      l: narrow.value ? 8 : 170,
      r: narrow.value ? 40 : 55,
      t: 26,
      b: 50,
    },
    xaxis: { title: { text: t('关联强度') }, range: [0, 1.05] },
    yaxis: { tickfont: { size: narrow.value ? 9.5 : 11 }, automargin: true },
    showlegend: false,
  }),
)

const stats = computed(() => {
  if (!list.value.length) return []
  const strongest = list.value[0]
  return [
    {
      k: t('目标类型'),
      v: target.value?.type === 'number' ? t('数值目标') : t('类别目标'),
    },
    { k: t('参与分析'), v: t('{n} 个变量', { n: list.value.length }) },
    {
      k: t('关联最强'),
      v: `${settings.columnLabel(strongest.name)}（${strongest.strength.toFixed(2)} ${strongest.type}）`,
    },
    {
      k: t('强度 ≥ 0.5'),
      v: t('{n} 个', { n: list.value.filter((d) => d.strength >= 0.5).length }),
    },
    {
      k: t('显著（FDR < 0.05）'),
      v: t('{n} 个', { n: list.value.filter((d) => (d.q ?? 1) < 0.05).length }),
    },
    { k: t('完整样本'), v: fmtInt(strongest.n) },
  ]
})
</script>

<template>
  <section class="panel panel-fit">
    <div class="controls">
      <SelectField
        v-model="targetName"
        :label="$t('目标变量')"
        :options="ds.targets.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
      />
      <SelectField
        v-model="method"
        :label="$t('数值相关方法')"
        :options="[
          { value: 'pearson', label: $t('Pearson') },
          { value: 'spearman', label: $t('Spearman') },
        ]"
      />
      <span class="hint hint-wide">
        {{ $t('r = Pearson · ρ = Spearman · η = 相关比（数值×类别） · V = Cramér\'s V（类别×类别）｜ 绿=正相关，红=负相关，蓝=无方向｜ * q<0.05 · ** q<0.01 · *** q<0.001（FDR 校正）') }}
      </span>
    </div>

    <div class="card chart-card">
      <PlotlyChart
        v-if="list.length"
        chart-id="target"
        :traces="traces"
        :layout="layout"
        :height="chartH"
        :fill="!narrow"
      />
      <div v-else class="empty-chart">{{ $t('目标变量与其他列没有足够的完整数据') }}</div>
    </div>

    <div class="statstrip">
      <div v-for="s in stats" :key="s.k" class="stat"><span>{{ s.k }}</span><b>{{ s.v }}</b></div>
    </div>
  </section>
</template>
