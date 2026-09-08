# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gate.spec.ts >> a module ends with recall, not a button >> a too-fast submission is not marked covered, and is not punished
- Location: e2e/gate.spec.ts:83:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^done$/i })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "fesd" [ref=e5] [cursor=pointer]:
      - /url: /review
    - generic [ref=e6]: Out-of-Order Responses, Cancellation, and Request Deduplication
    - navigation [ref=e7]:
      - link "progress" [ref=e8] [cursor=pointer]:
        - /url: /progress
      - link "review" [ref=e9] [cursor=pointer]:
        - /url: /review
  - main [ref=e10]:
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]:
            - paragraph [ref=e15]: A typeahead with a 300ms debounce. Response latency is median 120ms, p95 480ms. The user types in bursts, so several requests are in flight across one query.
            - heading "With no guard at all, what is displayed one second after the last keystroke — and would a 300ms debounce have prevented it?" [level=2] [ref=e16]
          - generic [ref=e17]:
            - img "With no guard at all, what is displayed one second after the last keystroke — and would a 300ms debounce have prevented it?" [ref=e18]:
              - generic [ref=e19]: 0ms
              - generic [ref=e21]: 500ms
              - generic [ref=e23]: 1000ms
            - generic [ref=e26]:
              - generic [ref=e27]: commit a prediction to reveal the figure
              - generic [ref=e28]:
                - spinbutton "your prediction, as a percentage" [ref=e29]
                - generic [ref=e30]: "% of sessions"
              - generic [ref=e31]:
                - generic [ref=e32]: confidence
                - slider "how confident are you, from 50 to 100 percent" [ref=e33]: "70"
                - generic [ref=e34]: 70%
              - generic [ref=e35]:
                - button "Lock it in" [disabled] [ref=e36]
                - generic [ref=e37]: ↵ · cannot be changed afterwards
        - article [ref=e38]:
          - paragraph [ref=e39]: Every typeahead you have ever written contains this bug. Most of them still do, because it never throws, never logs, and never shows up in an error budget.
          - heading "The shape of the failure" [level=2] [ref=e40]
          - paragraph [ref=e41]: A user types into a search box. Each pause dispatches a request. The requests go out in order — there is no ambiguity about that, the client controls it. What the client does not control is when the responses come back.
          - paragraph [ref=e42]: Request 3 goes out. Request 4 goes out 340ms later. Request 4 comes back in 90ms. Request 3, which happened to hit a cold cache on a shard under load, comes back in 700ms. The client renders every response as it arrives, so the screen shows results for request 4, and then — 270ms later — quietly replaces them with results for request 3.
          - paragraph [ref=e43]: The user is now looking at suggestions for a query they finished typing a second ago. The input says one thing; the list below it says another. Every request returned 200. Nothing was retried. No exception was raised. There is no signal anywhere in your observability stack that this happened, because from the network's point of view everything went perfectly.
          - paragraph [ref=e44]:
            - text: "This is the defining property of the bug and the reason it survives in production for years:"
            - strong [ref=e45]: it is a correctness failure with no error condition.
            - text: Your error tracker cannot see it. Your latency dashboards look healthy — in fact the session that produces it contains one unusually
            - emphasis [ref=e46]: fast
            - text: response, which is what lets the slow one land last.
          - heading "Why debouncing feels like the fix, and isn't" [level=2] [ref=e47]
          - paragraph [ref=e48]:
            - text: "The instinct is to reach for a debounce, and the instinct is half right. A debounce does reduce the damage: it cuts the number of in-flight requests, and it widens the gap between the ones that do go out. Widening that gap is what matters, because a race survives only when one response's latency exceeds the gap between two dispatches"
            - emphasis [ref=e49]: plus
            - text: the next response's latency.
          - paragraph [ref=e50]: Run the numbers rather than trusting the intuition. With response latency at median 120ms and p95 480ms — a healthy API on decent wifi — moving from no debounce to a 300ms debounce takes the fraction of sessions ending on stale data from about 22% down to about 1%. That looks like a fix. On a laptop, on an office network, with a warm cache, it is indistinguishable from a fix.
          - paragraph [ref=e51]: "Now change one thing. Leave the code alone, leave the debounce at 300ms, and put the user on a train: p95 latency 1500ms instead of 480ms. The stale rate goes to roughly 13%. Same debounce, same code, an order of magnitude more wrong renders."
          - paragraph [ref=e52]:
            - text: That is the trap. The race window is not an absolute quantity you can shrink below some safe constant — it is a
            - emphasis [ref=e53]: ratio
            - text: between your dispatch spacing and your latency tail, and you control only one of those two numbers. You tested on the half of the ratio you control. Your users live on the other half.
          - paragraph [ref=e54]: You can, of course, keep raising the debounce. At 800ms the stale rate does reach zero. It reaches zero because the debounce now exceeds essentially every inter-keystroke pause, so the session collapses to a single request — which is to say, you have fixed the race by removing the feature. A search box that waits most of a second before reacting is one users describe as broken.
          - heading "Two guards that actually work, and what each one costs" [level=2] [ref=e55]
          - paragraph [ref=e56]:
            - strong [ref=e57]: Sequencing.
            - text: Keep a monotonically increasing request id. Stamp each request with it, and when a response arrives, compare its stamp against the newest one issued. If it is not the newest, drop it on the floor and render nothing.
          - paragraph [ref=e58]: This eliminates stale final renders completely — zero, at every latency profile we measured, not "almost zero" — and it does so without cancelling anything. Every request still goes out and still comes back; you simply stop letting superseded ones touch the screen. It is about four lines of code and it has no failure mode of its own, which is why it should be your default rather than your fallback.
          - paragraph [ref=e59]:
            - strong [ref=e60]: Cancellation.
            - code [ref=e61]: AbortController
            - text: lets you abort the previous request when you dispatch the next. This also fixes the rendering problem, and it additionally saves bandwidth and server work — real wins on mobile.
          - paragraph [ref=e62]:
            - text: But it is important to be precise about what abort actually does, because the name oversells it. Aborting severs
            - emphasis [ref=e63]: the client's interest in the response
            - text: . It does not reach across the network and stop the server. A request you aborted may already have arrived, already been processed, and already had effects. For an idempotent GET that distinction costs you nothing. For anything with a side effect it is the difference between a cancelled operation and an operation you have simply stopped watching — which is how a "cancel" button ends up double-charging someone.
          - paragraph [ref=e64]:
            - text: "So the two are not substitutes, and the trade-off is worth stating out loud in an interview:"
            - strong [ref=e65]: sequencing fixes what is rendered; cancellation fixes what is spent.
            - text: They solve different problems and most real clients want both — sequencing because it is the correctness guarantee, cancellation because it is the efficiency one.
          - heading "What to say when you are asked" [level=2] [ref=e66]
          - paragraph [ref=e67]: Interviewers ask about the typeahead because it is the smallest problem that contains a genuine concurrency question, and they are listening for three things.
          - paragraph [ref=e68]: First, whether you distinguish arrival order from dispatch order at all, or whether you reach straight for a library. Second, whether you can name what the failure looks like to the user — no error, no log, silent wrongness — because that is what makes it dangerous and it is what separates someone who has debugged this from someone who has read about it. Third, whether you quantify. "I'd add a debounce" is a weak answer. "I'd sequence, because a debounce only narrows the window and the window is a ratio to the latency tail I don't control — on a slow network the same debounce is ten times worse" is the answer that ends the topic.
          - paragraph [ref=e69]: And when they push — and they will — the follow-up is almost always about cancellation. Have the distinction ready.
        - generic [ref=e70]:
          - heading "drills · 1/6" [level=2] [ref=e71]
          - generic [ref=e72]:
            - paragraph [ref=e73]: You raise the debounce from 300ms to 800ms. What happens to the stale-render rate, and at what threshold does the trade stop being worth it?
            - group "Which way does it move?" [ref=e74]:
              - generic [ref=e76]:
                - button "1 up" [ref=e77]:
                  - generic [ref=e78]: "1"
                  - generic [ref=e79]: up
                - button "2 down" [ref=e80]:
                  - generic [ref=e81]: "2"
                  - generic [ref=e82]: down
                - button "3 no change" [ref=e83]:
                  - generic [ref=e84]: "3"
                  - generic [ref=e85]: no change
        - generic [ref=e86]:
          - button "Close the page and write what you remember" [active] [ref=e87]
          - paragraph [ref=e88]: This is how a module ends. There is no Next.
          - paragraph [ref=e89]:
            - text: "Afterwards, something from a different domain:"
            - link "found-event-loop" [ref=e90] [cursor=pointer]:
              - /url: /m/found-event-loop
      - complementary [ref=e91]:
        - generic [ref=e92]:
          - heading "claims · 0/6 with evidence" [level=2] [ref=e93]
          - list [ref=e94]:
            - listitem [ref=e95]:
              - paragraph [ref=e96]: Two requests dispatched in order can arrive in either order, so the last response to arrive is not necessarily the response to the last request.
              - paragraph [ref=e97]: insufficient evidence — 0 items across 0 kinds, needs 3 across 2
            - listitem [ref=e98]:
              - paragraph [ref=e99]: "A stale final render is not an error state: every request succeeded, nothing is logged, and the UI simply shows results for a query the user already replaced."
              - paragraph [ref=e100]: insufficient evidence — 0 items across 0 kinds, needs 3 across 2
            - listitem [ref=e101]:
              - paragraph [ref=e102]: "Debouncing shrinks the race window but cannot close it: a race survives whenever one response’s latency exceeds the gap between dispatches plus the next response’s latency."
              - paragraph [ref=e103]: insufficient evidence — 0 items across 0 kinds, needs 3 across 2
            - listitem [ref=e104]:
              - paragraph [ref=e105]: A monotonic request sequence number — drop any response that is not the newest — eliminates stale final renders without cancelling a single request.
              - paragraph [ref=e106]: insufficient evidence — 0 items across 0 kinds, needs 3 across 2
            - listitem [ref=e107]:
              - paragraph [ref=e108]: "AbortController cancels the client’s interest in a response, not the server’s work: the request may already have arrived and had effects."
              - paragraph [ref=e109]: insufficient evidence — 0 items across 0 kinds, needs 3 across 2
            - listitem [ref=e110]:
              - paragraph [ref=e111]: The same 300ms debounce leaves roughly 1% of sessions ending on stale data at p95 latency 480ms and roughly 13% at p95 1500ms, so a race bug that looks fixed on a fast network reappears an order of magnitude more often in the field.
              - paragraph [ref=e112]: insufficient evidence — 0 items across 0 kinds, needs 3 across 2
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test'
  2   | 
  3   | /**
  4   |  * THE GATE CANNOT BE BYPASSED.
  5   |  *
  6   |  * The M3 exit criterion, and the single most important behavioural guarantee in the
  7   |  * product. The gate is a DATA DEPENDENCY: `sim.run()` is never called without a
  8   |  * stored PredictionRecord, so there is nothing in the DOM to find — by deep link, by
  9   |  * scrolling, under reduced motion, or on a phone.
  10  |  *
  11  |  * If this ever goes red, the app still looks correct in every screenshot while
  12  |  * having silently lost the mechanism that makes it a learning product.
  13  |  */
  14  | const MODULE = '/m/state-races'
  15  | 
  16  | async function assertNoData(page: Page, context: string) {
  17  |   await expect(page.getByText(/commit a prediction/i)).toBeVisible()
  18  |   // `data-span` marks REAL DATA, so <defs> pattern rects cannot be mistaken for it.
  19  |   await expect(page.locator('[data-span]'), context).toHaveCount(0)
  20  | }
  21  | 
  22  | test.describe('the prediction gate', () => {
  23  |   test('renders no data on a normal visit', async ({ page }) => {
  24  |     await page.goto(MODULE)
  25  |     await assertNoData(page, 'plain visit')
  26  |   })
  27  | 
  28  |   test('renders no data when deep-linked to a later stage', async ({ page }) => {
  29  |     await page.goto(`${MODULE}#fig-1@stage=5`)
  30  |     await assertNoData(page, 'deep link to a stage')
  31  |   })
  32  | 
  33  |   test('renders no data after scrolling the whole page', async ({ page }) => {
  34  |     await page.goto(MODULE)
  35  |     await page.mouse.wheel(0, 20_000)
  36  |     await assertNoData(page, 'scrolled past the figure')
  37  |   })
  38  | 
  39  |   test('renders no data under prefers-reduced-motion', async ({ page }) => {
  40  |     await page.emulateMedia({ reducedMotion: 'reduce' })
  41  |     await page.goto(MODULE)
  42  |     await assertNoData(page, 'reduced motion')
  43  |   })
  44  | 
  45  |   test('renders no data at a 360px viewport', async ({ page }) => {
  46  |     await page.setViewportSize({ width: 360, height: 640 })
  47  |     await page.goto(MODULE)
  48  |     await assertNoData(page, '360px viewport')
  49  |   })
  50  | 
  51  |   test('offers no skip affordance anywhere on the page', async ({ page }) => {
  52  |     await page.goto(MODULE)
  53  |     const labels = await page.locator('button').allTextContents()
  54  |     for (const l of labels) {
  55  |       expect(l.toLowerCase()).not.toMatch(/\bskip\b|reveal|show me|show answer/)
  56  |     }
  57  |   })
  58  | 
  59  |   test('reveals data only after a prediction is committed', async ({ page }) => {
  60  |     await page.goto(MODULE)
  61  |     await assertNoData(page, 'before commit')
  62  |     await page.getByLabel(/your prediction/i).fill('4')
  63  |     await page.getByRole('button', { name: /lock it in/i }).click()
  64  |     await expect(page.locator('[data-span]').first()).toBeVisible()
  65  |     await expect(page.getByText(/you predicted/i)).toBeVisible()
  66  |   })
  67  | })
  68  | 
  69  | test.describe('a module ends with recall, not a button', () => {
  70  |   test('there is no Next button, and the gate removes the page', async ({ page }) => {
  71  |     await page.goto(MODULE)
  72  |     const labels = (await page.locator('button, a').allTextContents()).map(s => s.trim().toLowerCase())
  73  |     expect(labels).not.toContain('next')
  74  | 
  75  |     await page.getByRole('button', { name: /close the page and write what you remember/i }).click()
  76  | 
  77  |     // The prose is not merely covered — it is gone from the document.
  78  |     await expect(page.getByRole('dialog', { name: /recall gate/i })).toBeVisible()
  79  |     await expect(page.locator('article.prose-body')).toHaveCount(0)
  80  |     await expect(page.getByLabel(/write what you remember/i)).toBeFocused()
  81  |   })
  82  | 
  83  |   test('a too-fast submission is not marked covered, and is not punished', async ({ page }) => {
  84  |     await page.goto(MODULE)
  85  |     await page.getByRole('button', { name: /close the page and write what you remember/i }).click()
> 86  |     await page.getByRole('button', { name: /^done$/i }).click()
      |                                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
  87  |     await expect(page.getByText(/too fast to count as recall/i)).toBeVisible()
  88  |     await expect(page.getByText(/no penalty/i)).toBeVisible()
  89  |   })
  90  | })
  91  | 
  92  | test('the three axes are never blended into one number', async ({ page }) => {
  93  |   await page.goto('/progress')
  94  | 
  95  |   // The standing note, and three panels that deliberately do not look alike.
  96  |   await expect(page.getByText(/not components of one number/i)).toBeVisible()
  97  |   for (const label of ['coverage', 'mastery', 'confidence']) {
  98  |     await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
  99  |   }
  100 | 
  101 |   // The real invariant: no aggregate VALUE is ever presented. Matching the word
  102 |   // "overall" alone would flag our own disclaimer saying no such score exists.
  103 |   const body = ((await page.locator('body').textContent()) ?? '').toLowerCase()
  104 |   expect(body).not.toMatch(/\b(overall|total|combined)\b[^.]{0,24}\d+\s*%/)
  105 |   expect(body).not.toMatch(/\d+\s*%\s*(complete|mastered|overall)/)
  106 | })
  107 | 
```