import { expect, test } from '@playwright/test'

test('search opens with keyboard shortcut and navigates from Pagefind result', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Open search' })).toBeVisible()

  await page.keyboard.press('Control+KeyK')

  const dialog = page.getByRole('dialog', { name: 'Search' })
  await expect(dialog).toBeVisible()

  const searchInput = dialog.getByRole('combobox', { name: 'Search docs' })
  await expect(searchInput).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Close search' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(searchInput).toBeFocused()

  await searchInput.fill('Prerequisites')
  await page.keyboard.press('Control+KeyK')
  await expect(dialog).toBeVisible()
  await expect(searchInput).toBeFocused()

  const firstResult = dialog.locator('[role="option"]').first()
  // Pagefind returns sub-section fragments when the query matches a heading
  // (here "Prerequisites" is an h2 in the Setup guide), so the result's
  // `title` field can be empty. Verify the destination via the link href
  // instead of the rendered title text.
  await expect(firstResult).toContainText('Prerequisites')
  await expect(firstResult.locator('a').first()).toHaveAttribute('href', /\/guide\/setup/)

  await firstResult.click()
  await expect(page).toHaveURL(/\/guide\/setup/)
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden()
})

test('escape closes the search dialog', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Open search' })).toBeVisible()

  await page.keyboard.press('Control+KeyK')
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
