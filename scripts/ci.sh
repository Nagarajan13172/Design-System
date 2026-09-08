#!/usr/bin/env bash
# Every gate, in the order that fails fastest. This is what CI runs.
set -e
cd "$(dirname "$0")/.."
echo "==> typecheck";     npx tsc --noEmit
echo "==> lint";          npx eslint src content scripts eslint.config.js
echo "==> lint:content";  npx tsx scripts/lint-content.ts
echo "==> test";          npx vitest run
echo "==> build";         npx vite build
echo "==> size";          npx size-limit
echo "==> e2e";           npx playwright test
echo "==> gates";         ./scripts/verify-gates.sh
