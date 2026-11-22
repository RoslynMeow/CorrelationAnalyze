<script setup lang="ts">
import { computed, ref } from 'vue'

type ChipOption = string | { value: string; label: string }

const props = defineProps<{
  modelValue: string[]
  options: ChipOption[]
  max?: number
  /** 选项超过该数量时显示搜索框 */
  searchThreshold?: number
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

const keyword = ref('')

const opts = computed(() =>
  props.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
)

const showSearch = computed(() => opts.value.length > (props.searchThreshold ?? 10))

const shown = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return opts.value
  return opts.value.filter(
    (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
  )
})

const selectedCount = computed(() => props.modelValue.length)
const limit = computed(() => props.max ?? opts.value.length)
const allShownSelected = computed(
  () => shown.value.length > 0 && shown.value.every((o) => props.modelValue.includes(o.value)),
)

function toggle(option: string): void {
  if (props.modelValue.includes(option)) {
    emit(
      'update:modelValue',
      props.modelValue.filter((x) => x !== option),
    )
  } else if (props.modelValue.length < limit.value) {
    emit('update:modelValue', [...props.modelValue, option])
  }
}

/** 全选当前筛选结果（受 max 限制） */
function selectAll(): void {
  const next = [...props.modelValue]
  for (const o of shown.value) {
    if (next.length >= limit.value) break
    if (!next.includes(o.value)) next.push(o.value)
  }
  emit('update:modelValue', next)
}

/** 反选当前筛选结果（受 max 限制） */
function invert(): void {
  const visible = new Set(shown.value.map((o) => o.value))
  const next = props.modelValue.filter((o) => !visible.has(o))
  for (const o of shown.value) {
    if (next.length >= limit.value) break
    if (!props.modelValue.includes(o.value)) next.push(o.value)
  }
  emit('update:modelValue', next)
}

function clear(): void {
  emit('update:modelValue', [])
}
</script>

<template>
  <div class="chipgroup">
    <div class="chipbar">
      <span class="chipcount">
        已选 <b>{{ selectedCount }}</b> / {{ opts.length
        }}<template v-if="props.max"> · 最多 {{ props.max }} 个</template>
      </span>
      <input
        v-if="showSearch"
        v-model="keyword"
        class="chipsearch"
        type="search"
        placeholder="筛选变量…"
        aria-label="筛选变量"
      />
      <span class="chipspacer"></span>
      <button
        class="linkbtn"
        type="button"
        :disabled="!shown.length || allShownSelected"
        title="全选当前筛选结果"
        @click="selectAll"
      >
        全选
      </button>
      <button
        class="linkbtn"
        type="button"
        :disabled="!shown.length"
        title="反选当前筛选结果"
        @click="invert"
      >
        反选
      </button>
      <button
        class="linkbtn"
        type="button"
        :disabled="!selectedCount"
        title="清空全部选择"
        @click="clear"
      >
        清空
      </button>
    </div>

    <div class="chips">
      <label v-for="o in shown" :key="o.value" class="chip" :title="o.label">
        <input
          type="checkbox"
          :value="o.value"
          :checked="props.modelValue.includes(o.value)"
          :disabled="!props.modelValue.includes(o.value) && selectedCount >= limit"
          @change="toggle(o.value)"
        />
        <span>{{ o.label }}</span>
      </label>
      <span v-if="!shown.length" class="hint">
        {{ opts.length ? '没有匹配的变量，试试其他关键字' : '没有可选变量' }}
      </span>
    </div>
  </div>
</template>
