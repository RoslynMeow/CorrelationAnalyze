import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notifyThemeChange } from '@/lib/chartTheme'

const KEY = 'ca-theme'

export const useThemeStore = defineStore('theme', () => {
  const current = ref<'light' | 'dark'>('light')

  function apply(): void {
    document.documentElement.dataset.theme = current.value
    notifyThemeChange()
  }

  function init(): void {
    try {
      const t = localStorage.getItem(KEY)
      if (t === 'light' || t === 'dark') current.value = t
    } catch {
      /* file:// 下部分浏览器禁用 localStorage */
    }
    apply()
  }

  function toggle(): void {
    current.value = current.value === 'dark' ? 'light' : 'dark'
    apply()
    try {
      localStorage.setItem(KEY, current.value)
    } catch {
      /* 忽略 */
    }
  }

  return { current, init, toggle }
})
