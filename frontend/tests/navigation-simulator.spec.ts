import { test, expect } from '@playwright/test';

test('navigation simulator shows impact summary', async ({ page }) => {
  const unique = Date.now();
  const username = `navsim_${unique}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';

  await page.request.post('http://localhost:5300/api/auth/register', {
    data: { username, email, password },
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username or Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'System Overview' })).toBeVisible({ timeout: 10000 });

  await page.goto('/admin/navigation');
  await expect(page.getByRole('heading', { name: 'Navigation Simulator' })).toBeVisible();

  await page.getByRole('button', { name: 'Simulate' }).click();

  await expect(page.getByText('Impact Summary')).toBeVisible();
  await expect(page.getByTestId('nav-sim-added')).toBeVisible();
  await expect(page.getByTestId('nav-sim-removed')).toBeVisible();
});
