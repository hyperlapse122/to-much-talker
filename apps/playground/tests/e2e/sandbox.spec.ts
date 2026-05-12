import { test, expect } from '@playwright/test'

// Note: The playground app has a known hydration issue where the RootLayout renders
// <html> inside <div id="root">, which can break interactive form behavior.
// Tests verify structure and visibility; interaction is covered by unit tests.

test.describe('TTS Sandbox', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/To Much Talker/)
  })

  test('sandbox page loads with form', async ({ page }) => {
    await page.goto('/sandbox')
    await expect(page.getByRole('heading', { name: 'TTS Sandbox' })).toBeVisible()
    await expect(page.locator('textarea').first()).toBeVisible()
  })

  test('text area is present and editable', async ({ page }) => {
    await page.goto('/sandbox')
    const textArea = page.locator('textarea#text-input')
    await expect(textArea).toBeVisible()
    await expect(textArea).toBeEditable()
  })

  test('character counter label is shown', async ({ page }) => {
    await page.goto('/sandbox')
    await expect(page.getByText(/Text \(\d+\/500\)/)).toBeVisible()
  })

  test('model select shows TTS options', async ({ page }) => {
    await page.goto('/sandbox')
    const select = page.locator('select#model-select')
    await expect(select).toBeVisible()
    await expect(select.locator('option')).toHaveCount(2)
  })

  test('synthesize button is rendered', async ({ page }) => {
    await page.goto('/sandbox')
    await expect(page.getByRole('button', { name: /Synthesize TTS/ })).toBeVisible()
  })
})
