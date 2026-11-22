<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChipGroup from '@/components/ChipGroup.vue'
import { buildFilterMask } from '@/lib/filter'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useSettingsStore } from '@/stores/settings'
import { t } from '@/i18n'
import type { Column, FilterRule } from '@/types'

const props = defineProps<{
  open: boolean
  columns: Column[]
  total: number
  rules: FilterRule[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', rules: FilterRule[]): void
  (e: 'clear'): void
}>()

const settings = useSettingsStore()
const draft = ref<FilterRule[]>([])
const dialogEl = ref<HTMLElement | null>(null)
useFocusTrap(
  computed(() => props.open),
  dialogEl,
  () => emit('close'),
)

const usable = computed(() =>
  props.columns.filter(
    (c) => c.type === 'number' || c.type === 'date' || c.type === 'category',
  ),
)

function cloneRules(rules: FilterRule[]): FilterRule[] {
  return rules.map((r) =>
    r.type === 'category' ? { ...r, values: [...r.values] } : { ...r },
  )
}

watch(
  () => props.open,
  (open) => {
    if (open) draft.value = cloneRules(props.rules)
  },
  { immediate: true },
)

const preview = computed(() => {
  const mask = buildFilterMask(props.columns, props.total, draft.value)
  if (!mask) return props.total
  let n = 0
  for (let i = 0; i < props.total; i++) if (mask[i]) n++
  return n
})

const typeLabel = (type: Column['type']): string =>
  type === 'number' ? t('数值') : type === 'date' ? t('日期') : t('类别')

function defaultRule(col: Column): FilterRule {
  if (col.type === 'number') return { type: 'number', column: col.name, min: null, max: null }
  if (col.type === 'date') return { type: 'date', column: col.name, min: '', max: '' }
  return { type: 'category', column: col.name, values: [] }
}

function addRule(): void {
  const used = new Set(draft.value.map((r) => r.column))
  const col = usable.value.find((c) => !used.has(c.name)) || usable.value[0]
  if (!col) return
  draft.value = [...draft.value, defaultRule(col)]
}

function removeRule(i: number): void {
  draft.value = draft.value.filter((_, j) => j !== i)
}

function changeColumn(i: number, e: Event): void {
  const name = (e.target as HTMLSelectElement).value
  const col = usable.value.find((c) => c.name === name)
  if (!col) return
  draft.value = draft.value.map((r, j) => (j === i ? defaultRule(col) : r))
}

function columnOf(name: string): Column | undefined {
  return props.columns.find((c) => c.name === name)
}

function valueOptions(name: string): { value: string; label: string }[] {
  const col = columnOf(name)
  if (!col) return []
  return col.unique.slice(0, 200).map((v) => ({
    value: v,
    label: settings.valueLabel(name, v),
  }))
}

function isoDate(ts: number | undefined): string {
  if (ts === undefined || !Number.isFinite(ts)) return ''
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function colMin(name: string): string {
  const col = columnOf(name)
  if (!col) return ''
  return col.type === 'date' ? isoDate(col.min) : col.min === undefined ? '' : String(col.min)
}

function colMax(name: string): string {
  const col = columnOf(name)
  if (!col) return ''
  return col.type === 'date' ? isoDate(col.max) : col.max === undefined ? '' : String(col.max)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="filter-veil" @click.self="emit('close')">
      <div
        ref="dialogEl"
        class="filter-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-label="$t('筛选数据')"
      >
        <header class="filter-head">
          <div>
            <h3>{{ $t('筛选数据') }}</h3>
            <span class="hint">{{ $t('所有分析页签只使用筛选后的行；多个条件之间为 AND。') }}</span>
          </div>
          <button class="btn icon" type="button" :title="$t('关闭')" @click="emit('close')">
            ✕
          </button>
        </header>

        <div class="filter-body">
          <div v-if="!draft.length" class="filter-empty">
            <p class="hint">{{ $t('还没有筛选条件。添加条件后，图表和统计都只基于匹配的行。') }}</p>
          </div>

          <div v-for="(rule, i) in draft" :key="i" class="filter-rule">
            <div class="filter-rule-head">
              <select class="compact-select" :value="rule.column" @change="changeColumn(i, $event)">
                <option v-for="c in usable" :key="c.name" :value="c.name">
                  {{ settings.columnLabel(c.name) }} · {{ typeLabel(c.type) }}
                </option>
              </select>
              <button class="linkbtn" type="button" @click="removeRule(i)">{{ $t('移除') }}</button>
            </div>

            <div v-if="rule.type === 'number'" class="filter-range">
              <label>
                {{ $t('最小值') }}
                <input
                  v-model.number="rule.min"
                  type="number"
                  step="any"
                  :placeholder="colMin(rule.column) || $t('不限')"
                />
              </label>
              <span class="filter-dash">~</span>
              <label>
                {{ $t('最大值') }}
                <input
                  v-model.number="rule.max"
                  type="number"
                  step="any"
                  :placeholder="colMax(rule.column) || $t('不限')"
                />
              </label>
            </div>

            <div v-else-if="rule.type === 'date'" class="filter-range">
              <label>
                {{ $t('开始日期') }}
                <input
                  v-model="rule.min"
                  type="date"
                  :min="colMin(rule.column)"
                  :max="colMax(rule.column)"
                />
              </label>
              <span class="filter-dash">~</span>
              <label>
                {{ $t('结束日期') }}
                <input
                  v-model="rule.max"
                  type="date"
                  :min="colMin(rule.column)"
                  :max="colMax(rule.column)"
                />
              </label>
            </div>

            <template v-else>
              <ChipGroup
                v-model="rule.values"
                :options="valueOptions(rule.column)"
                :search-threshold="6"
                :search-placeholder="$t('筛选取值…')"
              />
              <p v-if="(columnOf(rule.column)?.uniqueCount ?? 0) > 200" class="hint">
                {{ $t('该列取值较多，仅显示前 200 个；可用搜索定位。') }}
              </p>
              <label class="chk filter-missing">
                <input v-model="rule.includeMissing" type="checkbox" />
                {{ $t('包含缺失值') }}
              </label>
            </template>
          </div>

          <button class="btn" type="button" :disabled="!usable.length" @click="addRule">
            + {{ $t('添加条件') }}
          </button>
        </div>

        <footer class="filter-foot">
          <span class="filter-preview">
            {{ $t('匹配') }} <b>{{ preview }}</b> / {{ total }} {{ $t('行') }}
          </span>
          <button
            class="linkbtn"
            type="button"
            :disabled="!props.rules.length"
            @click="emit('clear')"
          >
            {{ $t('清除筛选') }}
          </button>
          <button class="btn" type="button" @click="emit('close')">{{ $t('取消') }}</button>
          <button class="btn primary" type="button" @click="emit('apply', cloneRules(draft))">
            {{ $t('应用筛选') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
