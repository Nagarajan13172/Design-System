import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { loadModule, BUILT_IDS } from 'virtual:module-loader'
import { MODULES } from 'virtual:manifest-lite'
import type { Claim, Item, ItemId, ClaimId, ObjectiveVerb, Tier } from '@content/types'
import { cards, reviews, attempts, sessions, prefs } from '@/data/repo'
import { requestPersistence, storageHealth } from '@/data/repo/persist'
import type { CardRow } from '@/data/repo/schema'
import { createScheduler } from '@/domain/scheduler/adapter'
import { buildQueue, queueSummary, DEFAULT_BUDGET_SECONDS, type QueueItem } from '@/domain/scheduler/queue'
import { rollingP75 } from '@/domain/scheduler/p75'
import { deriveRating, fromSelfRating, type AttemptGrading, type DerivedRating } from '@/domain/grading/types'
import { reduce, initialSession, summarise, ratable } from './session'
import { pickProbe } from './probeRotation'
import { useApp } from '@/store'

/** Content for every built module, loaded once and indexed by claim. */
interface Corpus {
  claims: Map<ClaimId, Claim>
  items: Map<ItemId, Item>
  moduleOf: Map<ClaimId, string>
  verbOf: Map<string, ObjectiveVerb>
  tierOf: Map<string, Tier>
}

async function loadCorpus(): Promise<Corpus> {
  const c: Corpus = { claims: new Map(), items: new Map(), moduleOf: new Map(), verbOf: new Map(), tierOf: new Map() }
  const meta = new Map(MODULES.map(m => [m.id, m]))
  for (const id of BUILT_IDS) {
    const m = await loadModule(id)
    for (const cl of m.claims) { c.claims.set(cl.id, cl); c.moduleOf.set(cl.id, id) }
    for (const it of m.items) c.items.set(it.id, it)
    const lite = meta.get(id)
    if (lite) { c.tierOf.set(id, lite.tier) }
  }
  return c
}

const today = () => new Date().toISOString().slice(0, 10)

export function useReview(now: () => number = Date.now) {
  const [session, dispatch] = useReducer(reduce, initialSession)
  const [corpus, setCorpus] = useState<Corpus | null>(null)
  const [deck, setDeck] = useState<QueueItem[] | null>(null)
  const scheduler = useRef(createScheduler())
  const cardRows = useRef(new Map<ClaimId, CardRow>())
  // State, not a ref: the probe is computed during render, and refs may not be
  // read there. It changes at most once per graded card.
  const [lastKind, setLastKind] = useState<Record<ClaimId, string>>({})
  const touchStreak = useApp(s => s.touchStreak)

  // Buffer grades and flush every 5 cards (and on hide). A killed tab loses at
  // most four ratings instead of the whole session.
  const buffer = useRef<{ card: CardRow; review: Parameters<typeof reviews.append>[0][number]; attempt: Parameters<typeof attempts.append>[0][number] }[]>([])

  const flush = useCallback(async () => {
    const batch = buffer.current
    if (!batch.length) return
    buffer.current = []
    await Promise.all([
      cards.putMany(batch.map(b => b.card)),
      reviews.append(batch.map(b => b.review)),
      attempts.append(batch.map(b => b.attempt)),
    ])
  }, [])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); void flush() }
  }, [flush])

  /** Build today's deck: seconds-budgeted, interleaved across domains. */
  const prepare = useCallback(async () => {
    const c = corpus ?? await loadCorpus()
    if (!corpus) setCorpus(c)

    // Every claim in a built module gets a card the first time it is seen.
    const existing = new Map((await cards.all()).map(r => [r.id, r]))
    const fresh: CardRow[] = []
    for (const [claimId, moduleId] of c.moduleOf) {
      if (!existing.has(claimId)) {
        const row = scheduler.current.init(claimId, moduleId, now())
        fresh.push(row); existing.set(claimId, row)
      }
    }
    if (fresh.length) await cards.putMany(fresh)
    cardRows.current = existing

    const prevModule = await prefs.get<string | null>('lastModule', null)
    const kindFor = (row: CardRow) => {
      const claim = c.claims.get(row.id)
      const probe = claim ? pickProbe(claim, c.items, lastKind[row.id] ?? null) : null
      return probe?.kind ?? 'claim-recall'
    }
    const q = buildQueue([...existing.values()], now(), {
      budgetSeconds: DEFAULT_BUDGET_SECONDS, previousModuleId: prevModule,
    }, kindFor)
    setDeck(q)
    return q
  }, [corpus, now, lastKind])

  const start = useCallback(async () => {
    const q = deck ?? await prepare()
    dispatch({ type: 'start', queue: q, now: now(), budgetSeconds: DEFAULT_BUDGET_SECONDS })
  }, [deck, prepare, now])

  const grade = useCallback(async (g: AttemptGrading) => {
    const item = session.queue[session.cursor]
    if (!item || !corpus) return
    const t = now()
    const row = cardRows.current.get(item.cardId)
    const claim = corpus.claims.get(item.cardId)
    const probe = claim ? pickProbe(claim, corpus.items, lastKind[item.cardId] ?? null) : null
    const rehearsal = !!session.missed[item.cardId]

    if (row && probe) {
      // THE FIREWALL, at the only place it can be crossed.
      let rating: DerivedRating | null = null
      if (g.kind === 'auto') {
        const past = (await reviews.byCard(item.cardId)).filter(r => r.itemKind === probe.kind).map(r => r.latencyMs)
        rating = deriveRating(g, rollingP75(past, probe.kind))
      } else if (g.kind === 'self-rating') {
        rating = fromSelfRating(g)
      }
      // g.kind === 'self' produces NO rating. There is no function that would.

      if (rating !== null && !rehearsal) {
        const { card: post } = scheduler.current.next(row, rating, t)
        cardRows.current.set(item.cardId, post)
        const strip = ({ id: _i, moduleId: _m, status: _s, ...rest }: CardRow) => rest
        buffer.current.push({
          card: post,
          review: { id: `${item.cardId}|${t}`, cardId: item.cardId, ts: t, rating, itemId: probe.id, itemKind: probe.kind, latencyMs: t - session.cardStartedAt, pre: strip(row), post: strip(post) },
          attempt: { id: `${probe.id}|${t}`, itemId: probe.id, moduleId: item.moduleId, claimId: item.cardId, itemKind: probe.kind, ts: t, grading: g, rehearsal },
        })
        setLastKind(k => ({ ...k, [item.cardId]: probe.kind }))
      }
      if (buffer.current.length >= 5) await flush()
    }

    dispatch({ type: 'grade', grading: g, now: t })
    await prefs.set('lastModule', item.moduleId)
  }, [session, corpus, now, flush, lastKind])

  // End of session: persist, and touch the streak.
  const ended = session.phase === 'summary'
  useEffect(() => {
    if (!ended) return
    void (async () => {
      await flush()
      const s = summarise(session, now())
      await sessions.put({
        id: `s|${session.startedAt}`, startedAt: session.startedAt, endedAt: now(),
        budgetSeconds: session.budgetSeconds, graded: s.graded, correct: s.correct, wrongThenRight: s.wrongThenRight,
      })
      if (session.answered.filter(ratable).length > 0) await touchStreak(today())

      // Persistence is requested AFTER a completed session, never on cold load.
      // Browsers weigh engagement, so asking a visitor who has done nothing is the
      // reliable way to get refused — and a refusal is remembered.
      const asked = await prefs.get('persistAsked', false)
      if (!asked) {
        await prefs.set('persistAsked', true)
        await prefs.set('persistGranted', await requestPersistence())
      }
      // Quota is checked once per session end, so pressure surfaces before it bites.
      const health = await storageHealth()
      if (health.pressure != null) await prefs.set('storagePressure', health.pressure)
      // Fold attempts older than 90 days into summaries, but only under pressure:
      // a learner with room keeps their full history.
      const { rollupIfPressured } = await import('@/data/repo/rollup')
      await rollupIfPressured(now())
    })()
  }, [ended]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = session.queue[session.cursor]
  const claim = current && corpus ? corpus.claims.get(current.cardId) ?? null : null
  const probe = claim && corpus ? pickProbe(claim, corpus.items, lastKind[claim.id] ?? null) : null

  return {
    session, deck, summary: deck ? queueSummary(deck) : null,
    claim, probe, prepare, start, grade,
    end: () => dispatch({ type: 'end', now: now() }),
    skip: () => dispatch({ type: 'skip', now: now() }),
  }
}
