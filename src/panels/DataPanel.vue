<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import { useSettingsStore } from '@/stores/settings'
import { downloadCsv, fmt, fmtInt, isNull, toNum } from '@/lib/format'
import { toast } from '@/composables/useToast'
import { t } from '@/i18n'

const ds = useDatasetStore()
const settings = useSettingsStore()
const searchInput = ref('')
const query = ref('')
const pageSize = ref('50')
const page = ref(0)
let searchTimer: ReturnType<typeof setTimeout> | undefined

/** 分块搜索状态：null 表示无筛选 */
const matched = ref<number[] | null>(null)
const scanning = ref(false)
const progress = ref(0)
let scanToken = 0
let scanRaf = 0

watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    query.value = v
  }, 180)
})

function stopScan(): void {
  scanToken++
  if (scanRaf) cancelAnimationFrame(scanRaf)
  scanRaf = 0
  scanning.value = false
}

/** 每帧最多扫描约 8ms，避免 10 万行时阻塞输入 */
function runSearch(): void {
  stopScan()
  const d = ds.dataset
  const q = query.value.trim().toLowerCase()
  page.value = 0
  progress.value = 0
  if (!d || !q) {
    matched.value = null
    return
  }

  // 列显示名 / 原始列名命中时，直接显示全部行
  const columnHit = d.columns.some(
    (c) =>
      c.name.toLowerCase().includes(q) || settings.columnLabel(c.name).toLowerCase().includes(q),
  )
  if (columnHit) {
    matched.value = d.rows.map((_, i) => i)
    progress.value = 1
    return
  }

  const rows = d.rows
  const token = ++scanToken
  const idx: number[] = []
  matched.value = []
  scanning.value = true
  let i = 0

  const step = (): void => {
    if (token !== scanToken) return
    const start = performance.now()
    let n = 0
    while (i < rows.length && (n < 500 || performance.now() - start < 8)) {
      const hit = rows[i].some((v, ci) => {
        if (String(v).toLowerCase().includes(q)) return true
        const c = d.columns[ci]
        return c ? settings.valueLabel(c.name, v).toLowerCase().includes(q) : false
      })
      if (hit) idx.push(i)
      i++
      n++
    }
    progress.value = rows.length ? i / rows.length : 1
    if (i < rows.length) {
      scanRaf = requestAnimationFrame(step)
    } else {
      scanRaf = 0
      scanning.value = false
      matched.value = idx
    }
  }

  if (typeof requestAnimationFrame === 'undefined') {
    while (i < rows.length) {
      const hit = rows[i].some((v, ci) => {
        if (String(v).toLowerCase().includes(q)) return true
        const c = d.columns[ci]
        return c ? settings.valueLabel(c.name, v).toLowerCase().includes(q) : false
      })
      if (hit) idx.push(i)
      i++
    }
    scanning.value = false
    progress.value = 1
    matched.value = idx
    return
  }
  scanRaf = requestAnimationFrame(step)
}

watch(query, runSearch, { flush: 'post' })

watch(() => ds.datasetId, () => {
  stopScan()
  searchInput.value = ''
  query.value = ''
  matched.value = null
  progress.value = 0
  page.value = 0
  closeProfile()
})

const allRows = computed(() => (ds.dataset ? ds.dataset.rows.map((_, i) => i) : []))

const filtered = computed(() => {
  if (!query.value.trim()) return allRows.value
  return matched.value ?? []
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
  if (scanning.value) {
    return t('正在搜索 {p}%（原 {n} 行）', {
      p: Math.round(progress.value * 100),
      n: fmtInt(ds.n),
    })
  }
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
  if (!d || scanning.value) return
  const rows = filtered.value.map((i) => d.rows[i])
  downloadCsv([d.headers, ...rows], 'export.csv')
  toast(t('已导出 {n} 行', { n: fmtInt(rows.length) }))
}

/* ---------------- 表头列画像浮窗 ---------------- */

const profileMap = computed(() => new Map(profile.value.map((p) => [p.name, p])))
const activeName = ref('')
const activeData = computed(() => (activeName.value ? profileMap.value.get(activeName.value) : undefined))
const activeCol = computed(() => (activeName.value ? ds.column(activeName.value) : undefined))
const popStyle = ref<Record<string, string>>({})
let closeTimer: ReturnType<typeof setTimeout> | undefined

const extraStats = computed(() => {
  const c = activeCol.value
  if (!c) return []
  if (c.type === 'number') {
    return [
      { k: t('均值'), v: fmt(c.mean) },
      { k: t('中位数'), v: fmt(c.median) },
      { k: t('标准差'), v: fmt(c.sd) },
      { k: t('最小值'), v: fmt(c.min) },
      { k: t('最大值'), v: fmt(c.max) },
    ]
  }
  if (c.type === 'date') {
    const ts = (c.num || []).filter((v): v is number => v !== null)
    if (!ts.length) return []
    return [
      { k: t('最早'), v: new Date(Math.min(...ts)).toLocaleDateString('zh-CN') },
      { k: t('最晚'), v: new Date(Math.max(...ts)).toLocaleDateString('zh-CN') },
    ]
  }
  return []
})

const isCategoryCol = computed(() => activeCol.value?.type === 'category')

function cancelClose(): void {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = undefined
}

function closeProfile(): void {
  activeName.value = ''
  cancelClose()
}

function openProfile(name: string, e?: Event): void {
  cancelClose()
  activeName.value = name
  const el = e?.currentTarget as HTMLElement | undefined
  if (!el) return
  const rect = el.getBoundingClientRect()
  const width = 288
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  popStyle.value = { top: `${rect.bottom + 8}px`, left: `${left}px` }
}

function scheduleClose(): void {
  cancelClose()
  closeTimer = setTimeout(() => {
    activeName.value = ''
  }, 160)
}

function onDocClick(e: MouseEvent): void {
  if (!activeName.value) return
  const target = e.target as HTMLElement | null
  if (!target?.closest('.colpop') && !target?.closest('.th-name')) closeProfile()
}

function onEscKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && activeName.value) closeProfile()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onEscKey)
  window.addEventListener('scroll', closeProfile, true)
  window.addEventListener('resize', closeProfile)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onEscKey)
  window.removeEventListener('scroll', closeProfile, true)
  window.removeEventListener('resize', closeProfile)
  if (searchTimer) clearTimeout(searchTimer)
  stopScan()
  cancelClose()
})
onDeactivated(() => {
  closeProfile()
})
</script>

<template>
  <section class="panel panel-fit">
    <div class="controls data-toolbar">
      <label class="searchbox">
        <svg
          viewBox="0 0 16 16"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        >
          <circle cx="7" cy="7" r="4.2" />
          <path d="m10.2 10.2 3 3" />
        </svg>
        <input
          v-model="searchInput"
          type="search"
          :placeholder="$t('搜索所有列…')"
          :aria-label="$t('搜索')"
        />
      </label>
      <select v-model="pageSize" class="compact-select" :aria-label="$t('每页行数')">
        <option v-for="n in ['25', '50', '100', '200']" :key="n" :value="n">
          {{ $t('{n} 行/页', { n }) }}
        </option>
      </select>
      <button class="btn export-btn" type="button" :disabled="scanning" @click="exportCsv" :title="$t('导出当前数据 CSV')">
        <svg
          viewBox="0 0 16 16"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 2.5v7" />
          <path d="m5 6.5 3 3 3-3" />
          <path d="M3.5 12.5v1h9v-1" />
        </svg>
        <span>{{ $t('导出 CSV') }}</span>
      </button>
    </div>

    <div class="card data-card">
      <div class="tablewrap responsive" @scroll.passive="closeProfile">
        <table>
          <thead>
            <tr>
              <th v-for="c in ds.dataset?.columns || []" :key="c.name">
                <button
                  class="th-name"
                  type="button"
                  @mouseenter="openProfile(c.name, $event)"
                  @mouseleave="scheduleClose"
                  @click.stop="openProfile(c.name, $event)"
                >
                  {{ settings.columnLabel(c.name) }}
                </button>
                <span class="badge" :class="c.type">{{ typeLabel(c.type) }}</span>
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
                {{ scanning ? $t('正在搜索…') : $t('没有匹配的行') }}
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

    <Teleport to="body">
      <div
        v-if="activeData"
        class="colpop"
        :style="popStyle"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <div class="colpop-head">
          <b>{{ activeData.displayName }}</b>
          <span class="badge" :class="activeData.type">{{ activeData.label }}</span>
          <button class="colpop-close" type="button" :title="$t('关闭')" @click="closeProfile">
            ✕
          </button>
        </div>
        <div v-if="activeData.displayName !== activeData.name" class="colpop-orig">
          {{ activeData.name }}
        </div>
        <div class="colpop-grid">
          <span>{{ $t('非空') }}</span><b>{{ fmtInt(activeData.nonNull) }}</b>
          <span>{{ $t('缺失') }}</span><b>{{ fmtInt(activeData.missing) }}</b>
          <span>{{ $t('唯一值') }}</span><b>{{ fmtInt(activeData.unique) }}</b>
        </div>
        <div v-for="s in extraStats" :key="s.k" class="colpop-grid">
          <span>{{ s.k }}</span><b>{{ s.v }}</b>
        </div>
        <div v-if="isCategoryCol" class="colpop-grid colpop-wrap">
          <span>{{ $t('高频值') }}</span>
          <b>{{ activeData.summary }}</b>
        </div>
      </div>
    </Teleport>
  </section>
</template>
