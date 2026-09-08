/**
 * `pnpm lint:content` — the content gate.
 *
 * Content is structured data (ADR-4), and every product mechanism reads that
 * structure: the scheduler, the mastery model, the recall gate, the search index,
 * the roadmap. So the structure is checked in CI, from the first commit.
 *
 * This gate is red on a real violation and green otherwise. It is NOT allowed to
 * be permanently red "until we fix the ids later" — a permanently red gate is not
 * a gate, it is a disabled one, which is why the id cleanup landed in M1.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { CURRICULUM, DOMAINS } from '../content/_curriculum'
import { MASTERY_KINDS, JUDGMENT_VERBS } from '../content/types'
import type { Claim, Item, ModuleMeta, Timeline, ModuleId } from '../content/types'

type Level = 'error' | 'warn'
interface Finding { level: Level; check: string; where: string; message: string }
const findings: Finding[] = []
const fail = (check: string, where: string, message: string) => findings.push({ level: 'error', check, where, message })
const warn = (check: string, where: string, message: string) => findings.push({ level: 'warn', check, where, message })

const DOMAIN_KEYS = DOMAINS.map(d => d.key)
const byId = new Map(CURRICULUM.map(m => [m.id, m]))
const domainTier = new Map(DOMAINS.map(d => [d.key, d.tier]))

// --- 1. schema -------------------------------------------------------------
const EntrySchema = z.object({
  id: z.string().regex(/^[a-z]+-[a-z0-9-]+$/, 'id must be kebab-case, prefixed with its domain key'),
  domain: z.enum(DOMAIN_KEYS as [string, ...string[]]),
  title: z.string().min(4),
  level: z.enum(['foundation', 'core', 'advanced', 'expert']),
  tier: z.enum(['MVP', 'tier2', 'tier3']),
  verb: z.enum(['recall', 'explain', 'compare', 'judge', 'design', 'diagnose']),
  status: z.enum(['deep', 'drafted', 'planned']),
  studyMinutes: z.number().int().min(5).max(120),
  authorHours: z.object({ estimate: z.number().min(1), actual: z.number().nullable() }),
  prereqs: z.array(z.string()),
  related: z.array(z.string()),
  oneLiner: z.string().min(20),
  figureQuestion: z.string().min(10),
  primitive: z.enum(['LaneTimeline', 'NodeGraph', 'StateMatrix', 'LiveSurface', 'Plot2D', 'CodeStage']),
})

const seen = new Set<string>()
for (const m of CURRICULUM) {
  const r = EntrySchema.safeParse(m)
  if (!r.success) for (const i of r.error.issues) fail('schema', m.id, `${i.path.join('.')}: ${i.message}`)
  if (seen.has(m.id)) fail('schema', m.id, 'duplicate module id')
  seen.add(m.id)
  if (!m.id.startsWith(m.domain + '-')) fail('schema', m.id, `id must be prefixed with its domain key \`${m.domain}-\``)
  if (m.tier !== domainTier.get(m.domain)) fail('schema', m.id, `tier ${m.tier} contradicts its domain's tier ${domainTier.get(m.domain)}`)
}

// --- 2. every prereq/related id resolves ------------------------------------
for (const m of CURRICULUM) {
  for (const p of m.prereqs) if (!byId.has(p)) fail('ids', m.id, `prereq \`${p}\` does not exist. Either author it or move the reference to \`related\`.`)
  for (const p of m.related) if (!byId.has(p)) fail('ids', m.id, `related \`${p}\` does not exist`)
  if (m.prereqs.includes(m.id) || m.related.includes(m.id)) fail('ids', m.id, 'module references itself')
  const dup = m.prereqs.filter(p => m.related.includes(p))
  if (dup.length) fail('ids', m.id, `\`${dup.join(', ')}\` is listed as both a hard prereq and related`)
}

// --- 3. acyclic, printing the actual cycle path -----------------------------
{
  const WHITE = 0, GREY = 1, BLACK = 2
  const color = new Map<ModuleId, number>(CURRICULUM.map(m => [m.id, WHITE]))
  const stack: ModuleId[] = []
  const dfs = (u: ModuleId): ModuleId[] | null => {
    color.set(u, GREY); stack.push(u)
    for (const v of byId.get(u)?.prereqs ?? []) {
      if (!byId.has(v)) continue
      if (color.get(v) === GREY) return [...stack.slice(stack.indexOf(v)), v]
      if (color.get(v) === WHITE) { const c = dfs(v); if (c) return c }
    }
    color.set(u, BLACK); stack.pop(); return null
  }
  for (const m of CURRICULUM) {
    if (color.get(m.id) !== WHITE) continue
    const cycle = dfs(m.id)
    if (cycle) fail('acyclic', cycle[0]!, `prereq cycle: ${cycle.join(' -> ')}`)
  }
}

// --- 4. hard prereqs are hard gates -----------------------------------------
for (const m of CURRICULUM) {
  if (m.prereqs.length > 2) fail('prereq-budget', m.id, `${m.prereqs.length} hard prereqs (max 2). A hard gate locks a module; everything merely related belongs in \`related\`.`)
  const cross = m.prereqs.filter(p => byId.get(p)?.domain !== m.domain)
  if (cross.length > 1) fail('prereq-budget', m.id, `${cross.length} cross-domain hard prereqs (max 1): ${cross.join(', ')}`)
}

// --- 5. the figure question --------------------------------------------------
const STOPWORDS = new Set('the a an of to in on at for and or is are was were be been it its this that with as by from what which how why when does do did you your we our they their than then if not no more less most least first second'.split(' '))
const tokens = (s: string) => s.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)?.filter(t => !STOPWORDS.has(t)) ?? []

for (const m of CURRICULUM) {
  const q = m.figureQuestion.trim()
  if (!q.endsWith('?')) {
    fail('figure-question', m.id, `figureQuestion must be interrogative: ${JSON.stringify(q.slice(0, 90))}`)
    continue
  }
  const terminators = (q.match(/[.?!]/g) ?? []).length
  if (terminators > 1) fail('figure-question', m.id, `figureQuestion must be ONE sentence (found ${terminators} terminators): ${JSON.stringify(q.slice(0, 110))}`)

  // A prediction gate a strong engineer gets right is decoration. If the question
  // already contains the claim's distinctive words, it is carrying its own answer.
  const qt = new Set(tokens(q))
  const shared = [...new Set(tokens(m.oneLiner))].filter(t => qt.has(t))
  if (shared.length >= 6) warn('figure-question', m.id, `question shares ${shared.length} distinctive tokens with its claim (${shared.slice(0, 6).join(', ')}…) — it may be giving away the answer`)
}

// --- module content (only modules that claim to have any) --------------------
interface Loaded { meta: ModuleMeta; claims: Claim[]; items: Item[]; timeline: Timeline | null }
const loaded = new Map<ModuleId, Loaded>()

for (const m of CURRICULUM) {
  const dir = join('content', m.domain, m.id)
  const present = existsSync(dir)
  if (m.status === 'planned') {
    if (present) warn('status', m.id, `status is 'planned' but ${dir} exists — flip it to 'drafted'`)
    continue
  }
  if (!present) { fail('status', m.id, `status is '${m.status}' but ${dir} does not exist`); continue }
  const files = readdirSync(dir)
  for (const f of ['meta.ts', 'claims.ts', 'items.ts', 'body.mdx']) {
    if (!files.includes(f)) fail('completeness', m.id, `missing ${f}`)
  }
}

// Dynamic import is async; run the content-dependent checks in a block.
const contentModules = CURRICULUM.filter(m => m.status !== 'planned')
for (const m of contentModules) {
  const dir = join('content', m.domain, m.id)
  if (!existsSync(dir)) continue
  try {
    const meta = (await import(join(process.cwd(), dir, 'meta.ts'))).default as ModuleMeta
    const claims = (await import(join(process.cwd(), dir, 'claims.ts'))).default as Claim[]
    const items = (await import(join(process.cwd(), dir, 'items.ts'))).default as Item[]
    let timeline: Timeline | null = null
    if (existsSync(join(dir, 'sim.ts'))) {
      const sim = await import(join(process.cwd(), dir, 'sim.ts'))
      let n = 0
      timeline = sim.run(sim.DEFAULTS ?? {}, { rng: () => ((n = (n * 1664525 + 1013904223) >>> 0) / 2 ** 32) }) as Timeline
    }
    loaded.set(m.id, { meta, claims, items, timeline })
  } catch (e) {
    fail('load', m.id, `failed to load content: ${(e as Error).message}`)
  }
}

// --- 6. completeness by status ----------------------------------------------
for (const [id, { meta, claims, items }] of loaded) {
  const m = byId.get(id)!
  // A freshly scaffolded module is legitimately incomplete. `drafted` gets a
  // warning so the gap is visible; `deep` gets a hard failure.
  const claimCount = (m: string) => `${claims.length} claims (must be 4-8). Claims are the unit the scheduler schedules; a module with 12 is two modules.${m}`
  if (claims.length < 4 || claims.length > 8) {
    if (byId.get(id)!.status === 'deep') fail('completeness', id, claimCount(''))
    else warn('completeness', id, claimCount(' — required before this can become `deep`.'))
  }

  const bodyPath = join('content', m.domain, id, 'body.mdx')
  const words = existsSync(bodyPath) ? readFileSync(bodyPath, 'utf8').split(/\s+/).filter(Boolean).length : 0

  if (m.status === 'deep') {
    if (words < 900) fail('completeness', id, `body.mdx is ${words} words (deep requires >= 900)`)
    if (!meta.reviewedBy || !meta.reviewedAt) fail('completeness', id, `status 'deep' requires reviewedBy/reviewedAt — a second reader is a hard gate. Wrong teaching content is the worst bug this product can ship.`)
    if (!meta.sources?.length) fail('completeness', id, `status 'deep' requires >= 1 source`)

    const judgment = items.filter(i => (MASTERY_KINDS as readonly string[]).includes(i.kind))
    const kinds = new Set(judgment.map(i => i.kind))
    if (judgment.length < 12) fail('completeness', id, `${judgment.length} auto-graded judgment items (deep requires >= 12)`)
    if (kinds.size < 2) fail('completeness', id, `judgment items span ${kinds.size} kind(s) (deep requires >= 2)`)
  }

  // PROBE DEPTH — the churn number.
  //
  // A card shows one probe per review, and repeating the same probe trains
  // recognition of the probe rather than the idea. With ~60 cards and one probe
  // each, a daily learner exhausts the deck in about three weeks and meets a
  // permanent empty state — which for a product (rather than a portfolio piece) is
  // the primary churn mechanism, not a polish item.
  const PROBE_TARGET = 3
  for (const c of claims) {
    const real = c.probes.filter(p => items.some(i => i.id === p))
    if (real.length < PROBE_TARGET) {
      warn('probe-depth', id, `claim \`${c.id}\` has ${real.length} probe(s); ${PROBE_TARGET}+ keeps a daily learner from seeing the same question twice within a fortnight`)
    }
  }

  // 7. orphan claims and orphan items
  const claimIds = new Set(claims.map(c => c.id))
  const covered = new Set(items.flatMap(i => [i.primaryClaim, i.secondaryClaim].filter(Boolean) as string[]))
  for (const c of claims) if (!covered.has(c.id)) fail('coverage', id, `claim \`${c.id}\` has no item probing it`)
  for (const i of items) {
    if (!claimIds.has(i.primaryClaim)) fail('coverage', id, `item \`${i.id}\` references unknown claim \`${i.primaryClaim}\``)
    if (i.secondaryClaim && !claimIds.has(i.secondaryClaim)) fail('coverage', id, `item \`${i.id}\` references unknown secondaryClaim \`${i.secondaryClaim}\``)
  }

  // 8. item kind vs the module's objective verb.
  // `predict` is exempt: it is the figure's own gate and exists on every module.
  // For other mastery kinds this is a WARNING, not an error — masteryContribution()
  // already refuses them at runtime when the verb is not a judgment verb, so the
  // author's real need is to know the items will not move Mastery, not to be blocked.
  const isJudgmentVerb = (JUDGMENT_VERBS as readonly string[]).includes(m.verb)
  if (!isJudgmentVerb) {
    const affected = items.filter(i => i.kind !== 'predict' && (MASTERY_KINDS as readonly string[]).includes(i.kind))
    if (affected.length) {
      warn('verb-binding', id, `${affected.length} mastery-kind item(s) on a '${m.verb}' module will not move Mastery (only ${JUDGMENT_VERBS.join('/')} do). They still schedule and still count for Coverage.`)
    }
  }

  // 9. An authored-heuristic claim may not be EXPLAINED BY A SIM FRAME, and may not
  // produce mastery evidence. Checked per claim, not per module: a module may
  // legitimately mix measured claims (which need a sim) with one authored opinion
  // (which must stay prose, because a test asserting a number the author invented
  // tests nothing).
  const explained = new Set((loaded.get(id)?.timeline?.frames ?? []).map(f => f.explains))
  for (const c of claims) {
    if (c.evidence !== 'authored-heuristic') continue
    if (explained.has(c.id)) fail('heuristic', id, `claim \`${c.id}\` is authored-heuristic but a sim frame explains it. Either it is measurable (change the evidence) or the frame is asserting an opinion.`)
    const masteryProbes = items.filter(i => i.primaryClaim === c.id && (MASTERY_KINDS as readonly string[]).includes(i.kind))
    if (masteryProbes.length) fail('heuristic', id, `claim \`${c.id}\` is authored-heuristic but is probed by mastery items: ${masteryProbes.map(i => i.id).join(', ')}`)
  }

  // 10. an item references at most 2 claims (full weight primary, half secondary)
  for (const i of items) if (i.secondaryClaim === i.primaryClaim) fail('coverage', id, `item \`${i.id}\` lists the same claim twice`)
}

// --- 11. cognitive load, enforced PER FRAME ---------------------------------
// A per-figure check passes a visual that animates five things at one instant.
for (const [id, { timeline, claims }] of loaded) {
  if (!timeline) continue
  const claimIds = new Set(claims.map(c => c.id))
  if (!timeline.ghost) fail('cognitive-load', id, 'figure has no ghost baseline — staged reveal requires something to compare against')
  timeline.frames.forEach((f, n) => {
    if (f.annotations.length > 7) fail('cognitive-load', id, `frame ${n}: ${f.annotations.length} annotations (max 7)`)
    if (f.channels.length > 2) fail('cognitive-load', id, `frame ${n}: ${f.channels.length} animated channels (max 2) — ${f.channels.join(', ')}`)
    if (!f.narration?.trim()) fail('cognitive-load', id, `frame ${n}: no narration (every frame is read into a live region)`)
    if (!claimIds.has(f.explains)) fail('cognitive-load', id, `frame ${n}: explains unknown claim \`${f.explains}\``)
  })
}

// --- 12. one owner per claim, across the whole curriculum -------------------
// Duplicate claims under distinct ids produce duplicate cards the interleaver
// cannot detect, so the learner reviews one idea twice and neither ever settles.
{
  const sig = (c: Claim) => c.conceptTokens.map(g => [...g].sort().join('|')).sort()
  const all = [...loaded].flatMap(([id, l]) => l.claims.map(c => ({ id, c, groups: new Set(sig(c)) })))
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!, b = all[j]!
      if (a.id === b.id) continue
      const shared = [...a.groups].filter(g => b.groups.has(g))
      if (shared.length >= 3) {
        fail('claim-ownership', `${a.id} / ${b.id}`, `claims \`${a.c.id}\` and \`${b.c.id}\` share ${shared.length} concept-token groups. One owner per claim — assign it to one module and cite it from the other.`)
      }
    }
  }
}

// --- 13. content-id stability ------------------------------------------------
// A SEMANTIC edit must mint a new id (the old card retires); an EDITORIAL edit
// keeps the id. Re-authoring a figure orphans every PredictionRecord pointing at it.
{
  const LOCK = 'content/_generated/content-ids.json'
  const { createHash } = await import('node:crypto')
  const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
  const current: Record<string, string> = {}
  for (const [id, { meta, claims }] of loaded) {
    if (byId.get(id)!.status !== 'deep') continue   // drafts are exempt until they flip
    for (const c of claims) current[c.id] = sha(c.assertion + (c.flipCondition ?? '') + JSON.stringify(c.conceptTokens))
    current[meta.figure.id] = sha(meta.figure.question + meta.figure.control)
  }
  if (existsSync(LOCK)) {
    const locked: Record<string, string> = JSON.parse(readFileSync(LOCK, 'utf8'))
    for (const [k, v] of Object.entries(current)) {
      if (locked[k] && locked[k] !== v) {
        fail('id-stability', k, `content changed but the id did not. An EDITORIAL edit bumps \`rev\`; a SEMANTIC edit must mint a new id with \`supersedes\` and retire the old card. If this was editorial, run \`pnpm lint:content --accept-ids\`.`)
      }
    }
  }
  if (process.argv.includes('--accept-ids')) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(LOCK, JSON.stringify(current, null, 1) + '\n')
    console.log(`  updated ${LOCK} (${Object.keys(current).length} ids)`)
  }
}

// --- report -----------------------------------------------------------------
const errors = findings.filter(f => f.level === 'error')
const warns = findings.filter(f => f.level === 'warn')
const group = (fs: Finding[]) => {
  const by = new Map<string, Finding[]>()
  for (const f of fs) (by.get(f.check) ?? by.set(f.check, []).get(f.check)!).push(f)
  return by
}
for (const [level, list] of [['warn', warns], ['error', errors]] as const) {
  for (const [check, fs] of group(list)) {
    console.log(`\n${level === 'error' ? 'ERROR' : 'warn '}  [${check}]  ${fs.length}`)
    for (const f of fs.slice(0, 12)) console.log(`   ${f.where}: ${f.message}`)
    if (fs.length > 12) console.log(`   … and ${fs.length - 12} more`)
  }
}
const built = CURRICULUM.filter(m => m.status !== 'planned').length
console.log(`\n${CURRICULUM.length} modules across ${DOMAINS.length} domains · ${built} built · ${CURRICULUM.length - built} specified`)
console.log(`${errors.length} errors, ${warns.length} warnings`)
process.exit(errors.length ? 1 : 0)
