/**
 * `pnpm new:module <domain> <id>` — the authoring loop's front door.
 *
 * This script is the difference between module #57 costing 10 hours and 25. It
 * refuses unknown ids (the curriculum is the source of truth, not the filesystem),
 * generates stable claim ids, and emits a sim that already renders so the author
 * starts from a working figure rather than a blank file.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CURRICULUM } from '../content/_curriculum'

const [, , domainArg, idArg] = process.argv
if (!idArg) {
  console.error('usage: pnpm new:module <domain> <module-id>')
  process.exit(2)
}

const entry = CURRICULUM.find(m => m.id === idArg)
if (!entry) {
  const near = CURRICULUM.filter(m => m.id.includes(idArg.split('-').slice(1).join('-'))).slice(0, 5)
  console.error(`\`${idArg}\` is not in content/_curriculum.ts.`)
  console.error('The curriculum is the source of truth: add the entry there first, so the roadmap,')
  console.error('the prereq graph and the search index all learn about it at the same time.')
  if (near.length) console.error(`\nDid you mean: ${near.map(m => m.id).join(', ')}`)
  process.exit(1)
}
if (entry.domain !== domainArg) {
  console.error(`\`${idArg}\` belongs to domain \`${entry.domain}\`, not \`${domainArg}\`.`)
  process.exit(1)
}

const dir = join('content', entry.domain, entry.id)
if (existsSync(dir)) {
  console.error(`${dir} already exists (status: ${entry.status}).`)
  process.exit(1)
}

const tpl = (name: string) =>
  readFileSync(join('templates', 'module', name), 'utf8')
    .replaceAll('__ID__', entry.id)
    .replaceAll('__TITLE__', entry.title.replace(/'/g, "\\'"))
    .replaceAll('__VERB__', entry.verb)
    .replaceAll('__PRIMITIVE__', entry.primitive)
    .replaceAll('__QUESTION__', entry.figureQuestion.replace(/'/g, "\\'"))
    .replaceAll('__ONELINER__', entry.oneLiner.replace(/'/g, "\\'"))

mkdirSync(dir, { recursive: true })
for (const f of readdirSync(join('templates', 'module'))) {
  writeFileSync(join(dir, f.replace(/\.tpl$/, '')), tpl(f))
}

console.log(`\ncreated ${dir}`)
console.log(`  ${entry.title}`)
console.log(`  verb: ${entry.verb}   primitive: ${entry.primitive}   estimate: ${entry.authorHours.estimate}h\n`)
console.log(`  question: ${entry.figureQuestion}\n`)
console.log('next:')
console.log(`  1. set status to 'drafted' for ${entry.id} in content/_curriculum.ts`)
console.log(`  2. pnpm dev  ->  /dev/module/${entry.id}`)
console.log(`  3. write sim.ts first, then assert its claims in sim.test.ts, then the prose\n`)
