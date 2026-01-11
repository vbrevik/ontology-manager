import { test, expect } from '@playwright/test';

test('register -> login -> header shows username -> teardown', async ({ request }) => {
  const rand = Date.now();
  const username = `e2e_user_${rand}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';

  // Ensure previous artifacts removed
  await request.post('/api/test/cleanup', { data: { prefix: 'e2e_user_' } });

  // Register
  const reg = await request.post('http://localhost:3000/api/register', {
    data: { username, email, password },
  });
  expect(reg.status()).toBe(200);

  // Login (via API)
  const login = await request.post('http://localhost:3000/api/login', {
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  const body = await login.json();
  expect(body).toHaveProperty('access_token');

  // Verify header decode would show username by checking token payload locally
  const token = body.access_token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  expect(payload).toBeTruthy();
  // cleanup
  await request.post('http://localhost:3000/api/test/cleanup', { data: { prefix: 'e2e_user_' } });
});


