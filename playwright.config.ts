import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : [['list']],
  use: { baseURL: 'http://localhost:5177', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A dedicated port, and never reuse whatever happens to be listening: an
    // unrelated dev server on 5173 once satisfied `reuseExistingServer` and every
    // gate test "failed" against a completely different application.
    command: 'npx vite --port 5177 --strictPort',
    url: 'http://localhost:5177/review',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
