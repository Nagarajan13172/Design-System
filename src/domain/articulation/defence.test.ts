import { describe, it, expect } from 'vitest'
import { hashText, reportCriteria, criteriaWithEvidence, canScoreAbove, verifyUnedited, compare, meetsFloor } from './defence'
import type { DefencePrompt, DefenceRecord } from './types'

const prompt: DefencePrompt = {
  id: 'd1', moduleId: 'state-races', claimId: 'state-races-c4',
  situation: 'A typeahead races and sometimes shows results for a query the user has replaced.',
  question: 'Sequence numbers or AbortController?',
  options: [
    { id: 'seq', label: 'A monotonic sequence guard' },
    { id: 'abort', label: 'AbortController on every keystroke', flipParameter: 'bandwidth cost on mobile' },
  ],
  criteria: [
    {
      id: 'c-order', label: 'Distinguishes arrival order from dispatch order',
      conceptTokens: [['order', 'ordering'], ['arrive', 'arrival']],
      anchors: { weak: 'Says responses can be late.', adequate: 'Says the last response is not the last request.', strong: 'Names the condition under which one overtakes the other.' },
    },
    {
      id: 'c-cost', label: 'Names what each option costs',
      conceptTokens: [['bandwidth', 'bytes', 'wasted'], ['cancel', 'abort']],
      anchors: { weak: 'Says one is better.', adequate: 'Says abort saves bandwidth.', strong: 'Separates what is rendered from what is spent.' },
    },
  ],
  modelAnswer: 'Sequencing fixes what is rendered; cancellation fixes what is spent.',
}

const GOOD = 'Responses can arrive out of order, so the last response to arrive is not the response to the last request. A sequence guard fixes what is rendered. AbortController additionally saves bandwidth by cancelling wasted work.'
const THIN = 'I would use a sequence number because it is simpler and works well in practice for this kind of user interface problem overall.'

describe('evidence highlighting', () => {
  it('flags criteria whose concept tokens are absent from the learner’s own text', () => {
    const r = reportCriteria(prompt, THIN)
    expect(r.map(x => x.hasEvidence)).toEqual([false, false])
    expect(r[0]!.missing.length).toBeGreaterThan(0)
  })

  it('finds evidence when the concepts are genuinely present', () => {
    expect(criteriaWithEvidence(prompt, GOOD)).toBe(2)
  })

  it('is a FLAG, not a score — presence never produces a number', () => {
    const r = reportCriteria(prompt, GOOD)
    for (const x of r) expect(typeof x.hasEvidence).toBe('boolean')
  })
})

/**
 * THE FIG-LEAF TEST.
 *
 * Without this rule, self-scoring a criterion nothing in your answer supports is
 * exactly as easy as scoring one it does — which is what makes most self-assessment
 * rubrics worthless.
 */
describe('scoring a red-flagged criterion', () => {
  const flagged = reportCriteria(prompt, THIN)[0]!

  it('allows zero freely', () => {
    expect(canScoreAbove(flagged, 0, undefined, THIN).allowed).toBe(true)
  })

  it('refuses any score above zero with no selected evidence', () => {
    const r = canScoreAbove(flagged, 2, undefined, THIN)
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/Select the part of your own answer/)
  })

  it('refuses a span that is not actually in the answer', () => {
    const r = canScoreAbove(flagged, 3, 'I clearly explained arrival ordering', THIN)
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/does not appear in your answer/)
  })

  it('accepts a real span from the learner’s own text', () => {
    const span = 'because it is simpler and works well'
    expect(canScoreAbove(flagged, 2, span, THIN).allowed).toBe(true)
  })

  it('never gets in the way when the tokens ARE present', () => {
    const ok = reportCriteria(prompt, GOOD)[0]!
    expect(canScoreAbove(ok, 3, undefined, GOOD).allowed).toBe(true)
  })
})

describe('lock', () => {
  it('detects any edit after Lock', async () => {
    const text = GOOD
    const record: DefenceRecord = {
      promptId: 'd1', choiceId: 'seq', flipParameter: null, text,
      textHash: await hashText(text), lockedAt: 0, words: 40, overtimeSeconds: 0,
      selfScores: {}, evidence: {}, criteriaWithEvidence: 2,
    }
    expect(await verifyUnedited(record)).toBe(true)
    expect(await verifyUnedited({ ...record, text: text + ' and also cursors.' })).toBe(false)
  })

  it('hashes stably regardless of surrounding whitespace', async () => {
    expect(await hashText(' abc ')).toBe(await hashText('abc'))
  })
})

describe('the word floor and the day-14 comparison', () => {
  it('enforces a floor so a one-line answer cannot be locked', () => {
    expect(meetsFloor('too short')).toBe(false)
    expect(meetsFloor(Array(70).fill('word').join(' '))).toBe(true)
  })

  it('reports criteria-with-evidence then versus now, computed both times', () => {
    const c = compare(prompt, THIN, GOOD)
    expect(c).toMatchObject({ then: 0, now: 2, total: 2, delta: 2 })
  })

  it('reports a regression honestly rather than flattering the learner', () => {
    expect(compare(prompt, GOOD, THIN)).toMatchObject({ then: 2, now: 0, delta: -2 })
  })
})
