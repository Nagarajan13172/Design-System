import { Link } from '@/lib/nav'
import { MODULES, BUILT, TOTAL } from 'virtual:manifest-lite'

/**
 * /docs — the app as its own case study.
 *
 * Every decision here is one the curriculum teaches, so publishing them is both the
 * honest thing and the most credible demonstration available: an app that teaches
 * bundle discipline and accessibility is judged on its own numbers first.
 */
const ADRS = [
  ['ADR-1', 'Our own ~130-line router', 'react-router v7 measured 34kB gz for twelve static routes with no loaders. Replacing it took the landing route from 108kB to 77kB.'],
  ['ADR-2', 'Zustand + immer, one store', 'Durable state lives in IndexedDB; the store holds what the UI needs synchronously.'],
  ['ADR-3', '`idb` behind one repository', 'One import site means one place to test migrations and handle QuotaExceededError.'],
  ['ADR-4', 'MDX body + typed meta', 'Content is structured data. Scheduling, mastery and every lint rule read that structure.'],
  ['ADR-5', 'No animation library', 'Our animation is a frame index into a precomputed timeline. There is nothing for a 19kB interpolation library to do.'],
  ['ADR-6', 'No graph library', 'The roadmap layout is computed at build time and committed, so a runtime layout engine would recompute a constant.'],
  ['ADR-7', 'ts-fsrs behind one adapter', 'Every review stores a full pre/post snapshot, so the algorithm is swappable without discarding history.'],
  ['ADR-8', 'Build-time syntax highlighting', 'Shiki runs in the build. Zero highlighter bytes reach the browser; a code drill costs ~0.6kB.'],
]

const BUDGETS = [
  ['landing (/review)', '95 kB'],
  ['/roadmap incremental', '25 kB'],
  ['one module', '60 kB'],
  ['the module route', '40 kB'],
  ['⌘K palette + index', '30 kB'],
]

export default function Docs() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/review" className="nav-link font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>how this is built</span>
      </header>

      <main className="px-5 py-8 mx-auto prose-body" style={{ maxWidth: '44rem' }}>
        <p>
          This app is a frontend system design artifact, so the decisions behind it are
          the same ones it teaches. Publishing them is the cheapest honest demonstration
          available — and it means the claims can be checked rather than believed.
        </p>

        <h2>What is built</h2>
        <p>
          <strong>{BUILT} of {TOTAL} modules</strong> are built. The rest are specified:
          each carries an authored claim and a figure question, visible on{' '}
          <Link to="/roadmap">the roadmap</Link>. A node with no working figure would
          break the one promise that separates this from a documentation site, so
          nothing is stubbed to look finished.
        </p>

        <h2>Decisions</h2>
        <p>
          Three of these reverse an earlier choice. Each reversal came from a
          measurement, not a preference — the numbers are in the repository’s ADRs.
        </p>
        <ul>
          {ADRS.map(([id, title, why]) => (
            <li key={id} style={{ marginBottom: '0.6rem' }}>
              <strong>{id} — {title}.</strong> {why}
            </li>
          ))}
        </ul>

        <h2>Budgets, enforced in CI</h2>
        <p>
          A budget nobody has seen fail is not a budget. Each of these fails the build
          when exceeded, and one gate deliberately breaks a budget to prove the check
          still fires.
        </p>
        <ul>
          {BUDGETS.map(([what, limit]) => (
            <li key={what}><code>{what}</code> — {limit} gzipped</li>
          ))}
        </ul>

        <h2>Your data</h2>
        <p>
          Everything lives in this browser. There is no account, no server and no
          analytics, which means nothing to breach — and also that a cleared browser can
          take your progress with it. <Link to="/settings">Settings</Link> states plainly
          what is stored, whether the browser has agreed to keep it, and how to export it.
        </p>

        <h2>Primitives</h2>
        <p>
          Every figure is built from one of six primitives. A primitive is only called
          validated once at least two modules use it — one client cannot tell you an
          abstraction generalises. The current counts are computed, not asserted:{' '}
          {['LaneTimeline', 'StateMatrix', 'NodeGraph', 'Plot2D', 'CodeStage', 'LiveSurface']
            .map(p => `${p} ${MODULES.filter(m => m.primitive === p && m.status !== 'planned').length}`)
            .join(' · ')}.
        </p>
      </main>
    </div>
  )
}
