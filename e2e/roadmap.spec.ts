import { test, expect } from '@playwright/test'

/**
 * M5's exit criteria, as tests.
 *
 * The load-bearing one: a screen-reader or keyboard user must reach any module from
 * /roadmap WITHOUT the canvas existing at all. If that ever stops being true, the
 * canvas has quietly become the interface.
 */
test.describe('/roadmap', () => {
  test('the semantic list is the primary DOM, and the canvas is absent by default', async ({ page }) => {
    await page.goto('/roadmap')
    await expect(page.getByRole('navigation', { name: 'curriculum' })).toBeVisible()
    // No map layer at all on the list view — not hidden, not present.
    expect(await page.locator('svg').count()).toBe(0)
  })

  test('a keyboard-only user reaches a built module without touching a canvas', async ({ page }) => {
    await page.goto('/roadmap')
    const link = page.getByRole('link', { name: /state-races/ }).first()
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/m\/state-races/)
  })

  test('every domain is a native disclosure with aria-expanded', async ({ page }) => {
    await page.goto('/roadmap')
    const disclosures = page.locator('nav[aria-label="curriculum"] > ol > li > button[aria-expanded]')
    await expect(disclosures).toHaveCount(14)   // one per domain
    const first = disclosures.first()
    const before = await first.getAttribute('aria-expanded')
    await first.click()
    expect(await first.getAttribute('aria-expanded')).not.toBe(before)
  })

  test('status is conveyed as text, not colour alone', async ({ page }) => {
    await page.goto('/roadmap')
    const body = (await page.locator('main').textContent()) ?? ''
    expect(body).toMatch(/specified/)
    expect(body).toMatch(/drafted/)
    // The header states the split in plain words, with no percentage anywhere.
    expect(body + (await page.locator('header').textContent())).toMatch(/\d+ built · \d+ specified/)
  })

  test('a planned node still shows its authored claim and figure question', async ({ page }) => {
    await page.goto('/roadmap')
    await page.getByRole('button', { name: /perf-lcp|perf-inp|perf-/ }).first().click().catch(() => {})
    const planned = page.getByRole('button').filter({ hasText: 'specified' }).first()
    await planned.click()
    const aside = page.locator('aside')
    await expect(aside.getByText('the figure asks')).toBeVisible()
    await expect(aside.getByText(/Planned — spec written/)).toBeVisible()
  })

  test('?view=canvas and ?view=map both load it, and it stays out of the tab order', async ({ page }) => {
    await page.goto('/roadmap?view=canvas')
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 5000 })
    await page.goto('/roadmap?view=map')
    const svg = page.locator('svg').first()
    await expect(svg).toBeVisible({ timeout: 5000 })
    // aria-hidden and untabbable: the list underneath is still the interface.
    await expect(page.locator('[aria-hidden="true"] svg').first()).toBeAttached()
    expect(await page.locator('svg a, svg button[tabindex="0"]').count()).toBe(0)
    // And the semantic list is still there behind it.
    await expect(page.getByRole('navigation', { name: 'curriculum' })).toBeAttached()
  })
})

test.describe('the command palette', () => {
  test('opens on ⌘K, shows its mode before you commit, and navigates', async ({ page }) => {
    await page.goto('/review')
    await page.keyboard.press('ControlOrMeta+k')
    const dialog = page.getByRole('dialog', { name: 'command palette' })
    await expect(dialog).toBeVisible()

    // An id prefix must rank FIRST — the test asserts the ranking rather than
    // merely that the row exists somewhere, because Enter acts on the top hit.
    await page.getByLabel('search').fill('ui-stacking')
    const rows = dialog.locator('ul li button')
    await expect(rows.first()).toContainText('ui-stacking-context')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/m\/ui-stacking-context/)
  })

  test('mode prefixes change what is searched, visibly', async ({ page }) => {
    await page.goto('/review')
    await page.keyboard.press('ControlOrMeta+k')
    const dialog = page.getByRole('dialog', { name: 'command palette' })

    await page.getByLabel('search').fill('>')
    await expect(dialog.getByText('command', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Toggle theme')).toBeVisible()

    await page.getByLabel('search').fill('/')
    await expect(dialog.getByText('route', { exact: true })).toBeVisible()
  })

  test('Escape closes it', async ({ page }) => {
    await page.goto('/review')
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByRole('dialog', { name: 'command palette' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'command palette' })).toBeHidden()
  })
})

test('a cold open abandoned at beat 2 resumes at beat 2', async ({ page }) => {
  await page.goto('/start')
  await expect(page.locator('[data-beat="0"]')).toBeVisible()

  // Commit a prediction: that advances to beat 1 and persists it.
  await page.getByLabel(/your prediction/i).fill('4')
  await page.getByRole('button', { name: /lock it in/i }).click()
  await expect(page.locator('[data-beat="1"]')).toBeVisible()

  // Leave, come back: it must not restart and must not vanish.
  await page.goto('/review')
  await page.goto('/start')
  await expect(page.locator('[data-beat="1"]')).toBeVisible()
})
