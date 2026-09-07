import type { FigureId } from '@content/types'

/**
 * A committed prediction. Immutable once written: the whole mechanism depends on
 * the learner not being able to revise after seeing the answer.
 */
export interface PredictionRecord {
  figureId: FigureId
  value: number | string | string[]
  /** 50-100. Recorded separately so the calibration scatter has an axis. */
  confidence: number
  committedAt: number
}

export interface PredictionStore {
  get(figureId: FigureId): PredictionRecord | undefined
  commit(rec: PredictionRecord): void
  clear(figureId: FigureId): void
}

/**
 * M1 uses an in-memory store because /dev deliberately writes no progress.
 * M2 replaces this with the IDB repository — the interface is the seam.
 */
export function createMemoryStore(): PredictionStore {
  const m = new Map<FigureId, PredictionRecord>()
  return {
    get: id => m.get(id),
    commit: rec => { if (!m.has(rec.figureId)) m.set(rec.figureId, rec) },
    clear: id => { m.delete(id) },
  }
}
