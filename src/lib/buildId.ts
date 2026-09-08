/**
 * Stale-deploy detection.
 *
 * `build-id.txt` is served `no-store`, so a tab that has been open across a deploy
 * can find out. This matters because our assets are immutable and hashed: after a
 * redeploy the chunk an open tab is about to request no longer exists, and a naive
 * dynamic import white-screens the app.
 */
// Guarded: `define` supplies this in the app build, and a bare reference would
// throw a ReferenceError anywhere it does not — which is how a build-time constant
// took down an unrelated component test.
export const CURRENT_BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

const RELOAD_GUARD = 'fesd:reload-attempted'

export async function remoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch('/build-id.txt', { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.text()).trim()
  } catch { return null }
}

export async function isStale(): Promise<boolean> {
  const remote = await remoteBuildId()
  return remote != null && remote !== CURRENT_BUILD
}

/**
 * The guard decision, separated from the side effect so it can be asserted.
 *
 * Without it a genuinely broken chunk turns into an infinite reload loop, which is
 * a worse failure than the white screen it replaced — and a loop is very hard to
 * catch end-to-end, because each iteration destroys the evidence.
 */
export function shouldReload(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD)) return false
    sessionStorage.setItem(RELOAD_GUARD, '1')
    return true
  } catch {
    // Private mode: accept the small risk of one extra reload over refusing to recover.
    return true
  }
}

export function reloadOnce(): boolean {
  if (!shouldReload()) return false
  location.reload()
  return true
}

export function clearReloadGuard() {
  try { sessionStorage.removeItem(RELOAD_GUARD) } catch { /* ignore */ }
}

/** A failed dynamic import looks like this across browsers. */
export const isChunkError = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i
    .test(String((e as Error)?.message ?? e))
