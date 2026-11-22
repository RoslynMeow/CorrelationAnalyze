<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  tabs: { key: string; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'generate', keys: string[], includeCharts: boolean): void
}>()

const selected = ref<string[]>([])
const includeCharts = ref(true)

watch(
  () => props.open,
  (open) => {
    if (open) {
      selected.value = props.tabs.map((t) => t.key)
      includeCharts.value = true
    }
  },
  { immediate: true },
)

function toggle(key: string): void {
  selected.value = selected.value.includes(key)
    ? selected.value.filter((k) => k !== key)
    : [...selected.value, key]
}

function selectAll(): void {
  selected.value = props.tabs.map((t) => t.key)
}

function clearAll(): void {
  selected.value = []
}

function generate(): void {
  if (!selected.value.length) return
  // 保持页签顺序
  const keys = props.tabs.map((t) => t.key).filter((k) => selected.value.includes(k))
  emit('generate', keys, includeCharts.value)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="report-veil" @click.self="emit('close')">
      <div class="report-dialog" role="dialog" aria-modal="true" :aria-label="$t('导出报告')">
        <header class="report-dialog-head">
          <h3>{{ $t('导出报告') }}</h3>
          <button class="btn icon" type="button" :title="$t('关闭')" @click="emit('close')">
            ✕
          </button>
        </header>

        <div class="report-dialog-body">
          <p class="hint">
            {{ $t('选择要包含的页签。生成时会自动切换页签截取图表，可能需要几秒钟。') }}
          </p>

          <div class="report-actions">
            <button class="linkbtn" type="button" @click="selectAll">{{ $t('全选') }}</button>
            <button class="linkbtn" type="button" @click="clearAll">{{ $t('清空') }}</button>
            <span class="hint">{{ $t('已选 {n} / {m}', { n: selected.length, m: tabs.length }) }}</span>
          </div>

          <div class="report-checks">
            <label v-for="t in props.tabs" :key="t.key" class="chk report-check">
              <input
                type="checkbox"
                :checked="selected.includes(t.key)"
                @change="toggle(t.key)"
              />
              {{ $t(t.label) }}
            </label>
          </div>

          <label class="chk">
            <input v-model="includeCharts" type="checkbox" />
            {{ $t('包含图表图片（PNG 2x）') }}
          </label>

          <p class="hint">
            {{ $t('报告会在新标签页打开，可直接打印或另存为 PDF，也可以下载 HTML。') }}
          </p>
        </div>

        <footer class="report-dialog-foot">
          <button class="btn" type="button" @click="emit('close')">{{ $t('取消') }}</button>
          <button class="btn primary" type="button" :disabled="!selected.length" @click="generate">
            {{ $t('生成报告') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
