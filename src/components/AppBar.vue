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
  (e: 'settings'): void
  (e: 'report'): void
}>()
</script>

<template>
  <header class="appbar">
    <nav class="tabs" :aria-label="$t('分析页签')">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="tab"
        :class="{ active: active === t.key }"
        @click="emit('select', t.key)"
      >
        {{ $t(t.label) }}
      </button>
    </nav>
    <div class="appactions">
      <span class="filechip" :title="chipTitle">{{ fileName }}</span>
      <button class="btn ghost" type="button" @click="emit('report')">{{ $t('报告') }}</button>
      <button class="btn ghost" type="button" @click="emit('change')">{{ $t('更换 CSV') }}</button>
      <button class="btn icon" type="button" :title="$t('切换深/浅色')" @click="emit('theme')">◐</button>
      <button class="btn icon" type="button" :title="$t('设置')" @click="emit('settings')">
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        >
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.7v1.4M8 12.9v1.4M1.7 8h1.4M12.9 8h1.4M3.55 3.55l1 1M11.45 11.45l1 1M12.45 3.55l-1 1M4.55 11.45l-1 1" />
        </svg>
      </button>
    </div>
  </header>
</template>
