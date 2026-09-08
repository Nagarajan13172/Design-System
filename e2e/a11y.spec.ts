import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * An app that teaches accessibility and fails it is dead on arrival with this
 * audience. `/dev/primitives` is the highest-leverage page to gate: a contrast or
 * labelling defect in a primitive fails ONCE here, rather than in each of the
 * dozens of modules that will eventually use it.
 */
const ROUTES = ['/dev/primitives', '/review', '/progress', '/m/state-races']

for (const route of ROUTES) {
  test(`${route} has no serious or critical axe violations`, async ({ page }) => {
    await page.goto(route)
    // Wait for a real signal, not a fixed delay: a module route loads its chunk
    // asynchronously, and scanning mid-load reported violations that vanished on a
    // longer sleep — a flaky gate is worse than no gate.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main, [role="dialog"]').first()).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Some demos are deliberately broken — an unnamed icon button IS what
      // incl-a11y-tree teaches. They are excluded by an explicit attribute so a
      // real regression anywhere else still fails.
      .exclude('[data-intentional-a11y-defect]')
      .analyze()

    const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    const summary = blocking.map(v => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`).join('\n')
    expect(blocking, `serious/critical violations on ${route}:\n${summary}`).toEqual([])
  })
}

test('both themes are gated, not just the default', async ({ page }) => {
  await page.goto('/dev/primitives')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  const results = await new AxeBuilder({ page }).withTags(['wcag2aa'])
    .exclude('[data-intentional-a11y-defect]').analyze()
  const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(blocking.map(v => v.id)).toEqual([])
})
