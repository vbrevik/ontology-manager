import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:5300' });

test('navigation evaluate returns visible sections', async ({ request }) => {
  const unique = Date.now();
  const email = `e2e-nav-${unique}@example.com`;
  const password = 'Password123!';

  await request.post('/api/auth/test/cleanup', { data: { prefix: 'e2e-nav-' } });

  const reg = await request.post('/api/auth/register', {
    data: { username: `e2e-nav-${unique}`, email, password },
  });
  expect(reg.status()).toBe(200);

  const login = await request.post('/api/auth/login', {
    data: { identifier: email, password },
  });
  expect(login.status()).toBe(200);

  const setCookie = login.headers()['set-cookie'] || '';
  const csrfMatch = /csrf_token=([^;]+)/.exec(setCookie);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  const evalRes = await request.post('/api/navigation/evaluate', {
    data: {},
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
  expect(evalRes.status()).toBe(200);

  const sections = await evalRes.json();
  expect(Array.isArray(sections)).toBeTruthy();
  expect(sections.length).toBeGreaterThan(0);
});
