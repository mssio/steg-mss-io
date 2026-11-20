/**
 * Theme state lives on <html>: `data-theme` plus the `.dark` class that
 * shadcn's `dark:` variant keys on. /theme-init.js applies the same state
 * before first paint; this module changes it afterwards.
 */
export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'steg-theme'

const listeners = new Set<() => void>()

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(t: Theme): void {
  const root = document.documentElement
  root.dataset.theme = t
  root.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t)
  } catch {
    // Storage can be unavailable (privacy mode, blocked site data): the
    // theme still applies for this page view.
  }
  for (const listener of listeners) listener()
}

/** For `useSyncExternalStore`: notified whenever `setTheme` runs. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
