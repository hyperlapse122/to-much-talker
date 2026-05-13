import { expect, test } from '@playwright/test'

test('setup guide renders prerequisites and code block copy control', async ({ page }) => {
  await page.goto('/guide/setup')

  await expect(page.getByRole('heading', { level: 1, name: 'Setup Guide' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Prerequisites' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy code' }).first()).toBeVisible()
})

test('commands guide lists slash command reference content', async ({ page }) => {
  await page.goto('/guide/commands')

  await expect(page.getByRole('heading', { level: 1, name: 'Commands Reference' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: '/tts join' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '/tts leave' })).toBeVisible()
})

test('unknown guide route renders the not found page', async ({ page }) => {
  await page.goto('/guide/unknown-page-xyz')

  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test('top-level markdown docs route through the catch-all route', async ({ page }) => {
  await page.goto('/faq')

  await expect(page.getByRole('heading', { level: 1, name: 'FAQ' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Can I use my own OpenRouter key?' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'FAQ' }),
  ).toBeVisible()
})
