/**
 * TV/D-Pad navigation composable.
 * Enables spatial navigation using arrow keys — essential for Google TV remote.
 */
export function useTVNavigation() {
  const currentFocusIndex = ref(0)
  const focusableElements = ref<HTMLElement[]>([])
  const isTV = ref(false)

  // Detect TV environment (basic heuristic)
  if (import.meta.client) {
    isTV.value = /Android TV|GoogleTV|VIDAA/i.test(navigator.userAgent)
      || window.matchMedia('(pointer: none)').matches
  }

  function registerFocusable(container: HTMLElement | null) {
    if (!container) return
    focusableElements.value = Array.from(
      container.querySelectorAll<HTMLElement>('[data-focusable], .focusable, a, button, [tabindex]')
    ).filter(el => !el.hasAttribute('disabled'))
  }

  function focusElement(index: number) {
    const elements = focusableElements.value
    if (elements.length === 0) return

    currentFocusIndex.value = Math.max(0, Math.min(index, elements.length - 1))
    const el = elements[currentFocusIndex.value]
    el?.focus()
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }

  function handleNavigation(e: KeyboardEvent) {
    const elements = focusableElements.value
    if (elements.length === 0) return

    const current = document.activeElement as HTMLElement
    const currentIdx = elements.indexOf(current)
    if (currentIdx === -1) return

    // Calculate grid columns from element positions
    const rects = elements.map(el => el.getBoundingClientRect())
    const currentRect = rects[currentIdx]

    let targetIdx = -1

    switch (e.key) {
      case 'ArrowRight': {
        // Find next element to the right on same row
        targetIdx = rects.findIndex((r, i) =>
          i > currentIdx && Math.abs(r.top - currentRect.top) < 20
        )
        if (targetIdx === -1) targetIdx = Math.min(currentIdx + 1, elements.length - 1)
        break
      }
      case 'ArrowLeft': {
        // Find previous element to the left on same row
        for (let i = currentIdx - 1; i >= 0; i--) {
          if (Math.abs(rects[i].top - currentRect.top) < 20) {
            targetIdx = i
            break
          }
        }
        if (targetIdx === -1) targetIdx = Math.max(currentIdx - 1, 0)
        break
      }
      case 'ArrowDown': {
        // Find nearest element below
        let bestDist = Infinity
        for (let i = 0; i < elements.length; i++) {
          if (rects[i].top > currentRect.bottom - 5) {
            const dist = Math.abs(rects[i].left - currentRect.left) + (rects[i].top - currentRect.top)
            if (dist < bestDist) { bestDist = dist; targetIdx = i }
          }
        }
        break
      }
      case 'ArrowUp': {
        // Find nearest element above
        let bestDist = Infinity
        for (let i = elements.length - 1; i >= 0; i--) {
          if (rects[i].bottom < currentRect.top + 5) {
            const dist = Math.abs(rects[i].left - currentRect.left) + (currentRect.top - rects[i].top)
            if (dist < bestDist) { bestDist = dist; targetIdx = i }
          }
        }
        break
      }
      default:
        return // Don't prevent default for non-navigation keys
    }

    if (targetIdx >= 0 && targetIdx !== currentIdx) {
      e.preventDefault()
      focusElement(targetIdx)
    }
  }

  function enableNavigation(container: HTMLElement | null) {
    if (!container) return
    registerFocusable(container)
    container.addEventListener('keydown', handleNavigation)
    // Focus first element
    if (focusableElements.value.length > 0) {
      focusElement(0)
    }
  }

  function disableNavigation(container: HTMLElement | null) {
    container?.removeEventListener('keydown', handleNavigation)
  }

  return {
    isTV,
    currentFocusIndex: readonly(currentFocusIndex),
    registerFocusable,
    focusElement,
    enableNavigation,
    disableNavigation,
    handleNavigation,
  }
}
