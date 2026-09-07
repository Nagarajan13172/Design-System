#!/usr/bin/env python3
"""
ONE-TIME bootstrap. Converts the design-phase curriculum draft into:

  content/_curriculum.ts                     the lean source of truth the app reads
  content/_generated/curriculum-source.json  the full authored spec (claims, drills,
                                             viz designs) kept as authoring input

After this runs, content/_curriculum.ts is hand-edited and this script is not re-run.
It applies the synthesis's cut/add decisions and the hard-prereq demotion pass.
"""
import json, re, sys, collections

SRC = sys.argv[1]
doms = json.load(open(SRC))

TIER = {
    'found': 'MVP', 'state': 'MVP', 'perf': 'MVP', 'arch': 'MVP', 'api': 'MVP',
    'incl': 'MVP', 'ui': 'MVP', 'cs': 'MVP',
    'rt': 'tier2', 'ops': 'tier2', 'sec': 'tier2', 'ds': 'tier2',
    'meta': 'tier3', 'ai': 'tier3',
}

# --- the synthesis's cut list -------------------------------------------------
# cs-shell/requirements/canvas/ledger: application features, not flashcard material
# sec-origin-model:  duplicate of found-origins-credentials' CORS claim
# state-retries:     jitter claim is ops-resilience's verbatim; content splits
# rt-optimistic:     merged into state-optimistic
# ai-shell-targets:  the domain blurb itself calls it low-frequency
# cs-photos:         claim is perf-images' srcset claim verbatim
CUT = {'cs-shell', 'cs-requirements', 'cs-canvas', 'cs-ledger',
       'sec-origin-model', 'state-retries', 'rt-optimistic',
       'ai-shell-targets', 'cs-photos'}

# --- genuinely missing modules, only visible because other modules reached for them
ADDED = [
    dict(id='arch-spa-routing', domain='arch', title='Client-Side Routing, History and Scroll Restoration',
         level='core', verb='judge', studyMinutes=40, buildCostHours=14,
         prereqs=['arch-rendering-matrix'], primitive='LaneTimeline',
         oneLiner='A client-side router replaces the browser\u2019s navigation, so history entries, scroll position and focus become the application\u2019s responsibility \u2014 and every one of them is lost by default.',
         figureSetup='A feed of 400 items, scrolled to item 180. The user opens an item, then presses Back.',
         figureQuestion='When you navigate back to a long feed in a client-side router, what does the browser restore on its own?'),
    dict(id='ui-contenteditable', domain='ui', title='contenteditable and the Document Model',
         level='advanced', verb='explain', studyMinutes=45, buildCostHours=16,
         prereqs=[], primitive='LiveSurface',
         oneLiner='contenteditable hands you a DOM the browser mutates on its own terms, which is why every serious editor keeps a separate document model and treats the DOM as a render target.',
         figureSetup='A contenteditable div containing one paragraph of styled text, with the caret mid-word.',
         figureQuestion='After typing a single character into a contenteditable div, how many DOM nodes can the browser have changed?'),
    dict(id='cs-log-tail', domain='cs', title='Case Study: Live Log / Trace Tail',
         level='advanced', verb='design', studyMinutes=55, buildCostHours=18,
         prereqs=['ui-virtualization'], primitive='LaneTimeline',
         oneLiner='A live log tail and a streaming LLM transcript are the same problem: an unbounded append-only stream rendered into a bounded viewport with a follow-the-tail affordance that must survive the user scrolling away.',
         figureSetup='A virtualized log viewer pinned to the tail, receiving 500 lines per second, while the user scrolls up to read.',
         figureQuestion='At 500 lines per second into a virtualized tail, what gives out first \u2014 the DOM, the scheduler, or the scroll anchor?'),
]

# --- archetype -> primitive ---------------------------------------------------
# The draft named 162 distinct archetypes across 175 modules. They cluster into six.
# Order matters: most specific cue wins.
RULES = [
    ('LiveSurface', r'live |real dom|real keystroke|rendered widget|focus-order|focus-traject'
                    r'|association-wiring|annotated path overlay|model-dom-mirror|box-layout'
                    r'|on a live|live layout|live form|annotated-ui-state'),
    ('CodeStage',   r'\bcode\b|payload|source \u2192|snippet|wire-xray|payload-shaper'),
    ('Plot2D',      r'chart|plot|histogram|distribution|curve|scatter|contour|crossover'
                    r'|percentile|parameter-space|adoption|control-chart|arrival histogram'),
    ('NodeGraph',   r'graph|tree|topology|propagation|dependency|wiring|lattice|blast'
                    r'|hierarchy|\bdag\b|trust |taint|data-flow|fanout|flow\b|retainer'
                    r'|module-graph|import-graph|router\b|funnel'),
    ('StateMatrix', r'matrix|grid|table|board|scorecard|ledger|checklist|comparison|compar'
                    r'|selection|sorter|card sort|decision|state-machine|machine\b|evaluator'
                    r'|anatomy|ring\b|explorer|rig\b|strip\b'),
]
def classify(arch: str) -> str:
    a = (arch or '').lower()
    for prim, pat in RULES:
        if re.search(pat, a):
            return prim
    return 'LaneTimeline'   # timelines, waterfalls, ladders, tapes, lanes, traces, queues

# --- figure setup + question --------------------------------------------------
OVERRIDES = {k: v for k, v in json.load(open('content/_figure-questions.json')).items()
             if not k.startswith('_')}

def split_figure(mid: str, prompt: str):
    """
    The cognitive-load rule allows exactly ONE stated question per figure, so the
    scenario and the ask are separate fields. The drafted prompts bundle both.
    """
    p = (prompt or '').strip()
    if mid in OVERRIDES:
        return p, OVERRIDES[mid]          # ask was imperative; hand-authored
    qs = list(re.finditer(r'[^.?!]*\?', p))
    if not qs:
        return p, ''                      # lint will flag it for authoring
    last = qs[-1]
    q = re.sub(r'^[\u2014\-\s]+', '', last.group().strip())
    return p[:last.start()].strip(), (q[0].upper() + q[1:] if q else p)

# --- assemble -----------------------------------------------------------------
mods, meta = {}, []
for d in doms:
    dk = d['domainKey']
    meta.append(dict(key=dk, name=d['domain'], tier=TIER[dk],
                     summary=d['domainSummary'], whyItMatters=d['whyItMatters']))
    for m in d['modules']:
        if m['id'] in CUT:
            continue
        mods[m['id']] = dict(
            id=m['id'], domain=dk, title=m['title'], level=m['level'],
            tier=TIER[dk], verb=m['objectiveVerb'], status='planned',
            studyMinutes=m.get('estimatedMinutes') or 40,
            authorHours=dict(estimate=m.get('buildCostHours') or 14, actual=None),
            rawPrereqs=list(m.get('prereqs') or []),
            oneLiner=(m.get('claims') or [m['title']])[0],
            **dict(zip(('figureSetup', 'figureQuestion'),
                       split_figure(m['id'], (m.get('viz') or {}).get('predictPrompt', '')))),
            primitive=classify((m.get('viz') or {}).get('archetype', '')),
            _source=m,
        )
for a in ADDED:
    mods[a['id']] = dict(**{k: v for k, v in a.items() if k not in ('prereqs', 'buildCostHours')},
                         tier=TIER[a['domain']], status='planned',
                         authorHours=dict(estimate=a['buildCostHours'], actual=None),
                         rawPrereqs=a['prereqs'], _source=None)

ids = set(mods)
report = collections.Counter()
DANGLING = collections.defaultdict(list)

# --- prereq resolution + hard-gate demotion ----------------------------------
for m in mods.values():
    resolved, dangling = [], []
    for p in m.pop('rawPrereqs'):
        (resolved if p in ids else dangling).append(p)
    report['dangling'] += len(dangling)
    if dangling:
        report['modules_with_dangling'] += 1
        for p in dangling:
            DANGLING[p].append(m['id'])

    same = [p for p in resolved if mods[p]['domain'] == m['domain']]
    cross = [p for p in resolved if mods[p]['domain'] != m['domain']]
    # hard gates: at most 2, of which at most 1 crosses domains
    hard = same[:2] if not cross else (same[:1] + cross[:1])
    hard = hard[:2]
    m['prereqs'] = hard
    m['related'] = [p for p in resolved if p not in hard]
    report['demoted'] += len(m['related'])

# --- break cycles by demoting the back-edge to `related` ----------------------
def find_cycle():
    WHITE, GREY, BLACK = 0, 1, 2
    color = {i: WHITE for i in ids}
    stack = []
    def dfs(u):
        color[u] = GREY; stack.append(u)
        for v in mods[u]['prereqs']:
            if color[v] == GREY:
                return stack[stack.index(v):] + [v]
            if color[v] == WHITE:
                c = dfs(v)
                if c: return c
        color[u] = BLACK; stack.pop(); return None
    for i in ids:
        if color[i] == WHITE:
            c = dfs(i)
            if c: return c
    return None

while True:
    cyc = find_cycle()
    if not cyc: break
    u, v = cyc[-2], cyc[-1]
    mods[u]['prereqs'].remove(v)
    mods[u]['related'].append(v)
    report['cycles_broken'] += 1

# --- emit ---------------------------------------------------------------------
def ts(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ') + "'"

order = sorted(mods.values(), key=lambda m: (list(TIER).index(m['domain']), m['id']))
out = ["// GENERATED ONCE by scripts/bootstrap-curriculum.py, hand-edited thereafter.",
       "// THE SOURCE OF TRUTH for the curriculum. 169 entries.",
       "import type { CurriculumEntry, DomainMeta } from './types'", '',
       'export const DOMAINS: DomainMeta[] = [']
for d in sorted(meta, key=lambda x: list(TIER).index(x['key'])):
    out.append(f"  {{ key: {ts(d['key'])}, name: {ts(d['name'])}, tier: {ts(d['tier'])},")
    out.append(f"    summary: {ts(d['summary'])},")
    out.append(f"    whyItMatters: {ts(d['whyItMatters'])} }},")
out += [']', '', 'export const CURRICULUM: CurriculumEntry[] = [']
for m in order:
    out.append(f"  {{")
    out.append(f"    id: {ts(m['id'])}, domain: {ts(m['domain'])}, tier: {ts(m['tier'])},")
    out.append(f"    title: {ts(m['title'])},")
    out.append(f"    level: {ts(m['level'])}, verb: {ts(m['verb'])}, status: {ts(m['status'])},")
    out.append(f"    studyMinutes: {m['studyMinutes']}, primitive: {ts(m['primitive'])},")
    out.append(f"    authorHours: {{ estimate: {m['authorHours']['estimate']}, actual: null }},")
    out.append(f"    prereqs: [{', '.join(ts(p) for p in m['prereqs'])}],")
    out.append(f"    related: [{', '.join(ts(p) for p in m['related'])}],")
    out.append(f"    oneLiner: {ts(m['oneLiner'])},")
    out.append(f"    figureSetup: {ts(m['figureSetup'])},")
    out.append(f"    figureQuestion: {ts(m['figureQuestion'])},")
    out.append(f"  }},")
out += [']', '']
open('content/_curriculum.ts', 'w').write('\n'.join(out))

json.dump({m['id']: m.pop('_source') for m in mods.values() if m.get('_source')},
          open('content/_generated/curriculum-source.json', 'w'), indent=1)

# Dangling references are curriculum HOLES, not noise: each is a module some other
# module reached for and did not find. Three became real modules (see ADDED); the
# rest are recorded here so they stay visible as authoring candidates.
json.dump({k: sorted(v) for k, v in sorted(DANGLING.items(), key=lambda kv: -len(kv[1]))},
          open('content/_generated/dangling-prereqs.json', 'w'), indent=1)

prim = collections.Counter(m['primitive'] for m in mods.values())
print(f"modules: {len(mods)}  (175 drafted - {len(CUT)} cut + {len(ADDED)} added)")
print(f"dangling prereq refs: {report['dangling']} refs -> {len(DANGLING)} missing ids, across {report['modules_with_dangling']} modules")
print("  most-wanted:", ', '.join(f'{k}(x{len(v)})' for k, v in sorted(DANGLING.items(), key=lambda kv: -len(kv[1]))[:6]))
print(f"prereqs demoted to `related`: {report['demoted']}   cycles broken: {report['cycles_broken']}")
print("primitive distribution:", dict(prim.most_common()))
maxp = max(len(m['prereqs']) for m in mods.values())
maxc = max(sum(1 for p in m['prereqs'] if mods[p]['domain'] != m['domain']) for m in mods.values())
print(f"max hard prereqs: {maxp} (limit 2)   max cross-domain: {maxc} (limit 1)   acyclic: {find_cycle() is None}")
