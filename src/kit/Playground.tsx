import { useMemo, useState } from 'react'
import type { ModuleMeta, Timeline, Annotation } from '@content/types'
import { Figure } from '../primitives/Figure'
import { useTimelineHead } from './useTimelineHead'
import { PredictionGate } from './PredictionGate'
import { createMemoryStore, type PredictionStore, type PredictionRecord } from './predictionStore'

/**
 * THE PLAYGROUND SHELL.
 *
 * The prediction gate is a DATA DEPENDENCY, not a CSS overlay:
 * `sim.run()` is not called until a PredictionRecord exists, so before the gate
 * opens there is nothing in the DOM to inspect, nothing to reach by deep link, and
 * nothing revealed by disabling JavaScript. This audience defeats an overlay in a
 * week, which is exactly why the mechanism is structural.
 */
export interface PlaygroundProps {
  meta: ModuleMeta
  setup: string
  run: (params?: Record<string, unknown>) => Timeline<unknown>
  store?: PredictionStore
}

export function Playground({ meta, setup, run, store }: PlaygroundProps) {
  const [s] = useState<PredictionStore>(() => store ?? createMemoryStore())
  const [prediction, setPrediction] = useState<PredictionRecord | undefined>(() => s.get(meta.figure.id))

  // THE GATE. No prediction => the sim is never invoked.
  const timeline = useMemo(
    () => (prediction ? run() : null),
    [prediction, run],
  )

  const frames = timeline?.frames ?? []
  const head = useTimelineHead(Math.max(1, frames.length))
  const current = frames[Math.min(head.frame, frames.length - 1)]
  const stage = timeline?.stages.filter(st => st.frame <= head.frame).at(-1)

  const [showGhost, setShowGhost] = useState(true)

  // Reduced motion: composite every annotation at once, numbered, instead of
  // revealing them over time.
  const annotations: Annotation[] = head.reduced && frames.length
    ? frames.flatMap(f => f.annotations)
    : current?.annotations ?? []
  const shownState = head.reduced ? frames.at(-1)?.state : current?.state

  const commit = (r: PredictionRecord) => { s.commit(r); setPrediction(s.get(meta.figure.id)) }

  return (
    <section className="rounded border" style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
      <header className="px-4 pt-4">
        {setup && <p className="mb-2" style={{ color: 'var(--text-dim)', maxWidth: '48rem' }}>{setup}</p>}
        {/* Exactly ONE stated question per figure. */}
        <h2 id={`${meta.figure.id}-q`} className="font-medium" style={{ color: 'var(--text)', maxWidth: '48rem' }}>
          {meta.figure.question}
        </h2>
      </header>

      <div className="p-4">
        {!prediction ? (
          <>
            {/* The scaffold renders so the learner can see WHAT they are predicting
                about — but it carries no data. */}
            <Figure primitive={meta.figure.primitive} state={null} annotations={[]} labelledBy={`${meta.figure.id}-q`} />
            <div className="mt-4"><PredictionGate figure={meta.figure} onCommit={commit} /></div>
          </>
        ) : (
          <>
            <Figure
              primitive={meta.figure.primitive}
              state={shownState ?? null}
              annotations={annotations}
              ghost={timeline?.ghost?.frames.at(-1)?.state ?? null}
              showGhost={showGhost}
              composite={head.reduced}
              labelledBy={`${meta.figure.id}-q`}
            />

            {/* Narration is a by-product of eager frames, and it is what a screen
                reader gets instead of the SVG. */}
            <p aria-live="polite" className="mt-3 min-h-[2.5rem]" style={{ color: 'var(--text-dim)', maxWidth: '48rem' }}>
              {head.reduced ? frames.map(f => f.narration).join(' ') : current?.narration}
            </p>

            {!head.reduced && (
              <div className="mt-3 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-dim)' }}>
                <button onClick={head.play} className="px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                  {head.playing ? 'Pause' : 'Play'}
                </button>
                <button onClick={() => head.step(-1)} className="px-2 py-1 rounded border" aria-label="previous stage (k)"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>k ←</button>
                <button onClick={() => head.step(1)} className="px-2 py-1 rounded border" aria-label="next stage (j)"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>j →</button>
                <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={head.frame}
                       onChange={e => head.seek(Number(e.target.value))} className="w-40" aria-label="scrub through stages" />
                <span className="font-mono text-[12px]">{head.frame + 1}/{frames.length}</span>
                {stage && <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>· {stage.label}</span>}
                <button onClick={head.reset} className="px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>Reset</button>
                <label className="flex items-center gap-1 text-[12px] ml-auto">
                  <input type="checkbox" checked={showGhost} onChange={e => setShowGhost(e.target.checked)} />
                  {timeline?.ghost?.label ?? 'baseline'}
                </label>
              </div>
            )}

            {timeline?.readout && (
              <dl className="mt-4 flex gap-6 flex-wrap pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                {Object.entries(timeline.readout).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="font-mono" style={{ color: 'var(--text)' }}>{String(v)}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>you predicted</dt>
                  <dd className="font-mono" style={{ color: 'var(--accent)' }}>{String(prediction.value)} · {prediction.confidence}% sure</dd>
                </div>
              </dl>
            )}
          </>
        )}
      </div>
    </section>
  )
}
