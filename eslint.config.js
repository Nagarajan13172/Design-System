import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * THE ADR WALL.
 *
 * Every rule enforces a decision recorded in docs/adr/ and names its ADR in the
 * message. These are not style preferences: each is a decision a future
 * contributor would otherwise reverse by reaching for the obvious library. The
 * rejected option must be unavailable, not merely discouraged.
 *
 * NOTE ON FLAT CONFIG: a later block REPLACES `no-restricted-imports` rather than
 * merging into it. Narrower blocks must therefore restate the whole list minus
 * their exemption, which is why the rule is composed by `restrict()` below instead
 * of written out per block. Getting this wrong silently disables most of the wall
 * — scripts/verify-gates.sh exists because it did exactly that once.
 */

/**
 * ONE definition, shared. The three axes (Coverage / Mastery / Confidence) have
 * three units and three visual languages; no aggregate of them exists anywhere in
 * the type graph. Two regexes in two configs would drift and let each other's
 * forbidden names through, so there is exactly one.
 */
const AGGREGATE_NAMES = /^(overall|overallScore|overallProgress|totalProgress|totalScore|percentComplete|completionPct|completionRate)$/

const LIBRARY_BANS = [
  // ADR-1 — React Router v7 in LIBRARY mode. There is no server.
  ['react-router-dom', 'ADR-1: import from `react-router` (library mode). react-router-dom is the data-router surface we rejected.'],
  ['swr', 'ADR-1: no server-cache library. There is no server; reads are local IDB cursors.'],
  // ADR-2 — Zustand + immer is the only global store.
  ...['redux', '@reduxjs/toolkit', 'jotai', 'valtio', 'recoil', 'mobx']
    .map(n => [n, 'ADR-2: Zustand + immer is the only global store.']),
  // ADR-3 — one persistence library.
  ...['dexie', 'localforage'].map(n => [n, 'ADR-3: `idb` behind src/data/repo/** is the only durable store.']),
  // ADR-5 — no animation library.
  ['framer-motion', 'ADR-5: no animation library (~19kb gz). Motion is CSS transitions + the shared useTimelineHead rAF loop; our animation is a frame index into a precomputed timeline.'],
  ...['motion', 'react-spring', 'gsap'].map(n => [n, 'ADR-5: no animation library. See src/kit/useTimelineHead.']),
  // ADR-6 — no graph library; layout is computed at build time and committed.
  ['@xyflow/react', 'ADR-6: no graph library. /roadmap is a hand-rolled <svg> over build-time-committed coordinates (~48kb gz saved).'],
  ['reactflow', 'ADR-6: no graph library.'],
  ...['dagre', 'elkjs', 'd3-hierarchy'].map(n => [n, 'ADR-6: layout is scripts/layout-roadmap.ts at BUILD time, not a runtime or dev dependency.']),
  // ADR-8 + cut list — code drills are build-time Shiki tokens; zero editor bytes ship.
  ['monaco-editor', 'ADR-8: code drills are build-time Shiki tokens. Monaco is ~1MB in an app whose thesis is bundle discipline.'],
  ['@monaco-editor/react', 'ADR-8: code drills are build-time Shiki tokens.'],
  ['@codesandbox/sandpack-react', 'ADR-8: code drills are build-time Shiki tokens. Sandpack is a bundler in the browser.'],
  ['codemirror', 'ADR-8: CodeMirror in v1 requires its own ADR naming the modules that need it.'],
  ['@excalidraw/excalidraw', 'CUT: the architecture canvas is a fixed typed-port palette (machine-gradable). Free-drawn output cannot be scored.'],
  // CUT — charts are the shared Plot2D primitive.
  ...['recharts', 'chart.js', 'd3'].map(n => [n, 'CUT: every chart is built from the shared Plot2D primitive. A 90kb chart lib for a handful of instruments is pure waste.']),
  // CUT — Intl is in the platform.
  ...['date-fns', 'dayjs', 'moment'].map(n => [n, 'CUT: use Intl.DateTimeFormat / Intl.NumberFormat / Intl.RelativeTimeFormat.']),
  // CUT — search is a build-time inverted index + ~60 lines of scoring.
  ...['fuse.js', 'flexsearch', 'minisearch'].map(n => [n, 'CUT: search is a build-time inverted index.']),
]

const PATTERN_BANS = [
  { group: ['@tanstack/*'], message: 'ADR-1/ADR-2: no TanStack Router (a second type-generation pipeline) and no TanStack Query (there is no server).' },
  { group: ['@dnd-kit/*'], message: 'CUT: every drag drill has a click-to-assign equivalent that is cheaper, keyboard-accessible by default, and works on mobile.' },
  { group: ['@visx/*', '@nivo/*'], message: 'CUT: use the Plot2D primitive.' },
]

const NODE_BUILTINS = {
  group: ['node:*', 'fs', 'path', 'crypto', 'child_process'],
  message: 'The app is a browser bundle. Node built-ins belong in scripts/ or vite/.',
}

/** Composes the full ban list minus the named exemptions. */
const restrict = ({ allowIdb = false, allowFsrs = false, allowNode = false, banReact = false } = {}) => ['error', {
  paths: [
    ...LIBRARY_BANS.map(([name, message]) => ({ name, message })),
    ...(allowIdb ? [] : [{ name: 'idb', message: 'ADR-3: `idb` may only be imported inside src/data/repo/**. One import site means one place to test migrations, enforce transaction boundaries, and handle QuotaExceededError.' }]),
    ...(allowFsrs ? [] : [{ name: 'ts-fsrs', message: 'ADR-7: `ts-fsrs` may only be imported inside src/domain/scheduler/**. The single import site plus complete pre/post review snapshots is what makes the algorithm swappable without discarding history.' }]),
    ...(banReact ? [{ name: 'react', message: 'SIM CONTRACT: a sim is pure and has no React import. viz.tsx renders frames; sim.ts computes them.' }] : []),
  ],
  patterns: [...PATTERN_BANS, ...(allowNode ? [] : [NODE_BUILTINS])],
}]

const SIM_SYNTAX = [
  { selector: "MemberExpression[object.name='Date'][property.name='now']", message: 'SIM CONTRACT: no Date.now() in a sim. Time is a parameter; the caller injects the clock. A non-deterministic sim cannot be scrubbed, replayed, or tested against its claim.' },
  { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'SIM CONTRACT: no Math.random() in a sim. Use the injected seeded rng so a figure renders identically on every visit and in every test.' },
  { selector: "MemberExpression[object.name='performance'][property.name='now']", message: 'SIM CONTRACT: no performance.now() in a sim. Time is a parameter.' },
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'SIM CONTRACT: no `new Date()` in a sim. Time is a parameter.' },
]

const NO_AGGREGATE = {
  selector: `Identifier[name=${AGGREGATE_NAMES}]`,
  message: 'Coverage, Mastery and Confidence are three axes with three units. No aggregate of them exists anywhere in the type graph — a blended percentage is the exact lie this product is built to avoid.',
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'content/_generated', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}', 'content/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': restrict(),
      'no-restricted-syntax': ['error', NO_AGGREGATE],
    },
  },

  // ADR-3: `idb` has exactly one import site.
  { files: ['src/data/repo/**/*.ts'], rules: { 'no-restricted-imports': restrict({ allowIdb: true }) } },

  // ADR-7: ts-fsrs has exactly one import site, behind `interface Scheduler`.
  { files: ['src/domain/scheduler/**/*.ts'], rules: { 'no-restricted-imports': restrict({ allowFsrs: true }) } },

  /**
   * THE SIM CONTRACT. A sim is pure and returns the entire deterministic frame
   * sequence eagerly — that is what makes scrubbing free, reduced motion trivial,
   * narration a by-product, and the pedagogical claim unit-testable.
   */
  {
    files: ['**/sim.ts', 'src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict({ banReact: true }),
      'no-restricted-syntax': ['error', ...SIM_SYNTAX, NO_AGGREGATE],
    },
  },

  // Node-side tooling is not the browser bundle.
  {
    files: ['scripts/**/*.ts', 'vite/**/*.ts', '*.config.ts'],
    rules: { 'no-restricted-imports': 'off', 'no-restricted-syntax': 'off' },
  },
)
