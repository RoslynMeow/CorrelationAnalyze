import { ref } from 'vue'

const height = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
let inited = false
let raf = 0

/** 共享的视口高度，用于让图表高度跟随窗口而不是写死 */
export function useViewportHeight() {
  if (!inited && typeof window !== 'undefined') {
    inited = true
    window.addEventListener(
      'resize',
      () => {
        if (raf) return
        raf = requestAnimationFrame(() => {
          raf = 0
          height.value = window.innerHeight
        })
      },
      { passive: true },
    )
  }
  return height
}
