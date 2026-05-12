import { test, expect } from '@playwright/test'

// Note: The playground app has a known hydration issue where the RootLayout renders
// <html> inside <div id="root">, which can break interactive form behavior.
// Tests verify structure and visibility; interaction is covered by unit tests.

test.describe('Settings Inspector', () => {
  test('inspector page loads', async ({ page }) => {
    await page.goto('/inspector')
    await expect(page.getByRole('heading', { name: 'Settings Inspector' })).toBeVisible()
  })

  test('guild ID input is visible and editable', async ({ page }) => {
    await page.goto('/inspector')
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible()
    await expect(input).toBeEditable()
  })

  test('lookup button is initially disabled when input is empty', async ({ page }) => {
    await page.goto('/inspector')
    const button = page.getByRole('button', { name: 'Lookup' })
    await expect(button).toBeDisabled()
  })

  test('lookup button has correct initial label', async ({ page }) => {
    await page.goto('/inspector')
    const button = page.getByRole('button', { name: 'Lookup' })
    await expect(button).toBeVisible()
    await expect(button).toHaveText('Lookup')
  })
})
