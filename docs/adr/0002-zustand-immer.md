# ADR-2 — Zustand + immer, one store, six slices

**Decision.** One store, sliced into `session`, `review`, `progress`, `roadmap`, `prefs`, `ui`. Slices call repository functions; they never touch `idb` directly.

**Why.** The store is small and mostly ephemeral UI state — the durable state lives in IndexedDB. Zustand's subscription granularity is what keeps a 60fps figure scrub from re-rendering the shell.

**Rejected.** Redux Toolkit (ceremony without payoff at this size). Jotai / Valtio / Recoil / MobX. React Context as application state — the context re-render storm is a module in our own curriculum.

**Enforced by.** `no-restricted-imports` on the alternatives.
