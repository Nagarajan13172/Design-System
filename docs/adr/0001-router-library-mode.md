# ADR-1 — React Router v7 in library mode

**Decision.** `createBrowserRouter` + `RouterProvider` from `react-router`. Zero loaders, zero actions. Every route is `React.lazy` behind `retryImport()`.

**Why.** There is no server. Loaders exist to parallelise network fetches against navigation; here every read is a local IndexedDB cursor that resolves in well under a millisecond, so a data router buys nothing and costs a second mental model plus the `react-router-dom` surface.

**Rejected.** TanStack Router (another ~15kb and a second type-generation pipeline). React Router data mode. TanStack Query and SWR — both are server-cache libraries, and there is no server; either one appearing in this codebase is cargo cult.

**Enforced by.** `no-restricted-imports` on `react-router-dom`, `swr`, `@tanstack/*`.
