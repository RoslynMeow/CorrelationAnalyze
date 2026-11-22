<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import PlotlyChart from '@/components/PlotlyChart.vue'
import SelectField from '@/components/SelectField.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import { baseLayout } from '@/lib/chartTheme'
import { groupLabels, pickGroup, preferredNums } from '@/lib/infer'
import { hexA, isNull } from '@/lib/format'
import { useNarrow } from '@/composables/useNarrow'

const ds = useDatasetStore()
const narrow = useNarrow()

const groupName = ref(pickGroup(ds.groups))
const vars = ref(preferredNums(ds.nums, 6))
const showPts = ref(false)

const chartH = computed(() => (narrow.value ? 215 : 245))

const charts = computed(() => {
  const gcol = ds.column(groupName.value)
  if (!gcol) return []
  const order = groupLabels(gcol)
  const labels = gcol.raw.map((v) => (isNull(v) ? '(缺失)' : String(v).trim()))
  const counts: Record<string, number> = {}
  labels.forEach((l) => {
    counts[l] = (counts[l] || 0) + 1
  })

  return vars.value.map((name) => {
    const col = ds.column(name)
    const traces = order.map((lab, gi) => {
      const ys: number[] = []
      for (let j = 0; j < ds.n; j++) {
        if (labels[j] !== lab) continue
        const y = col?.num?.[j]
        if (y !== null && y !== undefined && Number.isFinite(y)) ys.push(y)
      }
      const color = [
        '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494',
        '#b3b3b3', '#80b1d3', '#fb8072', '#bebada', '#ffffb3', '#1b9e77', '#d95f02',
      ][gi % 14]
      const showAll = ys.length <= 5 || (showPts.value && ys.length <= 300)
      return {
        type: 'box',
        y: ys,
        name: `${lab} (n=${counts[lab] || 0})`,
        marker: { color, size: 3.5, opacity: 0.65 },
        line: { color, width: 1.5 },
        fillcolor: hexA(color, 0.2),
        boxpoints: showAll ? 'all' : 'outliers',
        jitter: 0.35,
        pointpos: 0,
        width: 0.62,
        hovertemplate: `${lab}<br>%{y:.4~f}<extra></extra>`,
      }
    })
    return {
      name,
      traces,
      layout: baseLayout({
        height: chartH.value,
        showlegend: false,
        margin: { l: 52, r: 12, t: 10, b: 42 },
        xaxis: {
          title: { text: '' },
          tickfont: { size: 10 },
          tickangle: order.length > 4 ? -25 : 0,
        },
        yaxis: { title: { text: '', font: { size: 10 } }, tickfont: { size: 10 } },
      }),
    }
  })
})
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField v-model="groupName" label="分组列" :options="ds.groups.map((c) => c.name)" />
      <label class="chk"><input v-model="showPts" type="checkbox" /> 叠加散点</label>
      <div class="chipfield">
        <span class="chipfield-label">对比数值变量（可多选）</span>
        <ChipGroup v-model="vars" :options="ds.nums.map((c) => c.name)" />
      </div>
    </div>

    <div v-if="!groupName" class="card hint">
      该数据集没有适合分组的列（需要 2–40 个不同取值）。
    </div>
    <div v-else-if="!vars.length" class="card hint">请至少勾选一个数值变量。</div>
    <div v-else class="grid-charts">
      <div v-for="c in charts" :key="c.name" class="card mini">
        <div class="minihead">
          <span class="mtitle" :title="c.name">{{ c.name }}</span>
          <span class="mmuted">按 {{ groupName }}</span>
        </div>
        <PlotlyChart :traces="c.traces" :layout="c.layout" :height="chartH" />
      </div>
    </div>
  </section>
</template>
