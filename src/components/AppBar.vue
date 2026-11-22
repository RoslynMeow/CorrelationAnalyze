<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
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
  (e: 'presets'): void
}>()

const tabsEl = ref<HTMLElement | null>(null)
const scrollable = ref(false)
const atStart = ref(true)
const atEnd = ref(true)
const menuOpen = ref(false)

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
  if (!menuOpen.value) return
  const target = e.target as HTMLElement | null
  if (!target?.closest('.appmenu')) menuOpen.value = false
}

function act(kind: 'presets' | 'report' | 'change' | 'settings'): void {
  menuOpen.value = false
  if (kind === 'presets') emit('presets')
  else if (kind === 'report') emit('report')
  else if (kind === 'change') emit('change')
  else emit('settings')
}

onMounted(() => {
  updateScroll()
  if (typeof ResizeObserver !== 'undefined' && tabsEl.value) {
    ro = new ResizeObserver(updateScroll)
    ro.observe(tabsEl.value)
  }
  window.addEventListener('resize', updateScroll)
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', updateScroll)
  document.removeEventListener('click', onDocClick)
})

watch(
  () => props.tabs.map((t) => t.label),
  () => setTimeout(updateScroll, 0),
)
</script>

<template>
  <header class="appbar">
    <nav
      ref="tabsEl"
      class="tabs"
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

      <div class="appactions-inline wide-only">
        <button class="btn ghost" type="button" @click="emit('presets')">{{ $t('预设') }}</button>
        <button class="btn ghost" type="button" @click="emit('report')">{{ $t('报告') }}</button>
        <button class="btn ghost" type="button" @click="emit('change')">{{ $t('更换 CSV') }}</button>
      </div>

      <button class="btn icon" type="button" :title="$t('切换深/浅色')" @click="emit('theme')">
        ◐
      </button>

      <button
        class="btn icon wide-only"
        type="button"
        :title="$t('设置')"
        @click="emit('settings')"
      >
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

      <div class="appmenu compact-only">
        <button
          class="btn icon"
          type="button"
          :title="$t('更多')"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          ⋯
        </button>
        <div v-if="menuOpen" class="appmenu-panel" role="menu">
          <button class="appmenu-item" type="button" role="menuitem" @click="act('presets')">
            {{ $t('预设') }}
          </button>
          <button class="appmenu-item" type="button" role="menuitem" @click="act('report')">
            {{ $t('报告') }}
          </button>
          <button class="appmenu-item" type="button" role="menuitem" @click="act('change')">
            {{ $t('更换 CSV') }}
          </button>
          <button class="appmenu-item" type="button" role="menuitem" @click="act('settings')">
            {{ $t('设置') }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
