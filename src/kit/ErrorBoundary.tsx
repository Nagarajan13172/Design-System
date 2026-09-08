import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkError } from '@/lib/buildId'

/**
 * Per-route and per-visual error boundaries.
 *
 * With ~169 lazily-loaded module chunks and a bespoke simulation in each one, a
 * single throwing figure would otherwise take down the whole page. A figure that
 * fails should cost the figure, not the prose around it and not the session.
 */
interface Props {
  children: ReactNode
  /** What broke, in words the learner can act on. */
  label: string
  /** A visual boundary degrades in place; a route boundary offers a way out. */
  kind?: 'visual' | 'route'
  onError?: (e: Error) => void
}

interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No error service (there is no backend). The console is the honest destination.
    console.error(`[${this.props.label}]`, error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A chunk error after a deploy is not a bug — it is a stale tab, and it has its
    // own recovery path. Saying "something went wrong" would be actively misleading.
    if (isChunkError(error)) {
      return (
        <Fallback title="This page was updated while you had it open."
                  detail="Your progress is saved. Reload to get the new version." />
      )
    }

    if (this.props.kind === 'visual') {
      return (
        <div className="rounded border border-dashed p-4 text-[13px]"
             style={{ borderColor: 'var(--d-error)', color: 'var(--d-error-text)' }}>
          This figure failed to render. The rest of the module still works — and the
          claims below are what it was there to demonstrate.
        </div>
      )
    }

    return <Fallback title={`${this.props.label} failed to load.`} detail={error.message} />
  }
}

function Fallback({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-5">
      <div className="rounded border p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', maxWidth: '34rem' }}>
        <h1 className="font-medium mb-1" style={{ color: 'var(--text)' }}>{title}</h1>
        <p className="mb-4" style={{ color: 'var(--text-dim)' }}>{detail}</p>
        <button onClick={() => location.reload()} className="px-3 py-1.5 rounded"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          Reload
        </button>
      </div>
    </div>
  )
}
