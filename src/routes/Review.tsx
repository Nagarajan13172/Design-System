import { useEffect } from 'react'
import { useAutoFocus } from '@kit/useAutoFocus'
import { Link } from '@/lib/nav'
import { useReview } from '@/features/review/useReview'
import { RENDERERS, type RenderableKind } from '@/features/review/cards/CardRenderer'
import { summarise } from '@/features/review/session'
import { useApp } from '@/store'
import { BUILT, TOTAL } from 'virtual:manifest-lite'

/**
 * /review — THE LANDING ROUTE.
 *
 * Retrieval is the loop, not a second tab. A returning learner lands on work, not
 * on a map of everything they have not done yet — the map is a re-entry cost, and
 * re-entry cost is what the day-3 dropoff actually is.
 *
 * Three phases in ONE route: deck, in-place runner, in-place summary. A session id
 * in the URL would be unshareable and would become a dead link the moment the
 * session ended.
 */
export default function Review() {
  const { session, deck, summary, claim, probe, prepare, start, grade, skip } = useReview()
  const { streak, hydrate, hydrated } = useApp()

  useEffect(() => { void hydrate(); void prepare() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard-first: a review session is a typing rhythm.
  useEffect(() => {
    if (session.phase !== 'running') return
    const on = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); skip() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [session.phase, skip])

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="font-mono text-[12px]">fesd</span>
        <nav className="ml-auto flex items-center gap-4" style={{ color: 'var(--text-dim)' }}>
          <span title="A day counts if you graded a due card — or if nothing was due.">
            streak <span className="font-mono" style={{ color: hydrated && streak > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>{streak}</span>
          </span>
          <Link to="/dev" style={{ color: 'var(--text-dim)' }}>dev</Link>
        </nav>
      </header>

      <main className="px-5 py-10 mx-auto" style={{ maxWidth: '44rem' }}>
        {session.phase === 'deck' && <Deck deck={deck} summary={summary} onStart={start} />}

        {session.phase === 'running' && claim && probe && (
          <>
            <Progress cursor={session.cursor} total={session.queue.length} queue={session.queue} />
            <Card key={`${probe.id}-${session.cursor}`} kind={probe.kind} item={probe} claim={claim} onGrade={grade} />
          </>
        )}

        {session.phase === 'summary' && <Summary session={session} />}
      </main>
    </div>
  )
}

function Card({ kind, item, claim, onGrade }: { kind: string } & Omit<Parameters<typeof RENDERERS['cloze']>[0], 'item'> & { item: Parameters<typeof RENDERERS['cloze']>[0]['item'] }) {
  const R = RENDERERS[kind as RenderableKind]
  if (!R) {
    return (
      <div className="rounded border border-dashed p-6" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-faint)' }}>
        <span className="font-mono">{kind}</span> has no renderer yet — scheduled for M3/M4.
        <button className="ml-3 underline" onClick={() => onGrade({ kind: 'self-rating', rating: 3 })}>skip for now</button>
      </div>
    )
  }
  return <R item={item} claim={claim} onGrade={onGrade} />
}

function Deck({ deck, summary, onStart }: { deck: unknown[] | null; summary: ReturnType<typeof import('@/domain/scheduler/queue').queueSummary> | null; onStart: () => void }) {
  const startRef = useAutoFocus<HTMLButtonElement>(summary?.count ?? 0)
  if (!deck) return <p style={{ color: 'var(--text-faint)' }}>building today's deck…</p>
  if (!summary?.count) {
    return (
      <div>
        <h1 className="text-[1.0625rem] font-medium mb-2">Nothing is due.</h1>
        <p style={{ color: 'var(--text-dim)' }}>
          Your streak is safe — a day counts when nothing was due, because punishing the
          scheduler's own success would be absurd. {BUILT} of {TOTAL} modules are built;
          come back tomorrow, or <Link to="/dev" style={{ color: 'var(--accent)' }}>read one</Link>.
        </p>
      </div>
    )
  }
  const mins = Math.max(1, Math.round(summary.estSeconds / 60))
  return (
    <div>
      <h1 className="text-[1.0625rem] font-medium mb-1">
        {summary.count} cards · about {mins} minute{mins === 1 ? '' : 's'}
      </h1>
      <p className="mb-4" style={{ color: 'var(--text-dim)' }}>
        Budgeted in minutes, not in cards — a session you abandon halfway is worse than a short one.
      </p>
      {/* The domain mix is visible BEFORE you start: interleaving is the mechanism,
          so it should not be a surprise. */}
      <div className="flex gap-px mb-2 rounded overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
        {summary.domains.map(([d, n]) => (
          <div key={d} title={`${d}: ${n}`} style={{ flex: n, background: 'var(--accent)', opacity: 0.35 + 0.65 * (n / summary.count) }} />
        ))}
      </div>
      <p className="mb-6 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        {summary.domains.map(([d, n]) => `${d} ${n}`).join(' · ')}
        {summary.newCount > 0 && ` · ${summary.newCount} new`}
      </p>
      <button ref={startRef} onClick={onStart} className="px-4 py-2 rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        Start <kbd className="ml-1 font-mono text-[11px] opacity-70">↵</kbd>
      </button>
    </div>
  )
}

function Progress({ cursor, total, queue }: { cursor: number; total: number; queue: { domain: string }[] }) {
  return (
    <div className="mb-8">
      <div className="flex gap-px mb-2" style={{ height: 4 }}>
        {queue.map((q, i) => (
          <div key={i} style={{
            flex: 1,
            background: i < cursor ? 'var(--accent)' : i === cursor ? 'var(--text-dim)' : 'var(--border)',
          }} title={q.domain} />
        ))}
      </div>
      <div className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{cursor + 1}/{total}</div>
    </div>
  )
}

function Summary({ session }: { session: Parameters<typeof summarise>[0] }) {
  const s = summarise(session, session.endedAt ?? session.startedAt)
  const pct = s.graded ? Math.round((s.correct / s.graded) * 100) : 0
  return (
    <div>
      {/* Wrong-then-right leads, not accuracy: it is the number that says the
          session TAUGHT something rather than measuring what was already known. */}
      <h1 className="text-[1.0625rem] font-medium mb-1">
        {s.wrongThenRight > 0
          ? `${s.wrongThenRight} card${s.wrongThenRight === 1 ? '' : 's'} went from wrong to right.`
          : 'Nothing needed a second attempt today.'}
      </h1>
      <p className="mb-6" style={{ color: 'var(--text-dim)' }}>
        {s.graded} graded · {pct}% first-attempt · {Math.round(s.elapsedSeconds / 60)} min
      </p>
      <table className="mb-6" style={{ fontSize: '0.8125rem' }}>
        <tbody>
          {s.byVerbKind.map(k => (
            <tr key={k.kind}>
              <td className="pr-4 py-0.5 font-mono" style={{ color: 'var(--text-faint)' }}>{k.kind}</td>
              <td className="py-0.5" style={{ color: 'var(--text)' }}>{k.correct}/{k.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: 'var(--text-faint)' }}>
        There is no Next button. Come back when the scheduler says so.
      </p>
    </div>
  )
}
