#!/usr/bin/env bash
# Every gate must go RED on a real violation. A gate nobody has seen fail is not a
# gate — it is a script that happens to exit 0. Each case below applies one
# deliberate violation, asserts the gate rejects it, and restores the tree.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
BACKUP=$(mktemp -d)

restore() { for f in "$@"; do [ -f "$BACKUP/$(basename "$f")" ] && cp "$BACKUP/$(basename "$f")" "$f"; done; }
backup()  { for f in "$@"; do cp "$f" "$BACKUP/$(basename "$f")"; done; }

# expect_red <name> <command...>  — the command MUST exit non-zero
expect_red() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  \033[31mGATE DID NOT FIRE\033[0m  %s\n' "$name"; fail=$((fail+1))
  else
    printf '  \033[32mred\033[0m   %s\n' "$name"; pass=$((pass+1))
  fi
}
expect_green() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  \033[32mgreen\033[0m %s\n' "$name"; pass=$((pass+1))
  else
    printf '  \033[31mBASELINE BROKEN\033[0m  %s\n' "$name"; fail=$((fail+1))
  fi
}

LINT="npx tsx scripts/lint-content.ts"
ES="npx eslint --no-warn-ignored"

echo "baseline"
expect_green "lint:content passes on a clean tree" $LINT
expect_green "eslint passes on a clean tree" npx eslint src content scripts

echo
echo "content gates"
CUR=content/_curriculum.ts
CLAIMS=content/state/state-races/claims.ts
SIM=content/state/state-races/sim.ts
META=content/state/state-races/meta.ts
backup "$CUR" "$CLAIMS" "$SIM" "$META"

perl -0pi -e "s/(id: 'state-races'.*?prereqs: \[)/\${1}'state-does-not-exist', /s" "$CUR"
expect_red "dangling prereq id" $LINT
restore "$CUR"

perl -0pi -e "s/(figureQuestion: 'With no guard at all)/\${1} Really?/" "$CUR"
expect_red "figure question is two sentences" $LINT
restore "$CUR"

perl -0pi -e "s/(figureQuestion: ')([^']*)'/\${1}This is a statement, not a question.'/ if \$. " "$CUR"
perl -0pi -e "s/figureQuestion: 'With no guard at all[^']*'/figureQuestion: 'This is a statement and not interrogative.'/" "$CUR"
expect_red "figure question is not interrogative" $LINT
restore "$CUR"

perl -0pi -e "s/status: 'drafted'/status: 'deep'/ if /state-races/ .. /^  \},/" "$CUR"
expect_red "status 'deep' with null reviewedBy" $LINT
restore "$CUR"

# 8 annotations on one frame, and 3 animated channels
perl -0pi -e "s/(annotations: \[note\('a1', 'user', reqs\[0\]!\.dispatch, \`debounce \\\$\{p\.debounceMs\}ms\`\))\]/\${1}, note('x1','user',1,'a'), note('x2','user',2,'b'), note('x3','user',3,'c'), note('x4','user',4,'d'), note('x5','user',5,'e'), note('x6','user',6,'f'), note('x7','user',7,'g')]/" "$SIM"
expect_red "8 annotations on a single frame" $LINT
restore "$SIM"

perl -0pi -e "s/channels: \['requests'\], explains: 'state-races-c1'/channels: ['requests','screen','ghost'], explains: 'state-races-c1'/" "$SIM"
expect_red "3 animated channels on a single frame" $LINT
restore "$SIM"

# a claim in another module sharing >=3 concept-token groups
mkdir -p content/state/state-taxonomy
cat > content/state/state-taxonomy/meta.ts <<'EOF'
import type { ModuleMeta } from '../../types'
const meta: ModuleMeta = { id: 'state-taxonomy', status: 'drafted', sources: [], reviewedBy: null, reviewedAt: null,
  figure: { id: 'f', question: 'Which of the three failures fires first in production?', primitive: 'StateMatrix', control: 'rank' } }
export default meta
EOF
cat > content/state/state-taxonomy/claims.ts <<'EOF'
import type { Claim } from '../../types'
const claims: Claim[] = [
  { id: 'state-taxonomy-c1', assertion: 'Duplicated on purpose to prove the one-owner gate fires.', evidence: 'derivation',
    conceptTokens: [['order','sequence','ordering'],['arrive','arrival','complete','completion'],['dispatch','issue','sent','fired']], probes: ['state-taxonomy-i1'] },
  { id: 'state-taxonomy-c2', assertion: 'A second claim so the module satisfies the 4-8 claim rule.', evidence: 'derivation', conceptTokens: [['a']], probes: ['state-taxonomy-i2'] },
  { id: 'state-taxonomy-c3', assertion: 'A third claim so the module satisfies the 4-8 claim rule.', evidence: 'derivation', conceptTokens: [['b']], probes: ['state-taxonomy-i3'] },
  { id: 'state-taxonomy-c4', assertion: 'A fourth claim so the module satisfies the 4-8 claim rule.', evidence: 'derivation', conceptTokens: [['c']], probes: ['state-taxonomy-i4'] },
]
export default claims
EOF
cat > content/state/state-taxonomy/items.ts <<'EOF'
import type { Item } from '../../types'
const items: Item[] = [
  { id: 'state-taxonomy-i1', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c1', prompt: 'x' },
  { id: 'state-taxonomy-i2', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c2', prompt: 'x' },
  { id: 'state-taxonomy-i3', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c3', prompt: 'x' },
  { id: 'state-taxonomy-i4', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c4', prompt: 'x' },
]
export default items
EOF
echo "placeholder" > content/state/state-taxonomy/body.mdx
perl -0pi -e "s/(id: 'state-taxonomy'.*?)status: 'planned'/\${1}status: 'drafted'/s" "$CUR"
expect_red "two modules claiming the same idea (one-owner rule)" $LINT
restore "$CUR"; rm -rf content/state/state-taxonomy

echo
echo "ADR wall (eslint)"
T=src/__gate__.ts
run_es() { printf '%s\n' "$1" > "$T"; $ES "$T" >/dev/null 2>&1; local rc=$?; rm -f "$T"; return $rc; }
expect_red "ADR-6: import dagre"        bash -c "printf 'import x from \"dagre\"\nexport default x\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-5: import framer-motion" bash -c "printf 'import { motion } from \"framer-motion\"\nexport default motion\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-6: import @xyflow/react" bash -c "printf 'import x from \"@xyflow/react\"\nexport default x\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-1: import @tanstack/react-query" bash -c "printf 'import x from \"@tanstack/react-query\"\nexport default x\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-3: idb outside src/data/repo" bash -c "printf 'import { openDB } from \"idb\"\nexport default openDB\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-7: ts-fsrs outside the adapter" bash -c "printf 'import { fsrs } from \"ts-fsrs\"\nexport default fsrs\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "no aggregate of the three axes" bash -c "printf 'export const overallScore = 1\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "SIM CONTRACT: Date.now() in a sim" bash -c "mkdir -p src/__g__; printf 'export const t = Date.now()\n' > src/__g__/sim.ts; npx eslint src/__g__/sim.ts; rc=\$?; rm -rf src/__g__; exit \$rc"
expect_red "SIM CONTRACT: Math.random() in a sim" bash -c "mkdir -p src/__g__; printf 'export const r = Math.random()\n' > src/__g__/sim.ts; npx eslint src/__g__/sim.ts; rc=\$?; rm -rf src/__g__; exit \$rc"
expect_red "SIM CONTRACT: React imported into a sim" bash -c "mkdir -p src/__g__; printf 'import React from \"react\"\nexport default React\n' > src/__g__/sim.ts; npx eslint src/__g__/sim.ts; rc=\$?; rm -rf src/__g__; exit \$rc"

echo
echo "the mechanism"
expect_red "prediction gate degraded into a CSS overlay" bash -c "
  cp src/kit/Playground.tsx $BACKUP/pg.bak
  perl -0pi -e \"s/\\(prediction \\? run\\(\\) : null\\)/run()/\" src/kit/Playground.tsx
  npx vitest run src/kit/Playground.test.tsx >/dev/null 2>&1; rc=\$?
  cp $BACKUP/pg.bak src/kit/Playground.tsx; exit \$rc"

echo
echo "tests"
expect_red "a claim whose sim contradicts it" bash -c "
  cp content/state/state-races/claims.ts $BACKUP/c.bak
  perl -0pi -e \"s/evidence: 'specification'/evidence: 'measurement'/\" content/state/state-races/claims.ts
  npx vitest run content/state/state-races >/dev/null 2>&1; rc=\$?
  cp $BACKUP/c.bak content/state/state-races/claims.ts; exit \$rc"

echo
rm -rf "$BACKUP"
printf '%d gates verified, %d failures\n' "$pass" "$fail"
exit $((fail > 0))
