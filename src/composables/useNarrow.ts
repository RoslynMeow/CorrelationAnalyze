import { ref } from 'vue'

const narrow = ref(false)
let inited = false

/** 共享的窄屏判断（<760px），跨断点时图表需要重排 */
export function useNarrow() {
  if (!inited && typeof window !== 'undefined' && window.matchMedia) {
    inited = true
    const mql = window.matchMedia('(max-width: 759px)')
    narrow.value = mql.matches
    mql.addEventListener('change', (e) => {
      narrow.value = e.matches
    })
  }
  return narrow
}
