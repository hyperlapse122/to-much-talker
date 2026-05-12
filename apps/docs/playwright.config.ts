import { defineConfig, devices } from '@playwright/test'

const isCi = !!process.env['CI']
const port = parseInt(process.env['PLAYWRIGHT_PORT'] ?? '14000', 10)

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `yarn workspace @to-much-talker/docs preview --port ${String(port)}`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCi,
    timeout: 30 * 1000,
  },
})
