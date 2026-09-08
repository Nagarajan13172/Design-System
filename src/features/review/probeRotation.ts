import type { Claim, Item, ItemId } from '@content/types'

/**
 * Which probe a due card shows today.
 *
 * A card is a CLAIM, and a claim has several probes of different kinds. Showing the
 * same probe every time trains recognition of that probe rather than the idea, so
 * the rotation never repeats the previous KIND for a card if it can avoid it.
 */
export function pickProbe(
  claim: Claim, items: Map<ItemId, Item>, lastKind: string | null,
): Item | null {
  const probes = claim.probes.map(id => items.get(id)).filter((i): i is Item => !!i)
  if (!probes.length) return null
  const different = probes.filter(p => p.kind !== lastKind)
  const pool = different.length ? different : probes
  // Deterministic per (claim, lastKind): the same card in the same state always
  // shows the same probe, so a session can be replayed in a test.
  const seed = [...claim.id + (lastKind ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return pool[seed % pool.length]!
}
