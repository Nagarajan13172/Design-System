# ADR-5 — No animation library

**Decision.** All motion is CSS transitions (≤200ms, `cubic-bezier(.2,0,0,1)`) plus one shared `useTimelineHead` hook: a single rAF loop writing `headMs` into a ref, with derived state published at ≤30Hz. Reduced motion short-circuits the loop entirely and renders `StaticComposite`.

**Why.** This ADR was originally "framer-motion via LazyMotion + `m`" and was **reversed during design review**. LazyMotion + domAnimation is ~19kb gz to interpolate between keyframes — but our animation is a frame *index* into a timeline that is already fully computed. A library that interpolates is solving a problem we deliberately do not have.

**Rejected.** framer-motion, motion, react-spring, GSAP. Shipping two animation runtimes in an app whose thesis is bundle discipline is a pure-cost mistake.
