<script setup lang="ts">
defineProps<{
  tabs: { key: string; label: string }[]
  active: string
  fileName: string
  chipTitle: string
}>()

const emit = defineEmits<{
  (e: 'select', key: string): void
  (e: 'change'): void
  (e: 'theme'): void
}>()
</script>

<template>
  <header class="appbar">
    <nav class="tabs" aria-label="分析页签">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="tab"
        :class="{ active: active === t.key }"
        @click="emit('select', t.key)"
      >
        {{ t.label }}
      </button>
    </nav>
    <div class="appactions">
      <span class="filechip" :title="chipTitle">{{ fileName }}</span>
      <button class="btn ghost" type="button" @click="emit('change')">更换 CSV</button>
      <button class="btn icon" type="button" title="切换深/浅色" @click="emit('theme')">◐</button>
    </div>
  </header>
</template>
