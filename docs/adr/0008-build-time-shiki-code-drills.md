# ADR-8 — Code drills are build-time Shiki tokens

**Decision.** Shiki runs at build time only, in `vite/shiki-plugin.ts`, emitting ONE token stream using Shiki's `cssVariables` theme so light and dark both come free. Cloze blanks are authored as token *text* plus an optional `occurrence`; the plugin resolves them to ranges and **fails the build on an ambiguous match**. The runtime receives `{text, cls}[][]` and renders spans. Zero highlighter bytes ship.

**Why.** The user asked for in-browser code drills; Monaco (~1MB) and Sandpack (a bundler in the browser) are disqualifying for an app whose thesis is bundle discipline. Two-theme token emission is ~6kb gz per drill; the `cssVariables` theme halves that and removes the light/dark duplication entirely.

**What is lost.** The learner cannot execute code or get real type errors. Cloze, before/after diff and consequence-prediction cover the teaching goal; free-form authoring does not.

**Escalation.** CodeMirror 6, lazy, on a named handful of modules — requires its own ADR naming them.

**Rejected.** Monaco, Sandpack, runtime Shiki, CodeMirror in v1.
