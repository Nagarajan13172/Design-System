/**
 * `pnpm gen:items <moduleId>` — drafts items from a module's claims.
 *
 * Written AFTER three modules were hand-authored, deliberately: a generator built
 * before there was real data to generalise from would have encoded guesses about
 * what an item looks like. These three shapes are the ones that turned out to
 * repeat.
 *
 * It PRINTS drafts. It does not write items.ts — a generated item still needs an
 * author to check that the distractor is genuinely plausible and the band is
 * genuinely the right band. The generator removes typing, not judgment.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CURRICULUM } from '../content/_curriculum'
import type { Claim } from '../content/types'

const [, , moduleId] = process.argv
if (!moduleId) { console.error('usage: pnpm gen:items <module-id>'); process.exit(2) }

const entry = CURRICULUM.find(m => m.id === moduleId)
if (!entry) { console.error(`\`${moduleId}\` is not in content/_curriculum.ts`); process.exit(1) }

const dir = join('content', entry.domain, entry.id)
if (!existsSync(join(dir, 'claims.ts'))) { console.error(`${dir}/claims.ts does not exist yet`); process.exit(1) }

const claims = (await import(join(process.cwd(), dir, 'claims.ts'))).default as Claim[]
const existing = existsSync(join(dir, 'items.ts'))
  ? ((await import(join(process.cwd(), dir, 'items.ts'))).default as { primaryClaim: string }[])
  : []
const covered = new Set(existing.map(i => i.primaryClaim))

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
let n = existing.length

/** cloze: blank the load-bearing tokens — the first alternative of each AND group. */
function cloze(c: Claim): string | null {
  const targets = c.conceptTokens.map(g => g[0]).filter((t): t is string => !!t)
  // Blanks must be ordered by ORDER OF APPEARANCE, not by concept-token order:
  // the renderer pairs blanks[i] with accept[i] positionally, so sorting by the
  // wrong key silently maps every accept list onto the wrong blank.
  const present = targets
    .map(t => ({ t, at: c.assertion.toLowerCase().search(new RegExp(`\\b${t.toLowerCase()}\\b`)) }))
    .filter(x => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
    .map(x => x.t)
  if (present.length < 1) return null
  let prompt = c.assertion
  for (const t of present) prompt = prompt.replace(new RegExp(`\\b${t}\\b`, 'i'), '______')
  const accept = present.map((t, i) => {
    const alts = c.conceptTokens.find(g => g[0] === t) ?? [t]
    return `${i}: [${alts.map(q).join(', ')}]`
  })
  return `  { id: ${q(`${c.id.replace(/-c(\d+)$/, '-i')}${++n}`)}, kind: 'cloze', primaryClaim: ${q(c.id)},
    prompt: ${q(prompt)},
    payload: { blanks: [${present.map(q).join(', ')}], accept: { ${accept.join(', ')} } } },`
}

/** mcq-rationale: the distractor is the MISCONCEPTION, not a random alternative. */
function mcq(c: Claim): string | null {
  if (!c.misconception) return null
  return `  { id: ${q(`${c.id.replace(/-c(\d+)$/, '-i')}${++n}`)}, kind: 'mcq-rationale', primaryClaim: ${q(c.id)},
    prompt: 'TODO: pose the situation this claim decides.',
    payload: {
      options: ['TODO: the claim, as an action', ${q(c.misconception)}, 'TODO: a third option', 'TODO: a fourth option'],
      correct: 0,
      rationales: [
        'TODO: because <the mechanism>',
        'TODO: a reason that justifies the RIGHT answer for the WRONG reason',
        'TODO', 'TODO',
      ],
      correctRationale: 0,
    } },`
}

/** constraint-flip: straight from flipCondition — the workhorse, generated. */
function flip(c: Claim): string | null {
  if (!c.flipCondition) return null
  return `  { id: ${q(`${c.id.replace(/-c(\d+)$/, '-i')}${++n}`)}, kind: 'constraint-flip', primaryClaim: ${q(c.id)},
    prompt: ${q(`The situation changes: ${c.flipCondition} Which way does the outcome move, and by how much?`)},
    payload: { direction: 'up', bands: ['<2%', '2-10%', '10-25%', '>25%'], correctBand: 1,
      flipParameter: 'TODO: the one parameter that decides it' } },`
}

const drafts: string[] = []
for (const c of claims) {
  if (covered.has(c.id)) continue
  for (const gen of [cloze, mcq, flip]) {
    const out = gen(c)
    if (out) drafts.push(out)
  }
}

if (!drafts.length) {
  console.log(`every claim in ${moduleId} already has an item. Nothing to draft.`)
  process.exit(0)
}

console.log(`// ${drafts.length} drafts for ${moduleId} — REVIEW EVERY ONE before pasting into items.ts.`)
console.log('// A generated distractor is only useful if it is a belief someone actually holds.\n')
console.log(drafts.join('\n'))
console.log(`\n// uncovered claims: ${claims.filter(c => !covered.has(c.id)).map(c => c.id).join(', ') || 'none'}`)
