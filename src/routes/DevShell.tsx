import { Link } from '@/lib/nav'
import type { ReactNode } from 'react'

/** Chrome for the /dev routes. DEV ONLY — never shipped to a learner. */
export function DevShell({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('fesd:theme', next) } catch { /* private mode */ }
  }
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b sticky top-0 z-10"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <Link to="/dev" className="font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>dev</span>
        <span style={{ color: 'var(--text-dim)' }}>{title}</span>
        <nav className="ml-auto flex items-center gap-4">
          <Link to="/dev/primitives" className="nav-link" style={{ color: 'var(--text-dim)' }}>primitives</Link>
          <button onClick={toggle} style={{ color: 'var(--text-dim)' }} aria-label="toggle theme">theme</button>
        </nav>
      </header>
      {/* A real <main> landmark: the dev pages had none, which the a11y gate found
          the moment it waited on one. */}
      <main className="px-5 py-6 mx-auto" style={{ maxWidth: '78rem' }}>
        {aside}
        {children}
      </main>
    </div>
  )
}
