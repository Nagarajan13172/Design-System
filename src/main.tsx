import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Router } from './lib/router'
import { routes } from './router'
import { PaletteHost } from './features/palette/usePalette'
import { ErrorBoundary } from './kit/ErrorBoundary'
import { StaleBuildBar } from './features/recovery/StaleBuildBar'
import './styles/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="The app" kind="route">
      <Router routes={routes} />
      <PaletteHost />
      <StaleBuildBar />
    </ErrorBoundary>
  </StrictMode>,
)
