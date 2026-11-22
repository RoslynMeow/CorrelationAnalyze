<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ChipGroup from '@/components/ChipGroup.vue'
import { t } from '@/i18n'

type Option = { value: string; label: string }

const props = defineProps<{
  modelValue: string[]
  options: Option[]
  label: string
  max?: number
  emptyLabel?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)

const optionMap = computed(() => new Map(props.options.map((o) => [o.value, o.label])))
const selected = computed(() =>
  props.modelValue.map((v) => ({ value: v, label: optionMap.value.get(v) ?? v })),
)

function toggle(): void {
  open.value = !open.value
}

function onDocClick(e: MouseEvent): void {
  if (!open.value) return
  if (!root.value?.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    e.stopPropagation()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="chip-picker" @click.stop>
    <span class="chip-picker-label">{{ props.label }}</span>
    <span class="chip-picker-count">
      {{ t('已选 {n} / {total}', { n: props.modelValue.length, total: props.options.length }) }}
      <template v-if="props.max"> · {{ t('最多 {max} 个', { max: props.max }) }}</template>
    </span>
    <div class="chip-picker-values">
      <span v-for="o in selected" :key="o.value" class="chip-static" :title="o.label">
        {{ o.label }}
      </span>
      <span v-if="!selected.length" class="hint chip-picker-empty">
        {{ props.emptyLabel || t('未选择') }}
      </span>
    </div>
    <button
      class="linkbtn chip-picker-toggle"
      type="button"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ open ? t('收起') : t('展开') }}
      <span class="chip-picker-caret" :class="{ open }">▾</span>
    </button>
    <div v-show="open" class="chip-picker-popover">
      <ChipGroup
        :model-value="props.modelValue"
        :options="props.options"
        :max="props.max"
        :search-threshold="6"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>
