<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  tabs: { key: string; label: string }[]
  active: string
  fileName: string
  chipTitle: string
}>()

const emit = defineEmits<{
  (e: 'select', key: string): void
  (e: 'settings'): void
}>()

const tabsEl = ref<HTMLElement | null>(null)
const scrollable = ref(false)
const atStart = ref(true)
const atEnd = ref(true)
const tabMenuOpen = ref(false)

const activeLabel = computed(
  () => props.tabs.find((t) => t.key === props.active)?.label || '',
)

let ro: ResizeObserver | null = null

function updateScroll(): void {
  const el = tabsEl.value
  if (!el) return
  scrollable.value = el.scrollWidth > el.clientWidth + 2
  atStart.value = el.scrollLeft <= 2
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
}

function onScroll(): void {
  updateScroll()
}

function onDocClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null
  if (tabMenuOpen.value && !target?.closest('.tab-select')) tabMenuOpen.value = false
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && tabMenuOpen.value) {
    tabMenuOpen.value = false
    e.stopPropagation()
  }
}

function toggleTabMenu(): void {
  tabMenuOpen.value = !tabMenuOpen.value
}

function selectTab(key: string): void {
  tabMenuOpen.value = false
  emit('select', key)
}

onMounted(() => {
  updateScroll()
  if (typeof ResizeObserver !== 'undefined' && tabsEl.value) {
    ro = new ResizeObserver(updateScroll)
    ro.observe(tabsEl.value)
  }
  window.addEventListener('resize', updateScroll)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', updateScroll)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

watch(
  () => props.tabs.map((t) => t.label),
  () => setTimeout(updateScroll, 0),
)
</script>

<template>
  <header class="appbar">
    <div class="tab-select">
      <button
        class="tab-current"
        type="button"
        :aria-expanded="tabMenuOpen"
        :aria-label="$t('选择分析页签')"
        @click="toggleTabMenu"
      >
        <span class="tab-current-label">{{ $t(activeLabel) }}</span>
        <span class="tab-current-chev">▾</span>
      </button>
      <div v-if="tabMenuOpen" class="tab-menu" role="menu">
        <button
          v-for="t in props.tabs"
          :key="t.key"
          type="button"
          class="tab-menu-item"
          role="menuitem"
          :class="{ active: props.active === t.key }"
          @click="selectTab(t.key)"
        >
          {{ $t(t.label) }}
        </button>
      </div>
    </div>

    <nav
      ref="tabsEl"
      class="tabs wide-nav"
      :class="{ scrollable, 'at-start': atStart, 'at-end': atEnd }"
      :aria-label="$t('分析页签')"
      @scroll.passive="onScroll"
    >
      <button
        v-for="t in props.tabs"
        :key="t.key"
        type="button"
        class="tab"
        :class="{ active: props.active === t.key }"
        @click="emit('select', t.key)"
      >
        {{ $t(t.label) }}
      </button>
    </nav>

    <div class="appactions">
      <span class="filechip" :title="chipTitle">{{ props.fileName }}</span>

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
