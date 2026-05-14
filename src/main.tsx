import { QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import '@fontsource-variable/inter'
import './styles.css'
import { createPiDesktopApi } from './api/client'
import App from './app'
import { applyStoredTheme } from './app/app-shell/usePiGuiTheme'
import { queryClient } from './app/query/query-client'

function applyDesktopPlatformAttribute() {
  const platform = window.piDesktop?.platform ?? 'browser'
  document.documentElement.setAttribute('data-desktop-platform', platform)
}

if (!window.piDesktop) {
  window.piDesktop = createPiDesktopApi() as unknown as NonNullable<Window['piDesktop']>
}

try {
  applyDesktopPlatformAttribute()
  applyStoredTheme()
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  )
} catch (error) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre class="bootstrap-error">Bootstrap error:\n${String(error)}</pre>`
  }

  throw error
}
