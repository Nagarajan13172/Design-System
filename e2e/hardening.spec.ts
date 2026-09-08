import { test, expect } from '@playwright/test'

/**
 * M7's exit criteria.
 *
 * The two that matter most are the ones a user only meets on a bad day: a deploy
 * landing mid-session, and a browser deleting their history.
 */
test.describe('stale deploy', () => {
  test('announces a new version rather than white-screening, and does not loop', async ({ page }) => {
    let reloads = 0
    page.on('load', () => { reloads++ })

    await page.goto('/review')
    await expect(page.locator('main')).toBeVisible()

    // Simulate a redeploy: build-id.txt now reports a different build.
    await page.route('**/build-id.txt', r => r.fulfill({ status: 200, body: 'a-newer-build' }))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))

    const bar = page.getByRole('status')
    await expect(bar).toBeVisible()
    await expect(bar).toContainText(/new version is available/i)
    await expect(bar).toContainText(/progress is saved/i)

    // The page is still usable — the bar is an offer, not a takeover.
    await expect(page.locator('main')).toBeVisible()

    await bar.getByRole('button', { name: /reload/i }).click()
    await page.waitForLoadState('load')

    // Reload ONCE. A guard exists because a genuinely broken chunk would otherwise
    // loop forever, which is worse than the white screen it replaced.
    const before = reloads
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForTimeout(500)
    const barAgain = page.getByRole('status')
    if (await barAgain.isVisible()) await barAgain.getByRole('button', { name: /reload/i }).click()
    await page.waitForTimeout(500)
    expect(reloads - before).toBeLessThanOrEqual(1)
  })
})

test.describe('a browser deleting everything', () => {
  test('an exported bundle restores the history in full', async ({ page }) => {
    await page.goto('/review')

    // Build some history: a prediction and a completed module gate.
    await page.goto('/m/state-races')
    await page.getByLabel(/your prediction/i).fill('4')
    await page.getByRole('button', { name: /lock it in/i }).click()
    await expect(page.getByText(/you predicted/i).first()).toBeVisible()

    const before = await page.evaluate(async () => {
      const { exportAll } = await import('/src/data/repo/transfer.ts')
      return await exportAll(Date.now())
    })
    expect((before.stores.predictions as unknown[]).length).toBeGreaterThan(0)

    // ITP eviction: the whole database is gone.
    await page.evaluate(async () => {
      const { resetRepo } = await import('/src/data/repo/index.ts')
      await resetRepo()
    })
    const wiped = await page.evaluate(async () => {
      const { exportAll } = await import('/src/data/repo/transfer.ts')
      return await exportAll(Date.now())
    })
    expect((wiped.stores.predictions as unknown[]).length).toBe(0)

    // Restore from the exported bundle: nothing lost.
    const after = await page.evaluate(async (env) => {
      const { applyImport } = await import('/src/data/repo/transfer.ts')
      const { exportAll } = await import('/src/data/repo/transfer.ts')
      await applyImport(env as never)
      return await exportAll(Date.now())
    }, before)
    expect(JSON.stringify(after.stores)).toBe(JSON.stringify(before.stores))
  })
})

test('settings states the storage situation honestly', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText(/in this browser and nowhere else/i)).toBeVisible()
  await expect(page.getByText(/no account and no server/i)).toBeVisible()
  // Destructive reset is behind a typed confirmation.
  const del = page.getByRole('button', { name: /^delete$/i })
  await expect(del).toBeDisabled()
  await page.getByLabel(/type delete my progress/i).fill('delete my progress')
  await expect(del).toBeEnabled()
})

/**
 * THE 90-SECOND DEMO PATH, from a cold IndexedDB.
 *
 * This is the walk a stranger takes. If it breaks, the product does not have a
 * first impression, whatever else is green.
 */
test('the 90-second demo path, cold', async ({ page }) => {
  // 1. The cold open asks before it explains.
  await page.goto('/start')
  await expect(page.locator('[data-beat="0"]')).toBeVisible()
  await expect(page.locator('[data-span]')).toHaveCount(0)      // no data before the gate

  await page.getByLabel(/your prediction/i).fill('4')
  await page.getByRole('button', { name: /lock it in/i }).click()

  // 2. The measurement lands beside the prediction.
  await expect(page.locator('[data-beat="1"]')).toBeVisible()
  await expect(page.getByText(/you predicted/i).first()).toBeVisible()
  await page.getByRole('button', { name: /what happens to that answer/i }).click()

  // 3. Three axes, stated as three things.
  await expect(page.getByText(/Three axes, three units, no total/i)).toBeVisible()
  await page.getByRole('button', { name: /start the daily queue/i }).click()

  // 4. The daily queue is the landing route.
  await expect(page).toHaveURL(/\/review/)

  // 5. A module ends with recall, not a Next button.
  await page.goto('/m/state-races')
  await page.getByRole('button', { name: /close the page and write what you remember/i }).click()
  await expect(page.getByRole('dialog', { name: /recall gate/i })).toBeVisible()
  await expect(page.locator('article.prose-body')).toHaveCount(0)

  // 6. Mastery REFUSES to render a number without evidence — the strongest moment.
  await page.goto('/progress')
  await expect(page.getByText(/not components of one number/i)).toBeVisible()
  await expect(page.getByText(/insufficient evidence|no evidence yet/i).first()).toBeVisible()
})
