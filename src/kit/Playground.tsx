import { useEffect, useMemo, useState } from 'react'
import type { ModuleMeta, Timeline, Annotation, Item } from '@content/types'
import { Figure } from '../primitives/Figure'
import { useTimelineHead } from './useTimelineHead'
import { PredictionGate } from './PredictionGate'
import { createMemoryStore, type PredictionStore, type PredictionRecord } from './predictionStore'
import { gradeAttempt } from '@/domain/grading'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * THE PLAYGROUND SHELL.
 *
 * The prediction gate is a DATA DEPENDENCY, not a CSS overlay: `sim.run()` is not
 * called until a PredictionRecord exists, so before the gate opens there is nothing
 * in the DOM to inspect, nothing to reach by deep link, and nothing revealed by
 * disabling JavaScript. This audience defeats an overlay in a week.
 */
export interface PlaygroundProps {
  meta: ModuleMeta
  setup: string
  run: (params?: Record<string, unknown>) => Timeline<unknown>
  /** LiveSurface modules only: the author's real-DOM render function. */
  renderSurface?: (props: Record<string, unknown>) => React.ReactNode
  /** The `predict` item backing this figure, if the module authored one. */
  gateItem?: Item
  store?: PredictionStore
  onCommit?: (r: PredictionRecord, correct: boolean) => void
  now?: () => number
}

export function Playground({ meta, setup, run, renderSurface, gateItem, store, onCommit, now = () => 0 }: PlaygroundProps) {
  const [s] = useState<PredictionStore>(() => store ?? createMemoryStore())
  const [prediction, setPrediction] = useState<PredictionRecord | undefined>(() => s.get(meta.figure.id))
  const [verdict, setVerdict] = useState<{ correct: boolean; explanation?: string } | null>(null)

  // THE GATE. No prediction => the sim is never invoked.
  const timeline = useMemo(() => (prediction ? run() : null), [prediction, run])

  const frames = timeline?.frames ?? []
  const head = useTimelineHead(Math.max(1, frames.length))
  const current = frames[Math.min(head.frame, frames.length - 1)]
  const stage = timeline?.stages.filter(st => st.frame <= head.frame).at(-1)
  const [showGhost, setShowGhost] = useState(true)

  const commit = (r: PredictionRecord) => {
    s.commit(r)
    const stored = s.get(meta.figure.id)
    setPrediction(stored)

    // The wrong-answer path: scrub to the stage where THIS mental model diverges,
    // and say what the plausible-but-wrong model would have predicted. Never the
    // bare word "incorrect", which teaches nothing and closes the topic.
    if (gateItem) {
      const g = gradeAttempt(gateItem, { kind: 'predict', value: r.value }, 0)
      setVerdict({ correct: g.grading.correct, explanation: whyPlausible(gateItem, r.value) })
      if (!g.grading.correct && g.divergesAtStage != null) {
        const target = timelineStageFrame(run(), g.divergesAtStage)
        if (target != null) queueMicrotask(() => head.seek(target))
      }
      onCommit?.(r, g.grading.correct)
    }
  }

  // Reduced motion: composite every annotation at once, numbered, instead of
  // revealing them over time.
  const annotations: Annotation[] = head.reduced && frames.length
    ? frames.flatMap(f => f.annotations)
    : current?.annotations ?? []
  const shownState = head.reduced ? frames.at(-1)?.state : current?.state

  // j/k step stages, `.` toggles the ghost baseline.
  useEffect(() => {
    if (!prediction) return
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (e.key === 'j') { e.preventDefault(); head.step(1) }
      if (e.key === 'k') { e.preventDefault(); head.step(-1) }
      if (e.key === '.') { e.preventDefault(); setShowGhost(g => !g) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [prediction, head])

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
            <Figure primitive={meta.figure.primitive} renderSurface={renderSurface}
                    state={null} annotations={[]} labelledBy={`${meta.figure.id}-q`} />
            <div className="mt-4">
              <PredictionGate figure={meta.figure} options={gateOptions(gateItem)} onCommit={commit} now={now} />
            </div>
          </>
        ) : (
          <>
            <ErrorBoundary label={meta.figure.id} kind="visual">
              <div className="figure-scroll">
              <Figure
                primitive={meta.figure.primitive}
                renderSurface={renderSurface}
                state={shownState ?? null}
                annotations={annotations}
                ghost={timeline?.ghost?.frames.at(-1)?.state ?? null}
                showGhost={showGhost}
                composite={head.reduced}
                labelledBy={`${meta.figure.id}-q`}
              />
              </div>
            </ErrorBoundary>

            {/* Narration is a by-product of eager frames, and it is what a screen
                reader gets instead of the SVG. */}
            <p aria-live="polite" className="mt-3 min-h-[2.5rem]" style={{ color: 'var(--text-dim)', maxWidth: '48rem' }}>
              {head.reduced ? frames.map(f => f.narration).join(' ') : current?.narration}
            </p>

            {verdict && (
              <div className="mt-3 rounded border p-3" style={{
                borderColor: verdict.correct ? 'var(--d-work)' : 'var(--border-strong)',
                background: 'var(--surface)',
              }}>
                <p style={{ color: 'var(--text)' }}>
                  {verdict.correct
                    ? 'Your model held. The figure shows why.'
                    : verdict.explanation ?? 'The figure is scrubbed to the moment your model and the measurement part company.'}
                </p>
              </div>
            )}

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
                  {timeline?.ghost?.label ?? 'baseline'} <kbd className="font-mono text-[11px]">.</kbd>
                </label>
              </div>
            )}

            {/* Their own answer sits on the same row as the measurement, always —
                the comparison IS the mechanism, with or without a graded item. */}
            <dl className="mt-4 flex gap-6 flex-wrap pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>you predicted</dt>
                <dd className="font-mono" style={{ color: 'var(--accent)' }}>
                  {String(Array.isArray(prediction.value) ? prediction.value.join(' → ') : prediction.value)} · {prediction.confidence}% sure
                </dd>
              </div>
              {timeline?.readout && (
                Object.entries(timeline.readout).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="font-mono" style={{ color: 'var(--text)' }}>{String(v)}</dd>
                  </div>
                ))
              )}
            </dl>
          </>
        )}
      </div>
    </section>
  )
}

/** `whyPlausible` explains the model the learner was using, not that they were wrong. */
function whyPlausible(item: Item, value: unknown): string | undefined {
  const p = (item.payload ?? {}) as { whyPlausible?: Record<string, string> }
  if (!p.whyPlausible) return undefined
  const key = Array.isArray(value) ? value.join(',') : String(value)
  return p.whyPlausible[key]
    ?? p.whyPlausible[Number(value) > 50 ? 'high' : Number(value) < 1 ? 'zero' : 'low']
}

function gateOptions(item?: Item): string[] | undefined {
  const p = (item?.payload ?? {}) as { correct?: unknown; options?: string[] }
  if (p.options) return p.options
  if (Array.isArray(p.correct)) return [...p.correct].sort()   // rank: present unordered
  return undefined
}

function timelineStageFrame(tl: Timeline<unknown>, stageIndex: number): number | null {
  return tl.stages[stageIndex]?.frame ?? null
}
