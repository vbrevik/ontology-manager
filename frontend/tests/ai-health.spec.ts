import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5300' });

test('ai provider status is healthy and models are listed', async ({ request }) => {
  const unique = Date.now();
  const email = `e2e-ai-${unique}@example.com`;
  const password = 'Password123!';

  await request.post('/api/auth/test/cleanup', { data: { prefix: 'e2e-ai-' } });

  const reg = await request.post('/api/auth/register', {
    data: { username: `e2e-ai-${unique}`, email, password },
  });
  expect(reg.status()).toBe(200);

  const login = await request.post('/api/auth/login', {
    data: { identifier: email, password },
  });
  expect(login.status()).toBe(200);
  const body = await login.json();

  const authHeaders = { Authorization: `Bearer ${body.access_token}` };

  const status = await request.get('/api/ai/status', { headers: authHeaders });
  expect(status.status()).toBe(200);
  const statusJson = await status.json();
  expect(statusJson.status).toBe('Healthy');

  const models = await request.get('/api/ai/models', { headers: authHeaders });
  expect(models.status()).toBe(200);
  const modelList = await models.json();
  expect(Array.isArray(modelList)).toBeTruthy();
  expect(modelList.length).toBeGreaterThan(0);
});
