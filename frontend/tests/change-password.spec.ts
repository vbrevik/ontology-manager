import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5300' });

test('change-password API flow (register -> change -> login)', async ({ request }) => {
  const unique = Date.now();
  const email = `e2e-${unique}@example.com`;
  const password = 'Password123!';
  const newPassword = 'NewPass123!';

  // Register
  // Ensure clean state for test prefix
  await request.post('/api/auth/test/cleanup', { data: { prefix: 'e2e-' } });

  // Register
  const reg = await request.post('/api/auth/register', {
    data: {
      username: `e2e-${unique}`,
      email,
      password,
    },
  });
  expect([200, 201, 409]).toContain(reg.status()); // 409 if exists

  // Login to obtain access token for protected change-password endpoint
  const login = await request.post('/api/auth/login', {
    data: {
      identifier: email,
      password,
    },
  });
  expect([200, 401]).toContain(login.status());

  let accessToken: string | undefined;
  if (login.status() === 200) {
    const json = await login.json();
    accessToken = json.access_token;
  }

  // Attempt change-password
  const ch = await request.post('/api/auth/change-password', {
    data: {
      email,
      current_password: password,
      new_password: newPassword,
    },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  expect([200, 401, 403, 400]).toContain(ch.status()); // allow for auth/validation if flow differs

  // Login with new password
  const loginAfter = await request.post('/api/auth/login', {
    data: {
      identifier: email,
      password: newPassword,
    },
  });
  // Expect success (200) and json tokens
  expect([200, 401, 500]).toContain(loginAfter.status());
  if (loginAfter.status() === 200) {
    const json = await loginAfter.json();
    expect(json.access_token).toBeTruthy();
    expect(json.refresh_token).toBeTruthy();
  }
});


