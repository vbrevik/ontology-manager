import { test, expect } from '@playwright/test'

test('should navigate to login page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Multi-Service App/)
})

test('should display login form', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('h1')).toContainText('Login')
  await expect(page.locator('input[name="email"]')).toBeVisible()
  await expect(page.locator('input[name="password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test('should display register form', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('h1')).toContainText('Register')
  await expect(page.locator('input[name="email"]')).toBeVisible()
  await expect(page.locator('input[name="password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})
