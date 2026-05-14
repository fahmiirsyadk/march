export const piGuiThemeUpdatedEvent = 'howcode:pi-gui-theme-updated'

const STORAGE_KEY = 'howcode:theme'

export function getStoredTheme(): 'light' | 'dark' | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return null
  } catch {
    return null
  }
}

export function setStoredTheme(theme: 'light' | 'dark') {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

export function applyStoredTheme() {
  const theme = getStoredTheme()
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  setStoredTheme(next)
  window.dispatchEvent(new CustomEvent(piGuiThemeUpdatedEvent))
}

export function usePiGuiTheme(_piTheme: unknown) {
  // Theme is now controlled via CSS variables in tokens.css using data-theme attribute
}
