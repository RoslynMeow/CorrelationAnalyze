import { ref } from 'vue'

/** 主题 / 色板变化时 +1，图表布局 computed 依赖它来重新计算 */
export const chartThemeTick = ref(0)

export function bumpTheme(): void {
  chartThemeTick.value++
}
