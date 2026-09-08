import { test, expect, type Page } from '@playwright/test'

/**
 * THE GATE CANNOT BE BYPASSED.
 *
 * The M3 exit criterion, and the single most important behavioural guarantee in the
 * product. The gate is a DATA DEPENDENCY: `sim.run()` is never called without a
 * stored PredictionRecord, so there is nothing in the DOM to find — by deep link, by
 * scrolling, under reduced motion, or on a phone.
 *
 * If this ever goes red, the app still looks correct in every screenshot while
 * having silently lost the mechanism that makes it a learning product.
 */
const MODULE = '/m/state-races'

async function assertNoData(page: Page, context: string) {
  await expect(page.getByText(/commit a prediction/i)).toBeVisible()
  // `data-span` marks REAL DATA, so <defs> pattern rects cannot be mistaken for it.
  await expect(page.locator('[data-span]'), context).toHaveCount(0)
}

test.describe('the prediction gate', () => {
  test('renders no data on a normal visit', async ({ page }) => {
    await page.goto(MODULE)
    await assertNoData(page, 'plain visit')
  })

  test('renders no data when deep-linked to a later stage', async ({ page }) => {
    await page.goto(`${MODULE}#fig-1@stage=5`)
    await assertNoData(page, 'deep link to a stage')
  })

  test('renders no data after scrolling the whole page', async ({ page }) => {
    await page.goto(MODULE)
    await page.mouse.wheel(0, 20_000)
    await assertNoData(page, 'scrolled past the figure')
  })

  test('renders no data under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(MODULE)
    await assertNoData(page, 'reduced motion')
  })

  test('renders no data at a 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto(MODULE)
    await assertNoData(page, '360px viewport')
  })

  test('offers no skip affordance anywhere on the page', async ({ page }) => {
    await page.goto(MODULE)
    const labels = await page.locator('button').allTextContents()
    for (const l of labels) {
      expect(l.toLowerCase()).not.toMatch(/\bskip\b|reveal|show me|show answer/)
    }
  })

  test('reveals data only after a prediction is committed', async ({ page }) => {
    await page.goto(MODULE)
    await assertNoData(page, 'before commit')
    await page.getByLabel(/your prediction/i).fill('4')
    await page.getByRole('button', { name: /lock it in/i }).click()
    await expect(page.locator('[data-span]').first()).toBeVisible()
    await expect(page.getByText(/you predicted/i)).toBeVisible()
  })
})

test.describe('a module ends with recall, not a button', () => {
  test('there is no Next button, and the gate removes the page', async ({ page }) => {
    await page.goto(MODULE)
    const labels = (await page.locator('button, a').allTextContents()).map(s => s.trim().toLowerCase())
    expect(labels).not.toContain('next')

    await page.getByRole('button', { name: /close the page and write what you remember/i }).click()

    // The prose is not merely covered — it is gone from the document.
    await expect(page.getByRole('dialog', { name: /recall gate/i })).toBeVisible()
    await expect(page.locator('article.prose-body')).toHaveCount(0)
    await expect(page.getByLabel(/write what you remember/i)).toBeFocused()
  })

  test('a too-fast submission is not marked covered, and is not punished', async ({ page }) => {
    await page.goto(MODULE)
    await page.getByRole('button', { name: /close the page and write what you remember/i }).click()
    await page.getByRole('button', { name: /^done$/i }).click()
    await expect(page.getByText(/too fast to count as recall/i)).toBeVisible()
    await expect(page.getByText(/no penalty/i)).toBeVisible()
  })
})

test('the three axes are never blended into one number', async ({ page }) => {
  await page.goto('/progress')

  // The standing note, and three panels that deliberately do not look alike.
  await expect(page.getByText(/not components of one number/i)).toBeVisible()
  for (const label of ['coverage', 'mastery', 'confidence']) {
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
  }

  // The real invariant: no aggregate VALUE is ever presented. Matching the word
  // "overall" alone would flag our own disclaimer saying no such score exists.
  const body = ((await page.locator('body').textContent()) ?? '').toLowerCase()
  expect(body).not.toMatch(/\b(overall|total|combined)\b[^.]{0,24}\d+\s*%/)
  expect(body).not.toMatch(/\d+\s*%\s*(complete|mastered|overall)/)
})
