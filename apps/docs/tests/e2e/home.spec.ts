import { test, expect } from '@playwright/test'

test.describe('Docs Home', () => {
  test('home page loads with title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/To Much Talker/)
    await expect(page.getByRole('heading', { name: 'To Much Talker', level: 1 })).toBeVisible()
  })

  test('navigation links exist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Setup' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Commands' })).toBeVisible()
  })

  test('get started button is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible()
  })

  test('feature cards are rendered', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Multiple TTS Models' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Per-Guild Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'BYOK' })).toBeVisible()
  })
})
