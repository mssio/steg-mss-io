import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getTheme, setTheme, subscribeTheme, THEME_STORAGE_KEY } from './theme'

// Minimal stand-ins for the two globals theme.ts touches; no DOM library needed.
function fakeRoot() {
  const classes = new Set<string>()
  return {
    dataset: {} as Record<string, string>,
    classList: {
      contains: (c: string) => classes.has(c),
      toggle: (c: string, force?: boolean) => {
        const on = force ?? !classes.has(c)
        if (on) classes.add(c)
        else classes.delete(c)
        return on
      },
    },
  }
}

const g = globalThis as Record<string, unknown>
let root: ReturnType<typeof fakeRoot>
let store: Map<string, string>

beforeEach(() => {
  root = fakeRoot()
  store = new Map()
  g.document = { documentElement: root }
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }
})

afterEach(() => {
  delete g.document
  delete g.localStorage
})

describe('theme', () => {
  test('setTheme writes data-theme, the .dark class and storage', () => {
    setTheme('light')
    expect(root.dataset.theme).toBe('light')
    expect(root.classList.contains('dark')).toBe(false)
    expect(store.get(THEME_STORAGE_KEY)).toBe('light')
    expect(getTheme()).toBe('light')

    setTheme('dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.classList.contains('dark')).toBe(true)
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(getTheme()).toBe('dark')
  })

  test('getTheme defaults to dark when no theme is set', () => {
    expect(getTheme()).toBe('dark')
  })

  test('setTheme still applies when storage throws', () => {
    g.localStorage = {
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => setTheme('light')).not.toThrow()
    expect(root.dataset.theme).toBe('light')
  })

  test('subscribers are notified until they unsubscribe', () => {
    let calls = 0
    const unsubscribe = subscribeTheme(() => calls++)
    setTheme('light')
    unsubscribe()
    setTheme('dark')
    expect(calls).toBe(1)
  })
})
