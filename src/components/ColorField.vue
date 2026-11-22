<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  modelValue: string | null
  fallback: string
  resettable?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

const current = computed(() => props.modelValue || props.fallback || '#888888')

function onPick(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onHex(e: Event): void {
  const input = e.target as HTMLInputElement
  let v = input.value.trim()
  if (v && !v.startsWith('#')) v = '#' + v
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    emit('update:modelValue', v.toLowerCase())
  } else {
    input.value = current.value
  }
}
</script>

<template>
  <div class="colorfield">
    <span class="cf-label">{{ props.label }}</span>
    <label class="cf-swatch" :style="{ background: current }">
      <input type="color" :value="current" @input="onPick" />
    </label>
    <input
      class="cf-hex"
      :value="current"
      spellcheck="false"
      maxlength="7"
      @change="onHex"
    />
    <button
      v-if="props.modelValue && props.resettable !== false"
      class="linkbtn"
      type="button"
      title="恢复默认"
      @click="emit('update:modelValue', null)"
    >
      重置
    </button>
  </div>
</template>
