import { useEffect, useState } from 'react'
import { useNavigate } from '@/lib/nav'
import { loadModule, type LoadedModule } from 'virtual:module-loader'
import { FULL } from 'virtual:manifest-full'
import { Playground } from '@kit/Playground'
import { prefs, predictions } from '@/data/repo'
import type { PredictionStore } from '@kit/predictionStore'

/**
 * /start — THE COLD OPEN.
 *
 * The first ten minutes decide whether a senior engineer stays. The default —
 * "here is the roadmap, pick something" — is the worst possible opening for this
 * audience, because they scan a topic list, conclude "I know most of this", and
 * leave.
 *
 * So the cold open is a drill that a strong engineer can plausibly get wrong, with
 * their own prediction plotted against the measurement. Before the roadmap, before
 * any placement test, before anything is explained.
 *
 * Resumable via `prefs.coldOpenBeat`: abandoning at beat 2 and coming back must
 * resume at beat 2, not restart or vanish.
 */
const COLD_OPEN_MODULE = 'state-races'
const BEATS = 3

export default function Start() {
  const navigate = useNavigate()
  const [beat, setBeat] = useState<number | null>(null)
  const [mod, setMod] = useState<LoadedModule | null>(null)
  const entry = FULL.find(m => m.id === COLD_OPEN_MODULE)

  useEffect(() => {
    let live = true
    void (async () => {
      const [saved, m] = await Promise.all([
        prefs.get<number>('coldOpenBeat', 0),
        loadModule(COLD_OPEN_MODULE),
      ])
      if (!live) return
      setBeat(saved)
      setMod(m)
    })()
    return () => { live = false }
  }, [])

  const advance = async (to: number) => {
    // PERSIST FIRST. Advancing the UI before the write lands means a learner who
    // closes the tab on the beat they just finished comes back to the previous one —
    // and "it forgot where I was" is a very cheap way to lose a first session.
    await prefs.set('coldOpenBeat', to)
    setBeat(to)
    if (to >= BEATS) navigate('/review')
  }

  if (beat == null || !mod || !entry) {
    return <Shell><p style={{ color: 'var(--text-faint)' }}>loading…</p></Shell>
  }

  const store: PredictionStore = {
    get: () => undefined,
    commit: rec => { void predictions.commit({ ...rec, moduleId: COLD_OPEN_MODULE }) },
    clear: () => {},
  }

  return (
    <Shell>
      <p className="font-mono text-[11px] mb-6" style={{ color: 'var(--text-faint)' }}
         data-beat={beat}>
        {beat + 1} of {BEATS}
      </p>

      {beat === 0 && (
        <>
          <h1 className="text-[1.0625rem] font-medium mb-2">Before anything else, one question.</h1>
          <p className="mb-6" style={{ color: 'var(--text-dim)', maxWidth: '40rem' }}>
            No introduction, no roadmap. Commit an answer and then watch it measured — that is
            the whole app, and this is the shortest honest demonstration of it.
          </p>
          <Playground
            meta={mod.meta} setup={entry.figureSetup} run={mod.sim.run}
            gateItem={mod.items.find(i => i.kind === 'predict')}
            store={store} now={() => Date.now()}
            onCommit={() => { void advance(1) }}
          />
        </>
      )}

      {beat === 1 && (
        <>
          <h1 className="text-[1.0625rem] font-medium mb-2">Your answer is on the axis now.</h1>
          <p className="mb-6" style={{ color: 'var(--text-dim)', maxWidth: '40rem' }}>
            Step through the stages with <kbd className="font-mono">j</kbd> and{' '}
            <kbd className="font-mono">k</kbd>. The measurement sits beside what you predicted;
            the gap is the point, not the score.
          </p>
          <Playground
            meta={mod.meta} setup={entry.figureSetup} run={mod.sim.run}
            gateItem={mod.items.find(i => i.kind === 'predict')}
            store={{ ...store, get: () => ({ figureId: mod.meta.figure.id, value: 4, confidence: 70, committedAt: 0 }) }}
            now={() => Date.now()}
          />
          <button onClick={() => void advance(2)} className="mt-6 px-4 py-2 rounded"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            What happens to that answer now?
          </button>
        </>
      )}

      {beat === 2 && (
        <>
          <h1 className="text-[1.0625rem] font-medium mb-2">Three axes, three units, no total.</h1>
          <div className="grid gap-4 mb-6" style={{ color: 'var(--text-dim)', maxWidth: '40rem' }}>
            <p>
              That module’s claims are now scheduled. They come back on their own, mixed with
              claims from other domains, about seven minutes a day.
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Coverage</strong> counts modules you have
              finished. <strong style={{ color: 'var(--text)' }}>Mastery</strong> is computed only
              from auto-graded judgment — and it refuses to show a number until there is enough
              evidence. <strong style={{ color: 'var(--text)' }}>Confidence</strong> is your own
              estimate, plotted against the measurement so you can see where the two disagree.
            </p>
            <p style={{ color: 'var(--text-faint)' }}>
              There is deliberately no overall score. A blended percentage would hide exactly the
              gap that is worth looking at.
            </p>
          </div>
          <button onClick={() => void advance(3)} className="px-4 py-2 rounded"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            Start the daily queue
          </button>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="font-mono text-[12px]">fesd</span>
      </header>
      <main className="px-5 py-10 mx-auto" style={{ maxWidth: '52rem' }}>{children}</main>
    </div>
  )
}
