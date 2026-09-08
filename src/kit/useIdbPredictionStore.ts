import { useEffect, useRef, useState } from 'react'
import { predictions } from '@/data/repo'
import type { PredictionStore, PredictionRecord } from './predictionStore'
import type { ModuleId } from '@content/types'

/**
 * The Playground's store is synchronous because rendering is; IndexedDB is not.
 * So: hydrate once into memory, serve reads from there, and persist writes behind
 * the scenes. The record stays IMMUTABLE in both layers — a second commit for the
 * same figure is ignored, not overwritten.
 */
export function useIdbPredictionStore(moduleId: ModuleId) {
  const mem = useRef(new Map<string, PredictionRecord>())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      const all = await predictions.all()
      if (!live) return
      mem.current = new Map(all.filter(p => p.moduleId === moduleId).map(p => [p.figureId, {
        figureId: p.figureId, value: p.value, confidence: p.confidence, committedAt: p.committedAt,
      }]))
      setReady(true)
    })()
    return () => { live = false }
  }, [moduleId])

  // useState with an initializer, not useRef: the object is stable either way, but
  // a ref may not be READ during render.
  const [store] = useState<PredictionStore>(() => ({
    get: id => mem.current.get(id),
    commit: rec => {
      if (mem.current.has(rec.figureId)) return
      mem.current.set(rec.figureId, rec)
      void predictions.commit({ ...rec, moduleId })
    },
    clear: id => { mem.current.delete(id) },
  }))

  return { store, ready }
}
