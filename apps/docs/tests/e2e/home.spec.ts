import { expect, test } from '@playwright/test'

test('home page renders migrated markdown content and navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/To Much Talker/)
  await expect(page.getByRole('heading', { level: 1, name: 'To Much Talker' })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Multiple TTS Models' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Per-Guild Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'BYOK' })).toBeVisible()

  const sidebar = page.getByRole('navigation', { name: 'Documentation' })
  await expect(sidebar.getByRole('link', { name: 'Setup Guide' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Commands Reference' })).toBeVisible()

  await page.getByRole('link', { name: 'Get Started' }).click()
  await expect(page).toHaveURL(/\/guide\/setup$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Setup Guide' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})
