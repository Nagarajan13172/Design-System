# ADR-3 — `idb` behind one repository module

**Decision.** `idb` is imported in exactly one directory, `src/data/repo/**`, which exposes typed accessors (`cards.dueBefore`, `reviews.append`, …). A migration ladder indexed by target version, with a committed JSON fixture per version, tested from v1 forever under `fake-indexeddb`. `localStorage` holds exactly one key: the theme, to avoid a flash before IDB opens.

**Why.** Review history *is* the product's value. One import site means one place to test migrations, one place to enforce transaction boundaries, and one place where `QuotaExceededError` flips the degraded flag.

**Rejected.** Dexie and localforage (both banned). Raw IndexedDB. Any `openDB` call outside the repository.

**Known risk.** Safari's ITP evicts IndexedDB for non-installed sites after ~7 days idle. Export nudges bound the loss; they do not prevent it. See the risks section of the plan.
