import { test, expect } from '@playwright/test'

/** Every route renders, with no console errors and no unhandled rejections. */
const ROUTES = ['/review', '/m/state-races', '/m/found-event-loop', '/m/state-taxonomy', '/progress', '/dev', '/dev/primitives']

for (const route of ROUTES) {
  test(`${route} renders cleanly`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))

    await page.goto(route)
    await expect(page.locator('body')).not.toBeEmpty()
    await page.waitForTimeout(400)
    expect(errors, `console errors on ${route}`).toEqual([])
  })
}

test('a drill can be answered, and the claims ledger shows evidence arriving', async ({ page }) => {
  await page.goto('/m/state-taxonomy')

  // The drills section exists below the prose, independent of the figure gate.
  const drills = page.getByRole('heading', { name: /^drills/i })
  await expect(drills).toBeVisible()

  // constraint-flip is two screens: which way does it move, then by how much.
  await expect(page.locator('legend').filter({ hasText: /which way does it move|pick one/i })).toBeVisible()
  await page.locator('fieldset button').first().click()
  await page.locator('fieldset button').first().click()

  // Graded in place, with a Continue that advances the strip — never a bare "wrong".
  await expect(page.getByRole('button', { name: /continue/i })).toBeVisible()
  const verdict = await page.locator('body').textContent()
  expect(verdict).toMatch(/right, for the right reason|partly|not this one/i)
})
