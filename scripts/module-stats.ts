/**
 * `pnpm stats` — what each authored module actually cost, measured.
 *
 * M4's exit criterion is "record authorHours.actual and re-plan on the real number".
 * These modules were authored by an agent, so REPORTING HUMAN HOURS WOULD BE A
 * FABRICATION — and the whole point of the criterion is to re-plan on a real number.
 *
 * So `authorHours.actual` stays null (it means human hours, and none were spent),
 * and this reports the artifact sizes that ARE measurable. They are the input a
 * human author needs to calibrate their own estimate: a module is roughly this much
 * prose, this many claims, this many items, and this much simulation code.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CURRICULUM } from '../content/_curriculum'
import type { Claim, Item } from '../content/types'

const lines = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(l => l.trim()).length : 0)
const words = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8').split(/\s+/).filter(Boolean).length : 0)

interface Row {
  id: string; primitive: string; estimate: number
  prose: number; claims: number; items: number; autoItems: number
  simLines: number; testLines: number; totalLines: number
}

const rows: Row[] = []
for (const m of CURRICULUM.filter(m => m.status !== 'planned')) {
  const dir = join('content', m.domain, m.id)
  if (!existsSync(join(dir, 'meta.ts'))) continue
  const claims = (await import(join(process.cwd(), dir, 'claims.ts'))).default as Claim[]
  const items = (await import(join(process.cwd(), dir, 'items.ts'))).default as Item[]
  const simLines = lines(join(dir, 'sim.ts')) + lines(join(dir, 'viz.tsx'))
  const testLines = lines(join(dir, 'sim.test.ts'))
  rows.push({
    id: m.id, primitive: m.primitive, estimate: m.authorHours.estimate,
    prose: words(join(dir, 'body.mdx')),
    claims: claims.length, items: items.length,
    autoItems: items.filter(i => !['claim-recall', 'free-recall', 'tradeoff-defense'].includes(i.kind)).length,
    simLines, testLines,
    totalLines: simLines + testLines + lines(join(dir, 'claims.ts')) + lines(join(dir, 'items.ts')) + lines(join(dir, 'meta.ts')),
  })
}

const pad = (s: string | number, n: number) => String(s).padEnd(n)
console.log(pad('module', 22) + pad('primitive', 14) + pad('est', 5) + pad('prose', 7) + pad('claims', 8) + pad('items', 7) + pad('auto', 6) + pad('sim', 6) + pad('test', 6) + 'lines')
for (const r of rows) {
  console.log(pad(r.id, 22) + pad(r.primitive, 14) + pad(r.estimate + 'h', 5) + pad(r.prose, 7) +
    pad(r.claims, 8) + pad(r.items, 7) + pad(r.autoItems, 6) + pad(r.simLines, 6) + pad(r.testLines, 6) + r.totalLines)
}

const avg = (f: (r: Row) => number) => Math.round(rows.reduce((s, r) => s + f(r), 0) / Math.max(1, rows.length))
console.log('\n' + pad('MEAN', 22) + pad('', 14) + pad(avg(r => r.estimate) + 'h', 5) + pad(avg(r => r.prose), 7) +
  pad(avg(r => r.claims), 8) + pad(avg(r => r.items), 7) + pad(avg(r => r.autoItems), 6) +
  pad(avg(r => r.simLines), 6) + pad(avg(r => r.testLines), 6) + avg(r => r.totalLines))

console.log(`\n${rows.length} modules authored. authorHours.actual is null for all of them:`)
console.log('it means HUMAN hours, and recording a number nobody spent would defeat the')
console.log('purpose of the exit criterion, which is to re-plan against reality.')
const withActual = CURRICULUM.filter(m => m.authorHours.actual != null)
console.log(`modules with a recorded human figure: ${withActual.length}`)
