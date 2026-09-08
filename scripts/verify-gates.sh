#!/usr/bin/env bash
# Every gate must go RED on a real violation. A gate nobody has seen fail is not a
# gate — it is a script that happens to exit 0. Each case below applies one
# deliberate violation, asserts the gate rejects it, and restores the tree.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
BACKUP=$(mktemp -d)

# This script edits the working tree to prove gates fire, so it must leave the tree
# exactly as it found it. A previous version rm -rf'd a content directory it had not
# backed up and deleted an authored module; this check makes that loud.
CONTENT_BEFORE=$(find content src -type f | sort | xargs md5 2>/dev/null | md5)
trap 'AFTER=$(find content src -type f | sort | xargs md5 2>/dev/null | md5); \
  if [ "$AFTER" != "$CONTENT_BEFORE" ]; then \
    printf "\033[31mFATAL: verify-gates.sh changed content/ or src/ and did not restore it\033[0m\n"; exit 2; fi; \
  rm -rf "$BACKUP"' EXIT

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

# A claim in another module sharing >=3 concept-token groups.
#
# NOTE: this gate needs a REAL curriculum id (lint only loads modules the curriculum
# knows about), so it borrows one and must put back whatever was there. An earlier
# version rm -rf'd the directory unconditionally and deleted an authored module.
DUP=content/state/state-taxonomy
STASH="$BACKUP/dup-stash"
[ -d "$DUP" ] && mv "$DUP" "$STASH"
mkdir -p "$DUP"
cat > "$DUP/meta.ts" <<'EOF'
import type { ModuleMeta } from '../../types'
const meta: ModuleMeta = { id: 'state-taxonomy', status: 'drafted', sources: [], reviewedBy: null, reviewedAt: null,
  figure: { id: 'f', question: 'Which of the three failures fires first in production?', primitive: 'StateMatrix', control: 'rank' } }
export default meta
EOF
cat > "$DUP/claims.ts" <<'EOF'
import type { Claim } from '../../types'
const claims: Claim[] = [
  { id: 'dup-c1', assertion: 'Duplicated on purpose to prove the one-owner gate fires.', evidence: 'derivation',
    conceptTokens: [['order','sequence','ordering'],['arrive','arrival','complete','completion'],['dispatch','issue','sent','fired']], probes: ['dup-i1'] },
  { id: 'dup-c2', assertion: 'A second claim so the module satisfies the 4-8 claim rule.', evidence: 'derivation', conceptTokens: [['a']], probes: ['dup-i2'] },
  { id: 'dup-c3', assertion: 'A third claim so the module satisfies the 4-8 claim rule.', evidence: 'derivation', conceptTokens: [['b']], probes: ['dup-i3'] },
  { id: 'dup-c4', assertion: 'A fourth claim so the module satisfies the 4-8 claim rule.', evidence: 'derivation', conceptTokens: [['c']], probes: ['dup-i4'] },
]
export default claims
EOF
cat > "$DUP/items.ts" <<'EOF'
import type { Item } from '../../types'
const items: Item[] = [
  { id: 'dup-i1', kind: 'claim-recall', primaryClaim: 'dup-c1', prompt: 'x' },
  { id: 'dup-i2', kind: 'claim-recall', primaryClaim: 'dup-c2', prompt: 'x' },
  { id: 'dup-i3', kind: 'claim-recall', primaryClaim: 'dup-c3', prompt: 'x' },
  { id: 'dup-i4', kind: 'claim-recall', primaryClaim: 'dup-c4', prompt: 'x' },
]
export default items
EOF
echo placeholder > "$DUP/body.mdx"
perl -0pi -e "s/(id: 'state-taxonomy'.*?)status: 'planned'/\${1}status: 'drafted'/s" "$CUR"
expect_red "two modules claiming the same idea (one-owner rule)" $LINT
restore "$CUR"
rm -rf "$DUP"
[ -d "$STASH" ] && mv "$STASH" "$DUP"

perl -0pi -e "s/explains: 'state-taxonomy-c1'/explains: 'state-taxonomy-c5'/" content/state/state-taxonomy/sim.ts
expect_red "a sim frame asserting an authored opinion" $LINT
perl -0pi -e "s/explains: 'state-taxonomy-c5'/explains: 'state-taxonomy-c1'/" content/state/state-taxonomy/sim.ts

echo
echo "ADR wall (eslint)"
T=src/__gate__.ts
run_es() { printf '%s\n' "$1" > "$T"; $ES "$T" >/dev/null 2>&1; local rc=$?; rm -f "$T"; return $rc; }
expect_red "ADR-6: import dagre"        bash -c "printf 'import x from \"dagre\"\nexport default x\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-5: import framer-motion" bash -c "printf 'import { motion } from \"framer-motion\"\nexport default motion\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-6: import @xyflow/react" bash -c "printf 'import x from \"@xyflow/react\"\nexport default x\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-1: import @tanstack/react-query" bash -c "printf 'import x from \"@tanstack/react-query\"\nexport default x\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-1: import react-router" bash -c "printf 'import { Link } from \"react-router\"\nexport default Link\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-3: idb outside src/data/repo" bash -c "printf 'import { openDB } from \"idb\"\nexport default openDB\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "ADR-7: ts-fsrs outside the adapter" bash -c "printf 'import { fsrs } from \"ts-fsrs\"\nexport default fsrs\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "no aggregate of the three axes" bash -c "printf 'export const overallScore = 1\n' > $T; npx eslint $T; rc=\$?; rm -f $T; exit \$rc"
expect_red "SIM CONTRACT: Date.now() in a sim" bash -c "mkdir -p src/__g__; printf 'export const t = Date.now()\n' > src/__g__/sim.ts; npx eslint src/__g__/sim.ts; rc=\$?; rm -rf src/__g__; exit \$rc"
expect_red "SIM CONTRACT: Math.random() in a sim" bash -c "mkdir -p src/__g__; printf 'export const r = Math.random()\n' > src/__g__/sim.ts; npx eslint src/__g__/sim.ts; rc=\$?; rm -rf src/__g__; exit \$rc"
expect_red "SIM CONTRACT: React imported into a sim" bash -c "mkdir -p src/__g__; printf 'import React from \"react\"\nexport default React\n' > src/__g__/sim.ts; npx eslint src/__g__/sim.ts; rc=\$?; rm -rf src/__g__; exit \$rc"

echo
echo "budgets"
expect_red "landing bundle over budget" bash -c "
  cp .size-limit.json $BACKUP/sl.bak
  perl -0pi -e 's/\"95 kB\"/\"40 kB\"/' .size-limit.json
  npx size-limit >/dev/null 2>&1; rc=\$?
  cp $BACKUP/sl.bak .size-limit.json; exit \$rc"

echo
echo "the kit"
expect_red "an ambiguous cloze blank" bash -c "
  cp content/state/state-races/snippets/manifest.ts $BACKUP/mf.bak
  perl -0pi -e \"s/\\{ id: 'b1', token: 'latest', occurrence: 2 \\}/{ id: 'b1', token: 'latest' }/\" content/state/state-races/snippets/manifest.ts
  npx tsx scripts/build-code.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/mf.bak content/state/state-races/snippets/manifest.ts
  npx tsx scripts/build-code.ts >/dev/null 2>&1
  exit \$rc"

expect_red "a serious axe violation on the primitive gallery" bash -c "
  cp src/styles/theme.css $BACKUP/th.bak
  perl -0pi -e \"s/--text-faint:oklch\\(50% 0.010 265\\)/--text-faint:oklch(88% 0.010 265)/\" src/styles/theme.css
  npx playwright test e2e/a11y.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/th.bak src/styles/theme.css; exit \$rc"

expect_red "a stale roadmap layout" bash -c "
  cp $CUR $BACKUP/cur2.bak
  perl -0pi -e \"s/(id: 'perf-lcp'.*?prereqs: \\[)/\\\${1}'state-races', /s\" $CUR
  npx vite build >/dev/null 2>&1; rc=\$?
  cp $BACKUP/cur2.bak $CUR; exit \$rc"

expect_red "the canvas becoming reachable by keyboard" bash -c "
  cp src/features/roadmap/MapLayer.tsx $BACKUP/ml.bak
  perl -0pi -e \"s/ aria-hidden\\n//\" src/features/roadmap/MapLayer.tsx
  perl -0pi -e \"s/<div className=\\\"fixed inset-x-0 bottom-0 border-t\\\" aria-hidden/<div className=\\\"fixed inset-x-0 bottom-0 border-t\\\"/\" src/features/roadmap/MapLayer.tsx
  npx playwright test e2e/roadmap.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/ml.bak src/features/roadmap/MapLayer.tsx; exit \$rc"

echo
echo "articulation"
expect_red "a locked defence becoming editable" bash -c "
  cp src/features/articulation/Defence.tsx $BACKUP/df.bak
  perl -0pi -e \"s/setPhase\\('reveal'\\)/setPhase('write')/\" src/features/articulation/Defence.tsx
  npx playwright test e2e/articulation.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/df.bak src/features/articulation/Defence.tsx; exit \$rc"

expect_red "a flagged criterion scoreable without evidence" bash -c "
  cp src/domain/articulation/defence.ts $BACKUP/dfd.bak
  perl -0pi -e \"s/if \\(proposed === 0\\) return \\{ allowed: true \\}/if (true) return { allowed: true }/\" src/domain/articulation/defence.ts
  npx vitest run src/domain/articulation >/dev/null 2>&1; rc=\$?
  cp $BACKUP/dfd.bak src/domain/articulation/defence.ts; exit \$rc"

expect_red "a canvas key that admits only one architecture" bash -c "
  cp content/cs/cs-autocomplete/sim.ts $BACKUP/csa.bak
  perl -0pi -e \"s/  acceptedVariants: \\[/  acceptedVariants: [].concat([/\" content/cs/cs-autocomplete/sim.ts
  perl -0pi -e \"s/\\n  \\],\\n  passThreshold/].slice(0,1)),\\n  passThreshold/\" content/cs/cs-autocomplete/sim.ts
  npx vitest run content/cs >/dev/null 2>&1; rc=\$?
  cp $BACKUP/csa.bak content/cs/cs-autocomplete/sim.ts; exit \$rc"

expect_red "a case study re-deriving a module's simulator" bash -c "
  cp content/cs/cs-autocomplete/sim.ts $BACKUP/csa2.bak
  perl -0pi -e \"s/export const measure = raceMeasure/export const measure = (p) => raceMeasure(p)/\" content/cs/cs-autocomplete/sim.ts
  npx vitest run content/cs >/dev/null 2>&1; rc=\$?
  cp $BACKUP/csa2.bak content/cs/cs-autocomplete/sim.ts; exit \$rc"

echo
echo "the ladder"
expect_red "the independent rung running on the same case" bash -c "
  cp src/routes/Case.tsx $BACKUP/case.bak
  perl -0pi -e \"s/stage === 'mini' && base.independentPartner/false \\&\\& base.independentPartner/\" src/routes/Case.tsx
  npx playwright test e2e/ladder.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/case.bak src/routes/Case.tsx; exit \$rc"

expect_red "a worked/independent pair that only shares vocabulary" bash -c "
  cp content/cs/cs-log-tail/case.ts $BACKUP/lt.bak
  perl -0pi -e \"s/'unbounded-stream', 'bounded-surface', 'edge-guard', 'ordering', 'backpressure'/'forms', 'validation'/\" content/cs/cs-log-tail/case.ts
  npx tsx scripts/lint-content.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/lt.bak content/cs/cs-log-tail/case.ts; exit \$rc"

expect_red "hints that cost nothing" bash -c "
  cp src/domain/case/ladder.ts $BACKUP/ld.bak
  perl -0pi -e \"s/export const HINT_PENALTY = 0.1/export const HINT_PENALTY = 0/\" src/domain/case/ladder.ts
  npx vitest run src/domain/case >/dev/null 2>&1; rc=\$?
  cp $BACKUP/ld.bak src/domain/case/ladder.ts; exit \$rc"

echo
echo "hardening"
expect_red "a stale deploy white-screening instead of announcing" bash -c "
  cp src/features/recovery/StaleBuildBar.tsx $BACKUP/sb.bak
  perl -0pi -e \"s/if \\(!stale\\) return null/if (true) return null/\" src/features/recovery/StaleBuildBar.tsx
  npx playwright test e2e/hardening.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/sb.bak src/features/recovery/StaleBuildBar.tsx; exit \$rc"

expect_red "a reload loop with no guard" bash -c "
  cp src/lib/buildId.ts $BACKUP/bi.bak
  perl -0pi -e \"s/if \\(sessionStorage.getItem\\(RELOAD_GUARD\\)\\) return false/if (false) return false/\" src/lib/buildId.ts
  npx vitest run src/lib >/dev/null 2>&1; rc=\$?
  cp $BACKUP/bi.bak src/lib/buildId.ts; exit \$rc"

expect_red "settings dropping the local-only warning" bash -c "
  cp src/routes/Settings.tsx $BACKUP/st.bak
  perl -0pi -e \"s/in this browser and nowhere else/stored safely/\" src/routes/Settings.tsx
  npx playwright test e2e/hardening.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/st.bak src/routes/Settings.tsx; exit \$rc"

echo
echo "the mechanism"
expect_red "self-graded evidence allowed to move Mastery" bash -c "
  cp src/domain/axes/mastery.ts $BACKUP/ms.bak
  perl -0pi -e \"s/if \\(i.grading.kind !== 'auto'\\) return null//\" src/domain/axes/mastery.ts
  npx vitest run src/domain >/dev/null 2>&1; rc=\$?
  cp $BACKUP/ms.bak src/domain/axes/mastery.ts; exit \$rc"

expect_red "within-session retries re-rated as fresh evidence" bash -c "
  cp src/features/review/session.ts $BACKUP/ss.bak
  perl -0pi -e \"s/export const ratable = \\(a: Answered\\) => !a.rehearsal/export const ratable = (_a: Answered) => true/\" src/features/review/session.ts
  npx vitest run src/features >/dev/null 2>&1; rc=\$?
  cp $BACKUP/ss.bak src/features/review/session.ts; exit \$rc"

expect_red "recall gate merely covering the page instead of replacing it" bash -c "
  cp src/routes/Module.tsx $BACKUP/mod.bak
  perl -0pi -e \"s/  if \\(inRecall\\) \\{/  if (false) {/\" src/routes/Module.tsx
  npx playwright test e2e/gate.spec.ts >/dev/null 2>&1; rc=\$?
  cp $BACKUP/mod.bak src/routes/Module.tsx; exit \$rc"

expect_red "coverage moved by something other than the recall gate" bash -c "
  cp src/domain/axes/index.ts $BACKUP/ax.bak
  perl -0pi -e \"s/coverage: existing\\?\\.coverage \\?\\? 'none',/coverage: 'covered',/\" src/domain/axes/index.ts
  npx vitest run src/domain/axes >/dev/null 2>&1; rc=\$?
  cp $BACKUP/ax.bak src/domain/axes/index.ts; exit \$rc"

expect_red "a mastery kind graded without its rationale screen" bash -c "
  cp src/domain/grading/index.ts $BACKUP/gr.bak
  perl -0pi -e \"s/const score = optOk && whyOk \\? 1 : optOk \\? 0.4 : 0/const score = optOk ? 1 : 0/\" src/domain/grading/index.ts
  npx vitest run src/domain/grading >/dev/null 2>&1; rc=\$?
  cp $BACKUP/gr.bak src/domain/grading/index.ts; exit \$rc"

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
printf '%d gates verified, %d failures\n' "$pass" "$fail"
exit $((fail > 0))
