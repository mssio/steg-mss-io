import { describe, expect, test } from 'bun:test'
import { pointerPercent, sliderKey } from './slider'

describe('sliderKey', () => {
  test('arrows step by 1, or 10 with shift', () => {
    expect(sliderKey(50, 'ArrowRight')).toBe(51)
    expect(sliderKey(50, 'ArrowUp')).toBe(51)
    expect(sliderKey(50, 'ArrowLeft')).toBe(49)
    expect(sliderKey(50, 'ArrowDown')).toBe(49)
    expect(sliderKey(50, 'ArrowRight', true)).toBe(60)
    expect(sliderKey(50, 'ArrowLeft', true)).toBe(40)
  })

  test('page keys step by 10', () => {
    expect(sliderKey(50, 'PageUp')).toBe(60)
    expect(sliderKey(50, 'PageDown')).toBe(40)
  })

  test('Home and End jump to the ends', () => {
    expect(sliderKey(37, 'Home')).toBe(0)
    expect(sliderKey(37, 'End')).toBe(100)
  })

  test('clamps to 0–100', () => {
    expect(sliderKey(0, 'ArrowLeft')).toBe(0)
    expect(sliderKey(100, 'ArrowRight')).toBe(100)
    expect(sliderKey(95, 'PageUp')).toBe(100)
    expect(sliderKey(3, 'ArrowLeft', true)).toBe(0)
  })

  test('ignores other keys', () => {
    expect(sliderKey(50, 'Tab')).toBeNull()
    expect(sliderKey(50, 'a')).toBeNull()
  })
})

describe('pointerPercent', () => {
  test('maps the pointer across the box', () => {
    expect(pointerPercent(150, 100, 200)).toBe(25)
    expect(pointerPercent(100, 100, 200)).toBe(0)
    expect(pointerPercent(300, 100, 200)).toBe(100)
  })

  test('clamps outside the box and survives a zero width', () => {
    expect(pointerPercent(0, 100, 200)).toBe(0)
    expect(pointerPercent(999, 100, 200)).toBe(100)
    expect(pointerPercent(10, 0, 0)).toBe(50)
  })
})
