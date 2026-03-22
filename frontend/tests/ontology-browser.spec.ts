import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5300' });

let accessToken: string;

test.beforeAll(async ({ request }) => {
  const unique = Date.now();
  const username = `e2e_browser_${unique}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';

  await request.post('/api/auth/test/cleanup', { data: { prefix: 'e2e_browser_' } });

  const reg = await request.post('/api/auth/register', {
    data: { username, email, password },
  });
  expect(reg.status()).toBe(200);

  const login = await request.post('/api/auth/login', {
    data: { identifier: email, password },
  });
  expect(login.status()).toBe(200);
  const loginJson = await login.json();
  accessToken = loginJson.access_token;
  expect(accessToken).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  await request.post('/api/auth/test/cleanup', { data: { prefix: 'e2e_browser_' } });
});

test.describe('Ontology Browser', () => {
  test.beforeEach(async ({ page }) => {
    // Set auth token and navigate
    await page.addInitScript((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    await page.goto('/ontology');
  });

  test('page loads with tree and detail panels', async ({ page }) => {
    await expect(page.getByTestId('class-tree')).toBeVisible();
    await expect(page.getByTestId('class-detail')).toBeVisible();
  });

  test('click a class in tree shows detail', async ({ page }) => {
    const treeItem = page.getByRole('treeitem').first();
    await treeItem.click();
    await expect(page.getByTestId('class-detail').locator('h2')).toBeVisible();
  });

  test('expand and collapse tree nodes', async ({ page }) => {
    const chevron = page.getByTestId('tree-chevron').first();
    if (await chevron.isVisible()) {
      await chevron.click();
      // After expand, children should appear
      const childCount = await page.getByRole('treeitem').count();
      expect(childCount).toBeGreaterThan(1);

      // Collapse
      await chevron.click();
    }
  });

  test('search filters tree nodes', async ({ page }) => {
    const search = page.getByPlaceholder('Search classes...');
    await search.fill('Vehicle');
    await page.waitForTimeout(400); // debounce
    const visibleItems = page.getByRole('treeitem');
    const count = await visibleItems.count();
    expect(count).toBeGreaterThan(0);

    // Clear search
    await search.clear();
    await page.waitForTimeout(400);
  });

  test('create new class via dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new class/i }).click();
    await page.getByPlaceholder('Class name').fill('TestClass');
    await page.getByRole('button', { name: /create/i }).click();

    // New class should appear in tree
    await expect(page.getByText('TestClass')).toBeVisible({ timeout: 5000 });
  });

  test('inline edit description', async ({ page }) => {
    // Select first class
    const treeItem = page.getByRole('treeitem').first();
    await treeItem.click();

    // Wait for detail to load
    await expect(page.getByTestId('class-detail').locator('h2')).toBeVisible();

    // Click description area to edit
    const editableArea = page.getByTestId('class-detail').locator('.hover\\:bg-muted\\/50').first();
    if (await editableArea.isVisible()) {
      await editableArea.click();
      const textarea = page.getByRole('textbox');
      await textarea.fill('Updated description');
      await textarea.blur();
    }
  });

  test('keyboard navigation through tree', async ({ page }) => {
    // Focus the tree
    const tree = page.getByRole('tree');
    await tree.focus();

    // Arrow down to navigate
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Detail panel should update
    await expect(page.getByTestId('class-detail').locator('h2')).toBeVisible();
  });
});
