# ADR-6 — No graph library; layout is computed at build time

**Decision.** `/roadmap`'s map is a hand-rolled `<svg>` (~300 lines): `<rect>` nodes and `<path>` edges positioned from build-time-committed coordinates, pan/zoom by a single `viewBox` transform, `aria-hidden` and `tabIndex={-1}` throughout. Layout is computed by `scripts/layout-roadmap.ts` (layered ordering + barycenter crossing reduction) and committed with an edge-set hash the build verifies.

**Why.** Reversed during design review, like ADR-5. `@xyflow/react` is 45–50kb gz for pan, zoom and select over coordinates we already commit — over a third of the entire `/review` budget, spent on the screen we ourselves call the least load-bearing. The semantic list is the primary DOM anyway, which makes the canvas a progressive enhancement rather than the interface.

**Rejected.** `@xyflow/react`, `reactflow`. `elkjs` / `dagre` / `d3-hierarchy` at runtime **or** as devDependencies — the layered layout is ~200 lines and runs once per deploy.
