import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5300' });

test('ontology roles catalog is available via ABAC and ReBAC', async ({ request }) => {
  const unique = Date.now();
  const username = `e2e_role_${unique}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';

  // Ensure clean state for test prefix
  await request.post('/api/auth/test/cleanup', { data: { prefix: 'e2e_role_' } });

  // Register
  const reg = await request.post('/api/auth/register', {
    data: { username, email, password },
  });
  expect(reg.status()).toBe(200);

  // Login to obtain access token
  const login = await request.post('/api/auth/login', {
    data: { identifier: email, password },
  });
  expect(login.status()).toBe(200);
  const loginJson = await login.json();
  const accessToken: string = loginJson.access_token;
  expect(accessToken).toBeTruthy();

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // ABAC roles list should include the default ontology roles
  const abacRolesResp = await request.get('/api/abac/roles', { headers: authHeaders });
  expect(abacRolesResp.status()).toBe(200);
  const abacRoles = await abacRolesResp.json();
  const abacRoleNames = abacRoles.map((r: { name: string }) => r.name);
  expect(abacRoleNames).toEqual(expect.arrayContaining(['superadmin', 'admin', 'editor', 'viewer']));

  // ABAC permissions for admin role should exist
  const adminRole = abacRoles.find((r: { name: string }) => r.name === 'admin');
  expect(adminRole).toBeTruthy();
  const adminPermsResp = await request.get(`/api/abac/permissions/${adminRole.id}`, { headers: authHeaders });
  expect(adminPermsResp.status()).toBe(200);
  const adminPerms = await adminPermsResp.json();
  expect(adminPerms.length).toBeGreaterThan(0);

  // ReBAC roles list should mirror ontology roles
  const rebacRolesResp = await request.get('/api/rebac/roles', { headers: authHeaders });
  expect(rebacRolesResp.status()).toBe(200);
  const rebacRoles = await rebacRolesResp.json();
  const rebacRoleNames = rebacRoles.map((r: { name: string }) => r.name);
  expect(rebacRoleNames).toEqual(expect.arrayContaining(['superadmin', 'admin', 'editor', 'viewer']));
});
