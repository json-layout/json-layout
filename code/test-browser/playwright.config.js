import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.browser.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    // Invoke the local Vite binary directly. `npx vite` (and `npm exec vite`)
    // spawned under Playwright's webServer ends up failing to load our
    // vite.config.js — they run with cwd=test-browser/ but Vite still picks
    // the default (root=cwd-of-parent, port 5173). Running the binary directly
    // respects cwd and loads the config.
    command: '../node_modules/.bin/vite',
    cwd: here,
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000
  }
})
