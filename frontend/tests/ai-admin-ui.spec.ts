import { test, expect } from '@playwright/test';

test('admin AI UI shows online status', async ({ page }) => {
  await page.goto('/register');

  const unique = Date.now();
  const username = `ui_ai_${unique}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';

  await page.getByRole('textbox', { name: 'Username' }).fill(username);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for dashboard to ensure auth cookies are set
  await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();

  await page.goto('/admin/ai');

  await expect(page.getByRole('heading', { name: 'AI Orchestrator' })).toBeVisible();

  // Wait for AI status to load
  await expect(page.getByText('http://localhost:11434/v1').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Online')).toBeVisible({ timeout: 15000 });
});
