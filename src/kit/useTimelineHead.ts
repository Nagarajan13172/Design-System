import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * ADR-5's replacement for an animation library.
 *
 * ONE rAF loop writes the head position into a ref; derived state is published at
 * <= 30Hz so a scrub does not re-render the shell 60 times a second. Our animation
 * is a frame INDEX into an already-computed timeline, so there is nothing to
 * interpolate and nothing for a 19kb library to do.
 *
 * `prefers-reduced-motion` short-circuits the loop entirely: the head jumps, and
 * the caller renders every annotation composited at once instead.
 */
export function useTimelineHead(frameCount: number, opts?: { fps?: number }) {
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const raf = useRef(0)
  const acc = useRef(0)
  const last = useRef(0)
  const reduced = useReducedMotion()
  const fps = opts?.fps ?? 2 // stages are semantic beats, not smooth motion

  const clamp = useCallback((n: number) => Math.max(0, Math.min(frameCount - 1, n)), [frameCount])

  const step = useCallback((d: number) => { setPlaying(false); setFrame(f => clamp(f + d)) }, [clamp])
  const seek = useCallback((n: number) => { setPlaying(false); setFrame(clamp(n)) }, [clamp])
  const reset = useCallback(() => { setPlaying(false); setFrame(0) }, [])

  useEffect(() => {
    if (!playing || reduced) return
    last.current = 0
    acc.current = 0
    const tick = (t: number) => {
      if (last.current) {
        acc.current += (t - last.current) * speed
        const per = 1000 / fps
        if (acc.current >= per) {
          acc.current = 0
          setFrame(f => {
            if (f >= frameCount - 1) { setPlaying(false); return f }
            return f + 1
          })
        }
      }
      last.current = t
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, speed, frameCount, fps, reduced])

  useEffect(() => { if (frame > frameCount - 1) setFrame(clamp(frame)) }, [frameCount, frame, clamp])

  return { frame, playing, speed, reduced, setSpeed, play: () => setPlaying(p => !p), step, seek, reset }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
