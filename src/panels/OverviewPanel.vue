<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import KpiCards from '@/components/KpiCards.vue'
import PlotlyChart from '@/components/PlotlyChart.vue'
import { baseLayout } from '@/lib/chartTheme'
import { fmtInt, shortName } from '@/lib/format'
import { useNarrow } from '@/composables/useNarrow'
import { useSettingsStore } from '@/stores/settings'

const ds = useDatasetStore()
const settings = useSettingsStore()
const narrow = useNarrow()

onMounted(() => {
  void ds.ensurePairs('pearson')
})

const pairs = computed(() => ds.cachedPairs('pearson'))
const chartH = computed(() => (narrow.value ? 380 : 430))

const kpis = computed(() => {
  const d = ds.dataset
  if (!d) return []
  const cells = d.n * d.columns.length
  const miss = d.columns.reduce((s, c) => s + c.missing, 0)
  return [
    { label: '数据行数', value: fmtInt(d.n), sub: `${fmtInt(cells)} 个单元格` },
    { label: '变量列数', value: fmtInt(d.columns.length), sub: `数值 ${ds.nums.length} · 类别 ${ds.cats.length}` },
    {
      label: '缺失单元格',
      value: fmtInt(miss),
      sub: `${cells ? ((miss / cells) * 100).toFixed(2) : 0}%`,
    },
    { label: '关联变量对', value: fmtInt(pairs.value.length), sub: '已计算全部组合' },
    {
      label: '强关联对',
      value: fmtInt(pairs.value.filter((p) => p.strength >= 0.6).length),
      sub: '强度 ≥ 0.6',
    },
  ]
})

const top = computed(() => pairs.value.slice(0, 10).reverse())
const note = computed(() => {
  const cols = ds.assocs.length
  return `${cols} 个变量 · ${pairs.value.length} 对组合${cols > 40 ? '（仅前 40 个变量）' : ''}`
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
    hovertemplate:
      '<b>%{customdata[0]} ↔ %{customdata[1]}</b><br>关联强度 %{x:.3f}（%{customdata[2]}）<br>有符号值 %{customdata[3]} · n=%{customdata[4]}<extra></extra>',
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
    xaxis: { title: { text: '关联强度 |r| / V / η' }, range: [0, 1.05] },
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
          <h3>关联强度 Top 10</h3>
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
          数据中可分析的变量不足（至少需要 2 个数值或类别列）
        </div>
      </div>
      <div class="card">
        <div class="cardhead"><h3>快速解读</h3></div>
        <div v-if="pairs.length" class="summary">
          <h4>数据规模</h4>
          <div>
            {{ fmtInt(ds.n) }} 行 × {{ ds.dataset?.columns.length }} 列 · 数值
            {{ ds.nums.length }} 列 · 类别 {{ ds.cats.length }} 列
          </div>
          <h4>最强关联</h4>
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
          <h4>关联强度分布</h4>
          <div>
            强关联（≥0.6）<b>{{ strongCount }}</b> 组 · 中等（0.4–0.6）<b>{{ midCount }}</b> 组 ·
            弱关联 <b>{{ pairs.length - strongCount - midCount }}</b> 组
          </div>
          <h4>提示</h4>
          <div class="hint">
            r / ρ 反映线性或单调关系（−1 ~ 1）；V / η 只表示关联强度（0 ~ 1）。
            相关性不等于因果，样本量 {{ fmtInt(ds.n) }} 时请结合业务判断。
          </div>
        </div>
        <p v-else class="hint">没有可计算的变量对。</p>
      </div>
    </div>
  </section>
</template>
