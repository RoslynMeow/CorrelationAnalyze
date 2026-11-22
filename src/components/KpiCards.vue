<script setup lang="ts">
defineProps<{ items: { label: string; value: string; sub?: string }[] }>()
</script>

<template>
  <div class="kpis">
    <div v-for="it in items" :key="it.label" class="kpi">
      <div class="label">{{ it.label }}</div>
      <div class="value">{{ it.value }}</div>
      <div class="sub">{{ it.sub }}</div>
    </div>
  </div>
</template>
