<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import { useSettingsStore } from '@/stores/settings'
import SelectField from '@/components/SelectField.vue'
import { downloadCsv, fmt, fmtInt, isNull, toNum } from '@/lib/format'
import { toast } from '@/composables/useToast'
import { t } from '@/i18n'

const ds = useDatasetStore()
const settings = useSettingsStore()
const query = ref('')
const pageSize = ref('50')
const page = ref(0)

const filtered = computed(() => {
  const rows = ds.dataset?.rows || []
  const q = query.value.trim().toLowerCase()
  const idx: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (!q || rows[i].some((v) => String(v).toLowerCase().includes(q))) idx.push(i)
  }
  return idx
})

const size = computed(() => Number(pageSize.value) || 50)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)))

watch([query, pageSize], () => {
  page.value = 0
})
watch(pages, (p) => {
  if (page.value >= p) page.value = p - 1
})

const pageIdx = computed(() => filtered.value.slice(page.value * size.value, page.value * size.value + size.value))

const visibleRows = computed(() => {
  const d = ds.dataset
  if (!d) return []
  return pageIdx.value.map((i) =>
    d.rows[i].map((v, ci) => {
      const c = d.columns[ci]
      if (isNull(v)) return { text: '—', empty: true }
      const mapped = c ? settings.valueLabel(c.name, v) : v
      if (c && mapped !== v) return { text: mapped, empty: false }
      if (c?.type === 'number') {
        const num = toNum(v)
        return { text: num === null ? v : fmt(num, 4), empty: false }
      }
      return { text: v, empty: false }
    }),
  )
})

const pageInfo = computed(() => {
  const q = query.value.trim()
  const total = filtered.value.length
  return (
    t('共 {total} 行', { total: fmtInt(total) }) +
    (q ? t('（已按「{q}」筛选，原 {n} 行）', { q, n: fmtInt(ds.n) }) : '')
  )
})

const typeLabel = (tType: string): string =>
  tType === 'number' ? t('数值') : tType === 'date' ? t('日期') : t('类别')

const profile = computed(() => {
  const d = ds.dataset
  if (!d) return []
  return d.columns.map((c) => {
    let summary = ''
    if (c.type === 'number') {
      summary = t('min {min} · max {max} · 均值 {mean}', {
        min: fmt(c.min),
        max: fmt(c.max),
        mean: fmt(c.mean),
      })
    } else if (c.type === 'date') {
      const t = (c.num || []).filter((v): v is number => v !== null)
      summary = t.length
        ? `${new Date(Math.min(...t)).toLocaleDateString('zh-CN')} → ${new Date(Math.max(...t)).toLocaleDateString('zh-CN')}`
        : '—'
    } else {
      const counts: Record<string, number> = Object.create(null)
      for (const v of c.raw) {
        if (isNull(v)) continue
        const k = String(v).trim()
        counts[k] = (counts[k] || 0) + 1
      }
      summary =
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, v]) => `${settings.valueLabel(c.name, k)}(${v})`)
          .join('、') || '—'
    }
    return {
      name: c.name,
      displayName: settings.columnLabel(c.name),
      type: c.type,
      label: typeLabel(c.type),
      nonNull: c.total - c.missing,
      missing: c.missing,
      unique: c.uniqueCount,
      summary,
    }
  })
})

function exportCsv(): void {
  const d = ds.dataset
  if (!d) return
  const rows = filtered.value.map((i) => d.rows[i])
  downloadCsv([d.headers, ...rows], 'export.csv')
  toast(t('已导出 {n} 行', { n: fmtInt(rows.length) }))
}
</script>

<template>
  <section class="panel">
    <div class="controls">
      <label class="field" style="flex: 1 1 260px">
        <span>{{ $t('搜索') }}</span>
        <input v-model="query" type="text" :placeholder="$t('在所有列中搜索关键字…')" />
      </label>
      <SelectField
        v-model="pageSize"
        :label="$t('每页行数')"
        :options="['25', '50', '100', '200']"
      />
      <div class="sep"></div>
      <button class="btn" type="button" @click="exportCsv">{{ $t('导出当前数据 CSV') }}</button>
    </div>

    <div class="card" style="padding: 0; overflow: hidden">
      <div class="tablewrap responsive">
        <table>
          <thead>
            <tr>
              <th v-for="c in ds.dataset?.columns || []" :key="c.name">
                {{ settings.columnLabel(c.name) }}<span class="badge" :class="c.type">{{ typeLabel(c.type) }}</span>
                <span v-if="c.missing" class="missdot" :title="$t('{n} 个缺失', { n: c.missing })">●</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in visibleRows" :key="ri">
              <td
                v-for="(cell, ci) in row"
                :key="ci"
                :class="{ null: cell.empty }"
                :data-label="settings.columnLabel(ds.dataset?.columns[ci]?.name || '')"
              >
                {{ cell.text }}
              </td>
            </tr>
            <tr v-if="!visibleRows.length">
              <td
                :colspan="ds.dataset?.columns.length || 1"
                class="null"
                style="text-align: center; padding: 24px"
              >
                {{ $t('没有匹配的行') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pager">
        <div class="pinfo">{{ pageInfo }}</div>
        <div class="pbtns">
          <button class="btn" type="button" :disabled="page <= 0" @click="page--">{{ $t('上一页') }}</button>
          <span class="pinfo">{{ page + 1 }} / {{ pages }}</span>
          <button class="btn" type="button" :disabled="page >= pages - 1" @click="page++">
            {{ $t('下一页') }}
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="cardhead">
        <h3>{{ $t('列画像') }}</h3>
        <span class="hint">{{ $t('类型由数据自动推断') }}</span>
      </div>
      <div class="tablewrap responsive compact">
        <table>
          <thead>
            <tr>
              <th>{{ $t('列名') }}</th>
              <th>{{ $t('类型') }}</th>
              <th>{{ $t('非空') }}</th>
              <th>{{ $t('缺失') }}</th>
              <th>{{ $t('唯一值') }}</th>
              <th>{{ $t('统计 / 高频值') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in profile" :key="p.name">
              <td :data-label="$t('列名')"><b>{{ p.displayName }}</b></td>
              <td :data-label="$t('类型')"><span class="badge" :class="p.type">{{ p.label }}</span></td>
              <td :data-label="$t('非空')">{{ fmtInt(p.nonNull) }}</td>
              <td :data-label="$t('缺失')">
                <span v-if="p.missing" style="color: #d97706">
                  {{ fmtInt(p.missing) }} ({{ ((p.missing / ds.n) * 100).toFixed(1) }}%)
                </span>
                <span v-else>0</span>
              </td>
              <td :data-label="$t('唯一值')">{{ fmtInt(p.unique) }}</td>
              <td
                :data-label="$t('统计 / 高频值')"
                style="white-space: normal; max-width: 420px"
              >
                {{ p.summary }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
