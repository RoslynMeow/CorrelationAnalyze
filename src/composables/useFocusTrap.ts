import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 弹窗焦点管理：打开时把焦点移入对话框，Tab / Shift+Tab 在内部循环，
 * Esc 关闭，关闭后把焦点还给原来的元素。
 */
export function useFocusTrap(
  open: Ref<boolean>,
  container: Ref<HTMLElement | null>,
  onClose?: () => void,
): void {
  let previous: HTMLElement | null = null
  let listening = false

  function focusables(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose?.()
      return
    }
    if (e.key !== 'Tab') return
    const items = focusables()
    if (!items.length) {
      e.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement as HTMLElement | null
    const inside = !!active && !!container.value?.contains(active)
    if (e.shiftKey && (!inside || active === first)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (!inside || active === last)) {
      e.preventDefault()
      first.focus()
    }
  }

  function stop(): void {
    if (listening) {
      document.removeEventListener('keydown', onKey, true)
      listening = false
    }
  }

  watch(
    open,
    async (isOpen) => {
      if (isOpen) {
        previous = document.activeElement as HTMLElement | null
        await nextTick()
        await nextTick()
        const items = focusables()
        const target = items[0] ?? container.value
        target?.focus({ preventScroll: true })
        if (!listening) {
          document.addEventListener('keydown', onKey, true)
          listening = true
        }
      } else {
        stop()
        if (previous?.isConnected) previous.focus({ preventScroll: true })
        previous = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(stop)
}
