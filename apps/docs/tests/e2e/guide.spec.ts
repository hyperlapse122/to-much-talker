import { test, expect } from '@playwright/test'

test.describe('Docs Guide Pages', () => {
  test('setup guide page loads', async ({ page }) => {
    await page.goto('/guide/setup')
    await expect(page.getByRole('heading', { name: 'Setup Guide', level: 1 })).toBeVisible()
  })

  test('setup guide shows prerequisites section', async ({ page }) => {
    await page.goto('/guide/setup')
    await expect(page.getByRole('heading', { name: 'Prerequisites' })).toBeVisible()
  })

  test('commands page loads', async ({ page }) => {
    await page.goto('/guide/commands')
    await expect(page.getByRole('heading', { name: 'Commands Reference', level: 1 })).toBeVisible()
  })

  test('commands page lists tts commands', async ({ page }) => {
    await page.goto('/guide/commands')
    await expect(page.getByRole('heading', { name: '/tts join' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '/tts leave' })).toBeVisible()
  })

  test('unknown guide shows not found heading', async ({ page }) => {
    await page.goto('/guide/unknown-page-xyz')
    await expect(page.getByRole('heading', { name: /Page not found/ })).toBeVisible()
  })
})
