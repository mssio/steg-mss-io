/** Keyboard and pointer maths for the before/after compare slider (0–100). */

export const clampPercent = (n: number) => Math.min(100, Math.max(0, n))

/**
 * The slider position after a key press, or null if the key isn't one the
 * slider handles. Arrows move 1 (10 with Shift), Page Up/Down move 10,
 * Home/End jump to the ends.
 */
export function sliderKey(value: number, key: string, shift = false): number | null {
  const step = shift ? 10 : 1
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampPercent(value - step)
    case 'ArrowRight':
    case 'ArrowUp':
      return clampPercent(value + step)
    case 'PageDown':
      return clampPercent(value - 10)
    case 'PageUp':
      return clampPercent(value + 10)
    case 'Home':
      return 0
    case 'End':
      return 100
    default:
      return null
  }
}

/** Where a pointer at `clientX` sits across a box, as a whole percent. */
export function pointerPercent(clientX: number, left: number, width: number): number {
  if (width <= 0) return 50
  return Math.round(clampPercent(((clientX - left) / width) * 100))
}
