import { loadModule } from 'virtual:module-loader'

/**
 * Prefetch a module chunk on hover or focus.
 *
 * Guarded three ways: never twice for the same id, never when the user has asked to
 * save data, and never for a module that is not built (there is no chunk).
 */
const done = new Set<string>()

export function prefetchModule(id: string) {
  if (done.has(id)) return
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return
  done.add(id)
  void loadModule(id).catch(() => { done.delete(id) })
}
