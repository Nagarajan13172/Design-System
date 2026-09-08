/**
 * CONCEPT TOKENS — AND-of-ORs, one implementation, used by the recall gate and the
 * Trade-off Defense reveal and nothing else.
 *
 * Token presence is ALWAYS A FLAG, NEVER A SCORE. It is trivially gamed by keyword
 * stuffing, which is exactly why it is evidence for the learner to weigh rather than
 * a grade the machine assigns. It can never move Mastery or the scheduler.
 */

const normalise = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * True when at least one alternative from the group appears in the text.
 *
 * Matching is on WORD STEMS, not whole words: an author who lists `cancel` means to
 * catch "cancelling" and "cancelled" too, and requiring them to enumerate every
 * inflection makes the flag under-report exactly when the learner wrote a good
 * answer. Multi-word alternatives are matched as phrases.
 *
 * The 4-character floor is what keeps the prefix rule from matching noise.
 */
export function groupPresent(text: string, group: string[]): boolean {
  const words = normalise(text).split(' ').filter(Boolean)
  const haystack = ` ${words.join(' ')} `
  return group.some(raw => {
    const alt = normalise(raw)
    if (!alt) return false
    if (alt.includes(' ')) return haystack.includes(` ${alt} `)
    if (alt.length < 4) return words.includes(alt)          // short tokens: exact only
    return words.some(w => w.startsWith(alt))
  })
}

export interface TokenReport {
  /** One entry per AND group, in order. */
  present: boolean[]
  missing: string[][]
  allPresent: boolean
}

export function tokenPresence(text: string, groups: string[][]): TokenReport {
  const present = groups.map(g => groupPresent(text, g))
  return {
    present,
    missing: groups.filter((_, i) => !present[i]),
    allPresent: present.every(Boolean),
  }
}

/** Word count, for the recall gate's soft 40-120 target. */
export const wordCount = (s: string) => normalise(s).split(' ').filter(Boolean).length
