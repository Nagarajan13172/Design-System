# ADR-7 — ts-fsrs, behind one adapter

**Decision.** `ts-fsrs` is imported in exactly one file, `src/domain/scheduler/adapter.ts`, behind `interface Scheduler { init, next, forecast }`. Config: `request_retention 0.90`, `maximum_interval 1095`, learning steps `['1m','10m']`, relearning `['10m']`, fuzz and short-term enabled. Weights ship as-is, stored in prefs so an optimizer can be added without a migration. Every review writes a full pre/post card snapshot.

**Why.** Hand-rolling FSRS is explicitly out of scope. The single import site plus complete logs means the algorithm is swappable later without discarding a day of history — an SM-2 fallback implementing the same interface remains possible.

**Rejected.** Hand-rolled FSRS or SM-2 as primary. Scheduling logic living inside the review feature.
