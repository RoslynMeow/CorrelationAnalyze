import { ref } from 'vue'

const wide = ref(false)
let inited = false

/** 共享的宽屏判断（≥1101px）；双列图表布局使用 */
export function useWide() {
  if (!inited && typeof window !== 'undefined' && window.matchMedia) {
    inited = true
    const mql = window.matchMedia('(min-width: 1101px)')
    wide.value = mql.matches
    mql.addEventListener('change', (e) => {
      wide.value = e.matches
    })
  }
  return wide
}
