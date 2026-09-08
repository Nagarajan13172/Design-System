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

/** True when at least one alternative from the group appears in the text. */
export function groupPresent(text: string, group: string[]): boolean {
  const t = ` ${normalise(text)} `
  return group.some(alt => t.includes(` ${normalise(alt)} `) || t.includes(`${normalise(alt)} `))
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
