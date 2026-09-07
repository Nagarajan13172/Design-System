/**
 * A redeploy replaces hashed chunks, so a dynamic import issued by an already-open
 * tab 404s. Without recovery that is a white screen on every deploy.
 */
export function retryImport<T>(load: () => Promise<T>, attempts = 2): Promise<T> {
  return load().catch(async (err: unknown) => {
    if (attempts <= 0) throw err
    await new Promise(r => setTimeout(r, 300))
    return retryImport(load, attempts - 1)
  })
}
