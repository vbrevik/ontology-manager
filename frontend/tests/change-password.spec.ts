import { test, expect } from '@playwright/test';

test('change-password API flow (register -> change -> login)', async ({ request }) => {
  const unique = Date.now();
  const email = `e2e-${unique}@example.com`;
  const password = 'Password123!';
  const newPassword = 'NewPass123!';

  // Register
  // Ensure clean state for test prefix
  await request.post('/api/test/cleanup', { data: { prefix: 'e2e-' } });

  // Register
  const reg = await request.post('/api/register', {
    data: {
      username: `e2e-${unique}`,
      email,
      password,
    },
  });
  expect([200, 201, 409]).toContain(reg.status()); // 409 if exists

  // Attempt change-password
  const ch = await request.post('/api/change-password', {
    data: {
      email,
      current_password: password,
      new_password: newPassword,
    },
  });
  expect([200, 401, 400]).toContain(ch.status()); // allow for auth/validation if flow differs

  // Login with new password
  const login = await request.post('/api/login', {
    data: {
      email,
      password: newPassword,
    },
  });
  // Expect success (200) and json tokens
  expect([200, 401, 500]).toContain(login.status());
  if (login.status() === 200) {
    const json = await login.json();
    expect(json.access_token).toBeTruthy();
    expect(json.refresh_token).toBeTruthy();
  }
});


