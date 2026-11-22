<script setup lang="ts">
const props = defineProps<{
  label: string
  modelValue: string
  options: (string | { value: string; label: string })[]
  disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function onChange(e: Event): void {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}

const norm = (o: string | { value: string; label: string }) =>
  typeof o === 'string' ? { value: o, label: o } : o
</script>

<template>
  <label class="field">
    <span>{{ props.label }}</span>
    <select :value="props.modelValue" :disabled="props.disabled" @change="onChange">
      <option v-for="o in props.options.map(norm)" :key="o.value" :value="o.value">
        {{ o.label }}
      </option>
    </select>
  </label>
</template>
