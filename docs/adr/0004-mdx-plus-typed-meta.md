# ADR-4 — MDX body + typed `meta.ts`; content is structured data

**Decision.** One directory per module: `meta.ts`, `body.mdx`, `claims.ts`, `items.ts`, `sim.ts`, `sim.test.ts`, `viz.tsx`. Everything except the MDX body is typed, zod-validated at build time, and lintable.

**Why.** Scheduling, mastery, the recall gate, the search index, the roadmap and every lint rule read this structure. Prose alone cannot be scheduled or graded — if modules were MDX with frontmatter, none of the product's mechanisms could exist.

**Rejected.** MDX-only with frontmatter (unlintable, untypable). A headless CMS (a backend by another name). A JSON content blob (no type checking, no HMR).
