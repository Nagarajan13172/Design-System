import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Router } from './lib/router'
import { routes } from './router'
import './styles/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router routes={routes} />
  </StrictMode>,
)
