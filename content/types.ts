/**
 * The content model. Everything except each module's MDX body is typed here,
 * zod-validated at build time by `scripts/lint-content.ts`, and lintable.
 *
 * ADR-4: content is structured data. Scheduling, mastery, the recall gate, the
 * search index, the roadmap and every lint rule read this structure. Prose alone
 * cannot be scheduled or graded.
 */

export type DomainKey =
  | 'found' | 'state' | 'perf' | 'arch' | 'api' | 'incl' | 'ui' | 'cs'
  | 'rt' | 'ops' | 'sec' | 'ds' | 'meta' | 'ai'

/** Build tier. MVP domains are the ten-module vertical slice's catchment. */
export type Tier = 'MVP' | 'tier2' | 'tier3'

export type Level = 'foundation' | 'core' | 'advanced' | 'expert'

/**
 * The single verb a module trains. This BINDS which item kinds may assess it:
 * see MASTERY_KINDS and the objectiveVerb check in lint:content. A module whose
 * verb is `judge` may not be assessed by an mcq that tests terminology recall.
 */
export type ObjectiveVerb = 'recall' | 'explain' | 'compare' | 'judge' | 'design' | 'diagnose'

/**
 * `deep` requires: body >= 900 words, 4-8 claims, a passing it('claim:<id>') per
 * mechanism claim, >= 12 auto-graded judgment items across >= 2 kinds, every claim
 * covered by >= 1 item, >= 1 source, and non-null reviewedBy/reviewedAt.
 * `drafted` is exempt from the id-stability lock until it flips to `deep`.
 */
export type ContentStatus = 'deep' | 'drafted' | 'planned'

/** The six primitives. Every figure is built from exactly one. */
export type Primitive =
  | 'LaneTimeline' | 'NodeGraph' | 'StateMatrix' | 'LiveSurface' | 'Plot2D' | 'CodeStage'

/**
 * `authored-heuristic` claims are the author's opinion (e.g. about interviewer
 * behaviour). Lint FORBIDS them a sim and forbids them producing mastery evidence:
 * a test asserting scoreAtMinute(12) < scoreAtMinute(8) tests a number the author
 * invented. They render in a visibly different register.
 */
export type ClaimEvidence = 'measurement' | 'specification' | 'derivation' | 'authored-heuristic'

export type ModuleId = string
export type ClaimId = string
export type FigureId = string
export type ItemId = string

/** One entry per module in the 169-node curriculum. The source of truth. */
export interface CurriculumEntry {
  id: ModuleId
  domain: DomainKey
  title: string
  level: Level
  tier: Tier
  /** The one verb this module trains. */
  verb: ObjectiveVerb
  status: ContentStatus
  studyMinutes: number
  /** `actual` is recorded after authoring and is what re-planning runs on. */
  authorHours: { estimate: number; actual: number | null }
  /**
   * HARD gates. Lint enforces <= 2, of which <= 1 crosses domains.
   * Everything else that is merely "related to" belongs in `related`.
   */
  prereqs: ModuleId[]
  /** Unlimited, non-gating. Rendered as see-also links and soft edges on the map. */
  related: ModuleId[]
  /** The authored claim a PLANNED node shows. Makes the roadmap a spec, not a stub farm. */
  oneLiner: string
  /**
   * The scenario the figure question is asked about. Rendered as framing and
   * parameter chips beside the figure — NOT part of the question, because the
   * cognitive-load rule allows exactly ONE stated question per figure.
   */
  figureSetup: string
  /**
   * The prediction question, shown before the figure will render any data.
   * Lint: interrogative, one sentence, and must NOT contain any outcome token of
   * the claim it reveals — a gate a strong engineer gets right is decoration.
   */
  figureQuestion: string
  primitive: Primitive
}

export interface DomainMeta {
  key: DomainKey
  name: string
  tier: Tier
  summary: string
  /** What an interviewer probes for here, and how candidates fail it. */
  whyItMatters: string
}

// ---------------------------------------------------------------------------
// Per-module content. One directory per module; everything here is typed,
// zod-validated at build time, and lintable.
// ---------------------------------------------------------------------------

/**
 * An ATOMIC, checkable statement — the unit the spaced-repetition scheduler
 * schedules. `type CardId = ClaimId`, 1:1, forever.
 *
 * Claims must stand alone out of context, because that is how they are shown in
 * an interleaved review deck three weeks later.
 */
export interface Claim {
  id: ClaimId
  /** One idea. Checkable. Stands alone. */
  assertion: string
  evidence: ClaimEvidence
  /**
   * What would make this false. Feeds mechanical `constraint-flip` generation —
   * the workhorse drill that makes trade-off skill gradable in 40 seconds.
   */
  flipCondition?: string
  /**
   * AND-of-ORs. Used by the recall gate and the Trade-off Defense reveal, and by
   * NOTHING else. Token presence is ALWAYS a flag, NEVER a score: it is trivially
   * gamed by keyword stuffing, which is exactly why it is evidence and not a grade.
   */
  conceptTokens: string[][]
  /** Item ids that may probe this claim. Drawn at session-build time, never repeating the previous kind. */
  probes: ItemId[]
}

export type ItemKind =
  | 'predict' | 'mcq-rationale' | 'constraint-flip' | 'spot-the-failure'
  | 'code-cloze' | 'code-diff' | 'architecture-build' | 'estimation'
  | 'cloze' | 'claim-recall' | 'order-steps'
  | 'free-recall' | 'tradeoff-defense' | 'requirements-triage'

/**
 * The ONLY item kinds whose evidence may move Mastery.
 *
 * Excluded deliberately: `cloze` and `order-steps` (reordering a sequence is recall
 * of a sequence; labelling a causal chain 'diagnose' does not make it judgment),
 * `claim-recall` and `free-recall` and `tradeoff-defense` (self-rated), and the
 * magnitude half of `estimation` (being within 2x of a benchmark is recall of a
 * number; choosing which term dominates is judgment).
 */
export const MASTERY_KINDS = [
  'predict', 'mcq-rationale', 'constraint-flip', 'spot-the-failure',
  'code-cloze', 'code-diff', 'architecture-build',
] as const satisfies readonly ItemKind[]

export const JUDGMENT_VERBS = ['judge', 'compare', 'design', 'diagnose'] as const

export interface Item {
  id: ItemId
  kind: ItemKind
  /** Full rating weight. Lint: an item references at most 2 claims. */
  primaryClaim: ClaimId
  /** Half weight. */
  secondaryClaim?: ClaimId
  prompt: string
  /** Kind-specific payload, validated per-kind by lint:content. */
  payload?: unknown
}

export interface Source {
  title: string
  url: string
  /** Why this source is cited. All prose here is original; sources are references, never phrasing to copy. */
  note?: string
}

/** The one figure a module is built around. */
export interface FigureSpec {
  id: FigureId
  /**
   * Lint: interrogative, ONE sentence, and must not contain any outcome token of
   * the claim it reveals. A gate a strong engineer gets right is decoration.
   */
  question: string
  primitive: Primitive
  /** The prediction control the gate uses. */
  control: 'binary-with-margin' | 'rank' | 'point'
}

export interface ModuleMeta {
  id: ModuleId
  status: ContentStatus
  figure: FigureSpec
  sources: Source[]
  /** Non-null is required for `deep`. A second reader is a hard gate. */
  reviewedBy: string | null
  reviewedAt: string | null
}

// --- the sim contract ------------------------------------------------------

export interface Annotation {
  id: string
  /** Anchored INSIDE the diagram. A side panel is a split-attention violation. */
  at: { x: number; y: number } | { laneId: string; t: number }
  text: string
  tone?: 'neutral' | 'good' | 'bad' | 'ghost'
}

/**
 * One frame of a precomputed, deterministic timeline.
 * Cognitive-load limits are enforced PER FRAME by lint:content, not per figure —
 * a per-figure check passes visuals that animate five things at one instant.
 */
export interface Frame<S = unknown> {
  t: number
  /** Read into a live region. Narration is a by-product of eager frames, not extra work. */
  narration: string
  /** Lint: <= 7. */
  annotations: Annotation[]
  /** Lint: <= 2. The names of the channels animating at this instant. */
  channels: string[]
  /** Which claim this frame is evidence for. Lets a wrong prediction auto-scrub here. */
  explains: ClaimId
  /** The primitive's state at this instant. Typed per primitive. */
  state: S
}

export interface Timeline<S = unknown> {
  frames: Frame<S>[]
  /** Stage boundaries for j/k stepping. */
  stages: { id: string; label: string; frame: number }[]
  /** The ghost baseline every figure must render for comparison. */
  ghost?: { label: string; frames: Frame<S>[] }
  /** Values the figure reports as text beside the diagram (the measured answer). */
  readout?: Record<string, number | string>
}

// --- primitive state contracts ---------------------------------------------
// Authors write these; primitives render them. Declared here because they are part
// of the content authoring contract, not an implementation detail of the kit.

export type SpanKind = 'work' | 'wait' | 'blocked' | 'network' | 'paint' | 'idle' | 'error' | 'stale'

export interface LaneTimelineState {
  lanes: { id: string; label: string; group?: string; role?: 'actor' | 'resource' | 'thread' }[]
  spans: { id: string; laneId: string; t0: number; t1: number; label?: string; kind: SpanKind }[]
  messages?: { id: string; fromLane: string; toLane: string; t: number; label?: string }[]
  markers?: { id: string; t: number; label: string; tone?: 'neutral' | 'good' | 'bad' }[]
  /** Where the scrub head is. */
  head?: number
}

export interface StateMatrixState {
  rows: { id: string; label: string }[]
  cols: { id: string; label: string }[]
  cells: Record<string, { value?: string; state: 'empty' | 'pass' | 'fail' | 'partial' | 'na' | 'active'; note?: string }>
  /** The walk: which cell the staged reveal is currently on. */
  cursor?: { row: string; col: string }
  /** A single measured quantity reported beside the grid. */
  meter?: { label: string; value: number; max: number; unit?: string }
}

export interface Rng { (): number }
