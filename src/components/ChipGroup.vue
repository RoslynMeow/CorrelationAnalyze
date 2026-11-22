<script setup lang="ts">
const props = defineProps<{
  modelValue: string[]
  options: string[]
  max?: number
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

function toggle(option: string): void {
  const cur = props.modelValue
  if (cur.includes(option)) {
    emit(
      'update:modelValue',
      cur.filter((x) => x !== option),
    )
  } else if (!props.max || cur.length < props.max) {
    emit('update:modelValue', [...cur, option])
  }
}
</script>

<template>
  <div class="chips">
    <label v-for="o in props.options" :key="o" class="chip">
      <input type="checkbox" :value="o" :checked="props.modelValue.includes(o)" @change="toggle(o)" />
      <span>{{ o }}</span>
    </label>
    <span v-if="!props.options.length" class="hint">没有可选变量</span>
  </div>
</template>
