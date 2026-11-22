<script setup lang="ts">
defineProps<{ drag: boolean }>()
const emit = defineEmits<{ (e: 'pick'): void; (e: 'sample'): void }>()
</script>

<template>
  <div class="landing">
    <div
      class="dropcard"
      :class="{ drag }"
      tabindex="0"
      role="button"
      aria-label="选择 CSV 文件"
      @click="emit('pick')"
      @keydown.enter.prevent="emit('pick')"
      @keydown.space.prevent="emit('pick')"
    >
      <div class="dropicon">
        <svg
          viewBox="0 0 24 24"
          width="34"
          height="34"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
        </svg>
      </div>
      <h1>关联性分析</h1>
      <p class="lead">把 CSV 文件拖到这里</p>
      <p class="sub">或点击选择文件</p>
      <div class="feats">
        <span>相关矩阵</span><span>目标关联排序</span><span>类别列联分析</span>
      </div>
      <button class="btn sample-btn" type="button" @click.stop="emit('sample')">
        先看看示例数据
      </button>
    </div>
  </div>
</template>
