import { expect, test } from '@playwright/test'

test('search opens with keyboard shortcut and navigates from Pagefind result', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Open search' })).toBeVisible()

  await page.keyboard.press('Control+KeyK')

  const dialog = page.getByRole('dialog', { name: 'Search' })
  await expect(dialog).toBeVisible()

  const searchInput = dialog.getByRole('combobox', { name: 'Search docs' })
  await expect(searchInput).toBeFocused()
  await searchInput.fill('Prerequisites')

  const firstResult = dialog.locator('[role="option"]').first()
  await expect(firstResult).toContainText('Setup Guide')
  await expect(firstResult).toContainText('Prerequisites')

  await firstResult.click()
  await expect(page).toHaveURL(/\/guide\/setup$/)
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
