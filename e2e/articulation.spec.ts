import { test, expect } from '@playwright/test'

/**
 * M6's exit criteria. The load-bearing ones:
 *   - a locked defence cannot be edited by ANY client-side route
 *   - a red-flagged criterion cannot be scored above zero without evidence from the
 *     learner's own text
 *   - the day-14 re-surface reports a COMPUTED number, not a self-reported one
 */
/**
 * Long enough to clear the 60-word floor, and still empty of the load-bearing
 * concepts — which is exactly the answer the evidence-highlighting step exists to
 * catch. A floor alone would let this through.
 */
const THIN = [
  'I would use a sequence number here because it is simpler than the alternative and',
  'it works well enough in practice for a search box of this kind, so that is what I',
  'would ship first. It is a common pattern and most teams do something similar, and',
  'I have seen it used before on other products without any real problems. The other',
  'approach is fine too but I think this one is easier to reason about and easier to',
  'explain to reviewers, so it seems like the better default choice for us to take here.',
].join(' ')

async function openDefence(page: import('@playwright/test').Page) {
  await page.goto('/practice')
  await page.getByRole('link', { name: /sequence guard|AbortController/i }).first().click()
  await expect(page.getByText(/there is no "it depends"/i)).toBeVisible()
}

test.describe('trade-off defence', () => {
  test('offers no "it depends" option — the escape hatch is naming the parameter', async ({ page }) => {
    await openDefence(page)
    const options = await page.locator('fieldset button').allTextContents()
    for (const o of options) expect(o.toLowerCase()).not.toContain('it depends')
    await expect(page.getByLabel(/name what on/i)).toBeVisible()
  })

  test('refuses to lock below the word floor', async ({ page }) => {
    await openDefence(page)
    await page.locator('fieldset button').first().click()
    await page.getByRole('button', { name: /now defend it/i }).click()
    await page.getByLabel('your justification').fill('too short to count')
    await expect(page.getByRole('button', { name: /^lock$/i })).toBeDisabled()
  })

  test('the text cannot be edited after Lock, by any route', async ({ page }) => {
    await openDefence(page)
    await page.locator('fieldset button').first().click()
    await page.getByRole('button', { name: /now defend it/i }).click()
    await page.getByLabel('your justification').fill(THIN)
    await page.getByRole('button', { name: /^lock$/i }).click()

    // The textarea is gone from the document entirely — not disabled, not readonly.
    await expect(page.getByLabel('your justification')).toHaveCount(0)
    await expect(page.getByText(THIN.slice(0, 40))).toBeVisible()
  })

  test('a red-flagged criterion cannot be scored above zero without evidence', async ({ page }) => {
    await openDefence(page)
    await page.locator('fieldset button').first().click()
    await page.getByRole('button', { name: /now defend it/i }).click()
    await page.getByLabel('your justification').fill(THIN)
    await page.getByRole('button', { name: /^lock$/i }).click()

    // The thin answer misses several criteria, so at least one is flagged.
    const flagged = page.getByText(/did not write anything resembling/i).first()
    await expect(flagged).toBeVisible()

    const card = page.locator('li', { has: page.getByText(/did not write anything resembling/i) }).first()
    await card.getByRole('button', { name: '3', exact: true }).click()
    await expect(card.getByText(/Select the part of your own answer/i)).toBeVisible()

    // Text that is not in the answer is refused too.
    await card.getByRole('textbox').fill('I clearly explained arrival ordering here')
    await card.getByRole('button', { name: '3', exact: true }).click()
    await expect(card.getByText(/does not appear in your answer/i)).toBeVisible()

    // A real span from their own writing is accepted.
    await card.getByRole('textbox').fill('it works well enough in practice')
    await card.getByRole('button', { name: '3', exact: true }).click()
    await expect(card.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('says plainly that self-scores move nothing', async ({ page }) => {
    await openDefence(page)
    await page.locator('fieldset button').first().click()
    await page.getByRole('button', { name: /now defend it/i }).click()
    await page.getByLabel('your justification').fill(THIN)
    await page.getByRole('button', { name: /^lock$/i }).click()
    await expect(page.getByText(/do not move mastery/i)).toBeVisible()
    await expect(page.getByText(/computed, not self-assigned/i)).toBeVisible()
  })
})
