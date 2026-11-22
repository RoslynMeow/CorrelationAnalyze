<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import KpiCards from '@/components/KpiCards.vue'
import PlotlyChart from '@/components/PlotlyChart.vue'
import { baseLayout } from '@/lib/chartTheme'
import { fmtInt, shortName } from '@/lib/format'
import { useNarrow } from '@/composables/useNarrow'
import { useViewportHeight } from '@/composables/useViewportHeight'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()
const vh = useViewportHeight()

onMounted(() => {
  void ds.ensurePairs('pearson')
})

const pairs = computed(() => ds.cachedPairs('pearson'))
const chartH = computed(() =>
  Math.max(
    narrow.value ? 280 : 320,
    Math.min(narrow.value ? 360 : 460, vh.value - (narrow.value ? 250 : 300)),
  ),
)

const kpis = computed(() => {
  const d = ds.dataset
  if (!d) return []
  const cells = d.n * d.columns.length
  const miss = d.columns.reduce((s, c) => s + c.missing, 0)
  return [
    { label: t('数据行数'), value: fmtInt(d.n), sub: t('{n} 个单元格', { n: fmtInt(cells) }) },
    {
      label: t('变量列数'),
      value: fmtInt(d.columns.length),
      sub: t('数值 {num} · 类别 {cat}', { num: ds.nums.length, cat: ds.cats.length }),
    },
    {
      label: t('缺失单元格'),
      value: fmtInt(miss),
      sub: `${cells ? ((miss / cells) * 100).toFixed(2) : 0}%`,
    },
    { label: t('关联变量对'), value: fmtInt(pairs.value.length), sub: t('已计算全部组合') },
    {
      label: t('强关联对'),
      value: fmtInt(pairs.value.filter((p) => p.strength >= 0.6).length),
      sub: t('强度 ≥ 0.6'),
    },
  ]
})

const top = computed(() => pairs.value.slice(0, 10).reverse())
const note = computed(() => {
  const cols = ds.assocs.length
  return t('{cols} 个变量 · {pairs} 对组合{extra}', {
    cols,
    pairs: pairs.value.length,
    extra: cols > 40 ? t('（仅前 40 个变量）') : '',
  })
})

const traces = computed(() => [
  {
    type: 'bar',
    orientation: 'h',
    x: top.value.map((p) => p.strength),
    y: top.value.map((p) =>
      narrow.value
        ? `${shortName(settings.columnLabel(p.a), 11)} ↔ ${shortName(settings.columnLabel(p.b), 11)}`
        : `${settings.columnLabel(p.a)} ↔ ${settings.columnLabel(p.b)}`,
    ),
    marker: { color: top.value.map((p) => settings.assocColor(p.signed)), line: { width: 0 } },
    text: top.value.map((p) => `${p.strength.toFixed(2)} ${p.type}`),
    textposition: 'outside',
    cliponaxis: false,
    customdata: top.value.map((p) => [
      settings.columnLabel(p.a),
      settings.columnLabel(p.b),
      p.type,
      p.signed === null ? '—' : p.signed.toFixed(2),
      p.n,
    ]),
    hovertemplate: t(
      '<b>%{customdata[0]} ↔ %{customdata[1]}</b><br>关联强度 %{x:.3f}（%{customdata[2]}）<br>有符号值 %{customdata[3]} · n=%{customdata[4]}<extra></extra>',
    ),
  },
])

const layout = computed(() =>
  baseLayout({
    height: chartH.value,
    margin: {
      l: narrow.value ? 8 : 190,
      r: narrow.value ? 40 : 50,
      t: 14,
      b: 46,
    },
    xaxis: { title: { text: t('关联强度 |r| / V / η') }, range: [0, 1.05] },
    yaxis: { tickfont: { size: narrow.value ? 9.5 : 10.5 }, automargin: true },
    showlegend: false,
  }),
)

const strongCount = computed(() => pairs.value.filter((p) => p.strength >= 0.6).length)
const midCount = computed(
  () => pairs.value.filter((p) => p.strength >= 0.4 && p.strength < 0.6).length,
)
const top3 = computed(() => pairs.value.slice(0, 3))
</script>

<template>
  <section class="panel">
    <KpiCards :items="kpis" />
    <div class="grid2">
      <div class="card">
        <div class="cardhead">
          <h3>{{ $t('关联强度 Top 10') }}</h3>
          <span class="hint">{{ note }}</span>
        </div>
        <PlotlyChart
          v-if="pairs.length"
          chart-id="overview"
          :traces="traces"
          :layout="layout"
          :height="chartH"
        />
        <div v-else class="empty-chart">
          {{ $t('数据中可分析的变量不足（至少需要 2 个数值或类别列）') }}
        </div>
      </div>
      <div class="card">
        <div class="cardhead"><h3>{{ $t('快速解读') }}</h3></div>
        <div v-if="pairs.length" class="summary">
          <h4>{{ $t('数据规模') }}</h4>
          <div>
            {{
              $t('{rows} 行 × {cols} 列 · 数值 {num} 列 · 类别 {cat} 列', {
                rows: fmtInt(ds.n),
                cols: ds.dataset?.columns.length ?? 0,
                num: ds.nums.length,
                cat: ds.cats.length,
              })
            }}
          </div>
          <h4>{{ $t('最强关联') }}</h4>
          <ul>
            <li v-for="p in top3" :key="p.a + p.b">
              <b>{{ settings.columnLabel(p.a) }}</b> ↔
              <b>{{ settings.columnLabel(p.b) }}</b>：
              <span :class="p.signed === null ? '' : p.signed >= 0 ? 'pos' : 'neg'">
                {{ p.strength.toFixed(2) }}
              </span>
              <span class="sumtag">{{ p.type }}</span>
            </li>
          </ul>
          <h4>{{ $t('关联强度分布') }}</h4>
          <div>
            {{
              $t('强关联（≥0.6）{strong} 组 · 中等（0.4–0.6）{mid} 组 · 弱关联 {weak} 组', {
                strong: strongCount,
                mid: midCount,
                weak: pairs.length - strongCount - midCount,
              })
            }}
          </div>
          <h4>{{ $t('提示') }}</h4>
          <div class="hint">
            {{
              $t('r / ρ 反映线性或单调关系（−1 ~ 1）；V / η 只表示关联强度（0 ~ 1）。相关性不等于因果，样本量 {n} 时请结合业务判断。', {
                n: fmtInt(ds.n),
              })
            }}
          </div>
        </div>
        <p v-else class="hint">{{ $t('没有可计算的变量对。') }}</p>
      </div>
    </div>
  </section>
</template>
