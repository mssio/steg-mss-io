// Applies the saved or preferred theme before first paint. Loaded as an
// external, render-blocking script because the CSP forbids inline scripts.
// Keep in sync with src/lib/theme.ts.
;(function () {
  var theme = null
  try {
    theme = localStorage.getItem('steg-theme')
  } catch {}
  if (theme !== 'dark' && theme !== 'light') {
    var prefersLight =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    theme = prefersLight ? 'light' : 'dark'
  }
  var root = document.documentElement
  root.dataset.theme = theme
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
})()
