# ADR-1 — Our own router (revised)

**Status.** Revised during M2. The original decision was "React Router v7 in library mode".

**Decision.** `src/lib/router.tsx`, ~130 lines: a location store over the History API
(`useSyncExternalStore`), a path matcher with `:param` and `*`, plus `Link`, `Navigate`,
`useParams`, `useNavigate` and a route announcer that moves focus on navigation. Every
route stays `React.lazy` behind `retryImport()`. All navigation is imported from
`@/lib/nav`.

**Why the reversal.** Measured, not assumed: react-router v7 is **34.14 kB gz**, and the
landing route came in at **108.29 kB against a 95 kB budget**. The original ADR-1 had
already forbidden loaders, actions, and data APIs — which is most of what react-router v7
*is*. We were paying for a data router and using a path matcher.

This is the same reasoning as ADR-5 (no animation library) and ADR-6 (no graph library):
when the part of a library that justifies its size is the part we deliberately do not use,
hand-rolling the part we do use is both smaller and simpler. An app whose thesis is bundle
discipline is measured on its own landing page before anyone reads a word of the curriculum.

**Result.** Landing route 108.29 kB → **77.49 kB gz**, with 17.5 kB of headroom for M3–M5.

**Cost we accepted.** We own routing bugs. `src/lib/router.test.tsx` covers the matcher,
param decoding, route ordering, `Navigate`, client-side `Link`, modified-click passthrough,
browser back, and focus-on-route-change.

**Deliberately not implemented.** Loaders, actions, nested or relative routes, search-param
helpers, navigation blockers, view transitions. Any of those is a new ADR, not a quiet
addition.

**Rejected.** react-router v7 (34 kB for twelve static routes), react-router-dom, TanStack
Router (another type-generation pipeline), TanStack Query and SWR (there is no server).

**Enforced by.** `no-restricted-imports` on `react-router` and `react-router-dom`, and the
95 kB landing budget in `.size-limit.json`.
