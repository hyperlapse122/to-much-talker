import { defineConfig, devices } from '@playwright/test'

const isCi = !!process.env['CI']

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'yarn workspace @to-much-talker/playground preview --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCi,
    timeout: 30 * 1000,
  },
})
