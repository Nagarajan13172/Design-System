import { setDegraded } from './index'

/**
 * STORAGE DURABILITY.
 *
 * With no backend the browser is the only copy, and browsers delete it. Safari's
 * ITP evicts IndexedDB for non-installed sites after ~7 days idle — which would
 * silently remove the months of review history that IS this product's value.
 *
 * We cannot prevent that. We can bound it, and we can be honest about it.
 */

export interface StorageHealth {
  persisted: boolean
  usageBytes: number | null
  quotaBytes: number | null
  /** Above 0.8 we start folding old attempts into summaries. */
  pressure: number | null
}

/**
 * Requested AFTER the first completed review session, never on cold load.
 *
 * Asking on first paint is the reliable way to get denied: browsers weigh
 * engagement, and a visitor who has done nothing has none. Asking after someone
 * has finished a session asks at the moment they have demonstrably invested.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch { return false }
}

export async function storageHealth(): Promise<StorageHealth> {
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false
  let usageBytes: number | null = null, quotaBytes: number | null = null
  try {
    const est = await navigator.storage?.estimate?.()
    usageBytes = est?.usage ?? null
    quotaBytes = est?.quota ?? null
  } catch { /* not supported */ }
  const pressure = usageBytes != null && quotaBytes ? usageBytes / quotaBytes : null
  if (pressure != null && pressure > 0.95) setDegraded(true)
  return { persisted, usageBytes, quotaBytes, pressure }
}

/**
 * iOS never grants persistence to a tab, only to an installed PWA. Detecting the
 * situation lets us say the true thing ("add this to your home screen, or export
 * weekly") instead of a reassuring one.
 */
export function isEvictionProne(): boolean {
  const ua = navigator.userAgent
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  return iOS && !standalone
}

/** Nudge cadence: after every 5th session, and unconditionally past 7 days. */
export function shouldNudgeExport(sessionCount: number, lastExportAt: number | null, now: number): boolean {
  if (lastExportAt == null) return sessionCount >= 3
  if (now - lastExportAt > 7 * 86_400_000) return true
  return sessionCount > 0 && sessionCount % 5 === 0
}
