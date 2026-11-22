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
      <button
        class="btn sample-btn sample-top"
        type="button"
        title="载入 30 行示例 CSV"
        @click.stop="emit('sample')"
      >
        示例数据
      </button>

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

      <div class="filetype" tabindex="0" aria-describedby="filetype-tip">
        <span class="filetype-icon" aria-hidden="true">CSV</span>
        <span class="filetype-text">支持的文件类型：<b>CSV</b></span>
        <span class="filetype-info" aria-hidden="true">i</span>

        <div id="filetype-tip" class="filetype-tip" role="tooltip">
          <h5>CSV 支持情况</h5>
          <ul>
            <li>扩展名：<b>.csv</b> / <b>.tsv</b> / <b>.txt</b>（文本表格）</li>
            <li>编码：UTF-8、UTF-8 BOM、GBK(GB18030)、UTF-16 LE/BE</li>
            <li>分隔符：逗号、分号、Tab、竖线，自动探测</li>
            <li>缺失值：<code>NA</code> / <code>N/A</code> / <code>NaN</code> / <code>null</code> / <code>-</code> 等自动识别</li>
          </ul>
          <h5>性能与优化</h5>
          <ul>
            <li>读取上限 100,000 行，变量对计算放入 Web Worker，不阻塞界面</li>
            <li>散点最多 6,000 点，成对矩阵最多 3,000 行抽样</li>
            <li>文件不会上传，全部在浏览器本地计算</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
