<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import { baseLayout } from '@/lib/chartTheme'
import { pickTarget } from '@/lib/infer'
import { fmtInt, shortName } from '@/lib/format'
import { useNarrow } from '@/composables/useNarrow'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'
import type { AssocMethod } from '@/types'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()

const targetName = ref(pickTarget(ds.targets))
const method = ref('pearson')

const target = computed(() => ds.column(targetName.value))
const list = computed(() =>
  target.value ? ds.assocWithTarget(target.value, method.value as AssocMethod) : [],
)
const ordered = computed(() => [...list.value].reverse())

const chartH = computed(() =>
  Math.max(narrow.value ? 320 : 360, list.value.length * (narrow.value ? 26 : 28) + (narrow.value ? 90 : 110)),
)

const traces = computed(() => [
  {
    type: 'bar',
    orientation: 'h',
    x: ordered.value.map((d) => d.strength),
    y: ordered.value.map((d) =>
      narrow.value ? shortName(settings.columnLabel(d.name), 16) : settings.columnLabel(d.name),
    ),
    marker: { color: ordered.value.map((d) => settings.assocColor(d.signed)) },
    text: ordered.value.map((d) => `${d.strength.toFixed(2)} ${d.type}`),
    textposition: 'outside',
    cliponaxis: false,
    bargap: 0.32,
    customdata: ordered.value.map((d) => [
      settings.columnLabel(d.name),
      d.type,
      d.signed === null ? '—' : d.signed.toFixed(2),
      d.n,
    ]),
    hovertemplate: t(
      '<b>%{customdata[0]}</b><br>关联强度 %{x:.3f}（%{customdata[1]}）<br>有符号值 %{customdata[2]} · n=%{customdata[3]}<extra></extra>',
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
    { k: t('完整样本'), v: fmtInt(strongest.n) },
  ]
})
</script>

<template>
  <section class="panel">
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
        {{ $t('r = Pearson · ρ = Spearman · η = 相关比（数值×类别） · V = Cramér\'s V（类别×类别）｜ 绿=正相关，红=负相关，蓝=无方向') }}
      </span>
    </div>

    <div class="card" style="padding: 8px 8px 0">
      <PlotlyChart
        v-if="list.length"
        chart-id="target"
        :traces="traces"
        :layout="layout"
        :height="chartH"
      />
      <div v-else class="empty-chart">{{ $t('目标变量与其他列没有足够的完整数据') }}</div>
    </div>

    <div class="statstrip">
      <div v-for="s in stats" :key="s.k" class="stat"><span>{{ s.k }}</span><b>{{ s.v }}</b></div>
    </div>
  </section>
</template>
