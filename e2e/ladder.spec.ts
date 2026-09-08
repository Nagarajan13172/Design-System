import { test, expect } from '@playwright/test'

/**
 * THE CASE LADDER.
 *
 * The load-bearing behaviour: the independent rung must run on a DIFFERENT case.
 * If it ever runs on the case that was just walked through, the ladder silently
 * becomes a rehearsal and every score it produces overstates transfer.
 */
test.describe('the ladder', () => {
  test('worked: gated at numbered decision points, untimed', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=worked')
    await expect(page.getByText(/untimed/i)).toBeVisible()
    await expect(page.getByText(/decision 1 of 6/i)).toBeVisible()

    // The reasoning appears only AFTER committing to an answer.
    await expect(page.getByText(/high blast radius/i)).toHaveCount(0)
    await page.locator('section button').first().click()
    await expect(page.getByRole('button', { name: /next decision/i })).toBeVisible()
  })

  test('worked: explains why whichever way you answered', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=worked')
    // Deliberately pick a wrong option — being right by luck and being right for a
    // reason must not look the same.
    await page.locator('section button').first().click()
    await expect(page.getByText(/blast radius|library/i).first()).toBeVisible()
  })

  test('faded: a soft clock, and hints locked for the first minute', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=faded')
    await expect(page.getByText(/\/ 25:00/)).toBeVisible()
    const hint = page.getByRole('button', { name: /hints unlock in/i })
    await expect(hint).toBeVisible()
    await expect(hint).toBeDisabled()
    // Flip conditions are blank — they are the load-bearing part of a ledger.
    await expect(page.getByLabel(/flip condition for/i).first()).toBeEmpty()
  })

  test('mini: a HARD clock, one subsystem, and a DIFFERENT case', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=mini')
    await expect(page.getByText(/\/ 13:00/)).toBeVisible()
    await expect(page.getByText(/one subsystem only/i)).toBeVisible()

    // The switch is announced, and it is genuinely a different problem.
    await expect(page.getByText(/runs on a different case/i)).toBeVisible()
    await expect(page.getByText(/cs-log-tail/)).toBeVisible()
    await expect(page.getByText(/live log tail/i)).toBeVisible()

    // No hints on this rung at all.
    await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0)
  })

  test('the mini rung never shows the case it was walked through', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=mini')
    const body = (await page.locator('main').textContent()) ?? ''
    expect(body).not.toMatch(/product catalogue/i)   // the worked case's prompt
    expect(body).toMatch(/deploy dashboard/i)        // the partner's
  })

  test('the canvas refuses a connection whose port types differ', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=faded')
    // Place an input and a results list, then try to wire events straight into data.
    await page.getByRole('button', { name: /search input/i }).click()
    await page.getByRole('button', { name: /results list/i }).click()
    await page.getByRole('button', { name: /input-1\.keys/i }).click()
    await page.getByRole('button', { name: /list-1\.items/i }).click()
    await expect(page.getByText(/cannot connect .* the port types differ/i)).toBeVisible()
  })

  test('a design with no guard scores zero, not ninety percent', async ({ page }) => {
    await page.goto('/practice/case/cs-autocomplete?stage=faded')
    // Palette buttons carry their keyboard number in the accessible name, so match
    // on the label rather than anchoring the whole string.
    const palette = page.locator('fieldset', { hasText: /press a number to place/i })
    for (const n of ['search input', 'debounce', 'request', 'results list']) {
      await palette.getByRole('button', { name: new RegExp(n, 'i') }).first().click()
    }
    await page.getByRole('button', { name: /input-1\.keys/i }).click()
    await page.getByRole('button', { name: /debounce-1\.in/i }).click()
    await page.getByRole('button', { name: /debounce-1\.out/i }).click()
    await page.getByRole('button', { name: /request-1\.trigger/i }).click()
    await page.getByRole('button', { name: /check the design/i }).click()
    await expect(page.getByText(/that is the thing this design is about/i)).toBeVisible()
  })
})
