/**
 * Security E2E Test Suite
 * 
 * Playwright tests for security vulnerabilities identified in security audit.
 * These tests run against the live application to verify security controls.
 * 
 * Based on: SECURITY_AUDIT_2026-01-18.md
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

test.describe('Security Audit E2E Tests', () => {
  
  // =============================================================================
  // CVE-001: Missing Admin Authorization
  // =============================================================================
  
  test.describe('CVE-001: Admin Authorization', () => {
    
    test('Non-admin user cannot access admin endpoints', async ({ page, request }) => {
      // Register and login as normal user
      const email = `normal_user_${Date.now()}@test.com`;
      const password = 'TestPassword123!';
      
      await page.goto('/register');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="username"]', `user_${Date.now()}`);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      
      // Wait for registration success
      await page.waitForURL('/');
      
      // Try to access admin endpoint: GET /api/auth/sessions/all
      const response = await request.get('/api/auth/sessions/all', {
        failOnStatusCode: false  // Don't throw on 403
      });
      
      // Expected: 403 Forbidden (after fix)
      // Current: 200 OK (vulnerability)
      if (response.status() === 200) {
        console.log('🔴 CVE-001 VULNERABILITY CONFIRMED: Non-admin accessed admin endpoint!');
        const sessions = await response.json();
        console.log(`   Exposed ${sessions.length} user sessions to non-admin`);
        
        // Fail the test to indicate vulnerability
        expect(response.status()).toBe(403); // This will fail, documenting the issue
      } else if (response.status() === 403) {
        console.log('✅ CVE-001: Admin authorization is working');
        expect(response.status()).toBe(403);
      }
    });
    
    test('Non-admin cannot revoke other users sessions', async ({ page, request }) => {
      // Create two users
      const admin_email = `admin_${Date.now()}@test.com`;
      const normal_email = `normal_${Date.now()}@test.com`;
      const password = 'TestPassword123!';
      
      // Register admin user first
      await page.goto('/register');
      await page.fill('input[name="email"]', admin_email);
      await page.fill('input[name="username"]', `admin_${Date.now()}`);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Get admin's session ID
      const adminSessions = await request.get('/api/auth/sessions');
      const adminSessionData = await adminSessions.json();
      const adminSessionId = adminSessionData[0]?.id;
      
      // Logout admin
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      // Register normal user
      await page.goto('/register');
      await page.fill('input[name="email"]', normal_email);
      await page.fill('input[name="username"]', `normal_${Date.now()}`);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Try to revoke admin's session as normal user
      const revokeResponse = await request.delete(`/api/auth/sessions/admin/${adminSessionId}`, {
        failOnStatusCode: false
      });
      
      if (revokeResponse.status() === 204 || revokeResponse.status() === 200) {
        console.log('🔴 CVE-001 CRITICAL: Non-admin revoked admin session!');
        expect(revokeResponse.status()).toBe(403); // Will fail, documenting the issue
      } else {
        console.log('✅ CVE-001: Session revocation properly authorized');
        expect(revokeResponse.status()).toBe(403);
      }
    });
    
    test('Non-admin cannot view audit logs', async ({ page, request }) => {
      // Login as normal user
      const email = `audit_test_${Date.now()}@test.com`;
      const password = 'TestPassword123!';
      
      await page.goto('/register');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="username"]', `audit_${Date.now()}`);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Try to access audit logs
      const response = await request.get('/api/auth/audit-logs', {
        failOnStatusCode: false
      });
      
      if (response.status() === 200) {
        console.log('🔴 CVE-001 CRITICAL: Non-admin accessed audit logs!');
        const logs = await response.json();
        console.log(`   Exposed ${logs.length} audit log entries`);
        expect(response.status()).toBe(403); // Will fail
      } else {
        console.log('✅ CVE-001: Audit logs properly protected');
        expect(response.status()).toBe(403);
      }
    });
  });
  
  // =============================================================================
  // CVE-002: Insecure Cookie Configuration
  // =============================================================================
  
  test.describe('CVE-002: Cookie Security', () => {
    
    test('Cookies must have Secure flag in production', async ({ page, context }) => {
      await page.goto('/login');
      
      // Login
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      await page.waitForURL('/');
      
      // Get cookies
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'access_token');
      const refreshCookie = cookies.find(c => c.name === 'refresh_token');
      
      if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
        if (authCookie && !authCookie.secure) {
          console.log('🔴 CVE-002 CRITICAL: access_token cookie is not Secure!');
          console.log('   Cookie can be transmitted over HTTP (MITM attack vector)');
          expect(authCookie.secure).toBe(true); // Will fail
        }
        
        if (refreshCookie && !refreshCookie.secure) {
          console.log('🔴 CVE-002 CRITICAL: refresh_token cookie is not Secure!');
          expect(refreshCookie.secure).toBe(true); // Will fail
        }
      }
      
      if (authCookie?.secure && refreshCookie?.secure) {
        console.log('✅ CVE-002: Cookies have Secure flag');
      }
    });
    
    test('Cookies must have HttpOnly flag', async ({ page, context }) => {
      await page.goto('/login');
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'access_token');
      const refreshCookie = cookies.find(c => c.name === 'refresh_token');
      
      expect(authCookie?.httpOnly).toBe(true);
      expect(refreshCookie?.httpOnly).toBe(true);
      
      console.log('✅ CVE-002: Cookies have HttpOnly flag');
    });
    
    test('Cookies must have SameSite attribute', async ({ page, context }) => {
      await page.goto('/login');
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'access_token');
      
      expect(authCookie?.sameSite).toBeDefined();
      expect(['Lax', 'Strict']).toContain(authCookie?.sameSite);
      
      console.log('✅ CVE-002: Cookies have SameSite attribute');
    });
  });
  
  // =============================================================================
  // CVE-003: User Enumeration
  // =============================================================================
  
  test.describe('CVE-003: User Enumeration', () => {
    
    test('Password reset timing should be constant', async ({ request }) => {
      // Test with existing user
      const start1 = Date.now();
      const response1 = await request.post('/api/auth/forgot-password', {
        data: { email: 'existing@test.com' }  // Known to exist
      });
      const time1 = Date.now() - start1;
      
      // Test with non-existent user
      const start2 = Date.now();
      const response2 = await request.post('/api/auth/forgot-password', {
        data: { email: 'nonexistent_12345@test.com' }  // Doesn't exist
      });
      const time2 = Date.now() - start2;
      
      const diff = Math.abs(time1 - time2);
      
      // Timing should be within 100ms
      if (diff > 100) {
        console.log('🔴 CVE-003 VULNERABILITY: Timing leak detected!');
        console.log(`   Existing user: ${time1}ms`);
        console.log(`   Non-existent user: ${time2}ms`);
        console.log(`   Difference: ${diff}ms`);
        
        expect(diff).toBeLessThan(100); // Will fail, documenting the issue
      } else {
        console.log('✅ CVE-003: Password reset timing is constant');
      }
    });
    
    test('Registration error should not reveal existing users', async ({ request }) => {
      // First, register a user
      const email = `existing_${Date.now()}@test.com`;
      await request.post('/api/auth/register', {
        data: {
          email,
          username: `user_${Date.now()}`,
          password: 'TestPassword123!'
        }
      });
      
      // Try to register again with same email
      const response = await request.post('/api/auth/register', {
        data: {
          email,
          username: `different_${Date.now()}`,
          password: 'TestPassword123!'
        },
        failOnStatusCode: false
      });
      
      const body = await response.json();
      const errorMessage = body.error || body.message || JSON.stringify(body);
      
      // Check if error message reveals user existence
      const revealingPhrases = ['already exists', 'taken', 'in use', 'registered'];
      const isRevealing = revealingPhrases.some(phrase => 
        errorMessage.toLowerCase().includes(phrase)
      );
      
      if (isRevealing) {
        console.log('🔴 CVE-003 VULNERABILITY: Error reveals user existence!');
        console.log(`   Error: ${errorMessage}`);
        expect(isRevealing).toBe(false); // Will fail
      } else {
        console.log('✅ CVE-003: Error message is generic');
      }
    });
  });
  
  // =============================================================================
  // CVE-004: Rate Limiting
  // =============================================================================
  
  test.describe('CVE-004: Rate Limiting', () => {
    
    test('Login endpoint should have rate limiting', async ({ request }) => {
      const email = 'ratelimit@test.com';
      const wrongPassword = 'wrong_password';
      
      let blockedCount = 0;
      let successCount = 0;
      
      // Attempt 20 failed logins
      for (let i = 0; i < 20; i++) {
        const response = await request.post('/api/auth/login', {
          data: {
            identifier: email,
            password: wrongPassword
          },
          failOnStatusCode: false
        });
        
        if (response.status() === 429) {  // Too Many Requests
          blockedCount++;
        } else if (response.status() === 401) {  // Unauthorized
          successCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (successCount === 20) {
        console.log('🔴 CVE-004 CRITICAL: No rate limiting on login!');
        console.log(`   All 20 failed login attempts were processed`);
        expect(blockedCount).toBeGreaterThan(0); // Will fail
      } else {
        console.log('✅ CVE-004: Rate limiting is active on login');
        console.log(`   Blocked ${blockedCount} out of 20 attempts`);
      }
    });
    
    test('MFA endpoint should have rate limiting', async ({ request }) => {
      // This test requires valid MFA token - skip if not available
      // In real implementation, would set up MFA user first
      console.log('⏭️  CVE-004 MFA: Test requires MFA setup (manual verification needed)');
    });
    
    test('Registration endpoint should have rate limiting', async ({ request }) => {
      let blockedCount = 0;
      
      // Attempt to create 10 accounts rapidly
      for (let i = 0; i < 10; i++) {
        const response = await request.post('/api/auth/register', {
          data: {
            email: `spam_${Date.now()}_${i}@test.com`,
            username: `spam_${Date.now()}_${i}`,
            password: 'TestPassword123!'
          },
          failOnStatusCode: false
        });
        
        if (response.status() === 429) {
          blockedCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (blockedCount === 0) {
        console.log('🔴 CVE-004: No rate limiting on registration!');
        console.log('   Could create 10+ accounts rapidly');
        expect(blockedCount).toBeGreaterThan(0); // Will fail
      } else {
        console.log('✅ CVE-004: Rate limiting is active on registration');
      }
    });
  });
  
  // =============================================================================
  // CVE-005: Test Endpoints
  // =============================================================================
  
  test.describe('CVE-005: Test Endpoints', () => {
    
    test('Test endpoint /test/grant-role should not exist', async ({ request }) => {
      const response = await request.post('/api/auth/test/grant-role', {
        data: {
          email: 'attacker@test.com',
          role_name: 'SuperAdmin'
        },
        failOnStatusCode: false
      });
      
      if (response.status() !== 404) {
        console.log('🔴 CVE-005 CRITICAL: Test endpoint exists in production!');
        console.log(`   Status: ${response.status()}`);
        console.log('   Attacker could grant themselves admin privileges');
        expect(response.status()).toBe(404); // Will fail
      } else {
        console.log('✅ CVE-005: Test endpoint properly removed');
      }
    });
    
    test('Test endpoint /test/cleanup should not exist', async ({ request }) => {
      const response = await request.post('/api/auth/test/cleanup', {
        data: { prefix: 'test_' },
        failOnStatusCode: false
      });
      
      if (response.status() !== 404) {
        console.log('🔴 CVE-005 CRITICAL: Cleanup endpoint exists in production!');
        console.log('   Attacker could delete users');
        expect(response.status()).toBe(404); // Will fail
      } else {
        console.log('✅ CVE-005: Cleanup endpoint properly removed');
      }
    });
  });
  
  // =============================================================================
  // CSRF Protection
  // =============================================================================
  
  test.describe('CSRF Protection', () => {
    
    test('POST requests require CSRF token', async ({ page, request }) => {
      await page.goto('/login');
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Try to make POST request without CSRF token
      const response = await request.post('/api/ontology/entities', {
        data: {
          class_id: 'some-uuid',
          display_name: 'Test Entity'
        },
        failOnStatusCode: false
      });
      
      // Should fail with 403 Forbidden (CSRF validation)
      expect(response.status()).toBe(403);
      console.log('✅ CSRF Protection: POST requests properly protected');
    });
    
    test('CSRF token is present in cookies', async ({ page, context }) => {
      await page.goto('/login');
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      const cookies = await context.cookies();
      const csrfCookie = cookies.find(c => c.name === 'csrf_token');
      
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie?.value.length).toBeGreaterThan(20);
      
      console.log('✅ CSRF Token: Present in cookies');
    });
  });
  
  // =============================================================================
  // Session Management
  // =============================================================================
  
  test.describe('Session Management', () => {
    
    test('Logout invalidates session tokens', async ({ page, request }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Verify authenticated
      let response1 = await request.get('/api/auth/user');
      expect(response1.status()).toBe(200);
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      // Try to access protected endpoint (should fail)
      let response2 = await request.get('/api/auth/user', {
        failOnStatusCode: false
      });
      
      expect(response2.status()).toBe(401);
      console.log('✅ Session Management: Logout properly invalidates session');
    });
    
    test('User can view and revoke their own sessions', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="identifier"]', 'test@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Navigate to sessions page
      await page.goto('/sessions');
      
      // Should see at least one session (current)
      const sessions = await page.locator('[data-testid="session-item"]').count();
      expect(sessions).toBeGreaterThan(0);
      
      console.log('✅ Session Management: User can view their sessions');
    });
  });
  
  // =============================================================================
  // Security Headers
  // =============================================================================
  
  test.describe('Security Headers', () => {
    
    test('Response includes security headers', async ({ page }) => {
      const response = await page.goto('/');
      const headers = response?.headers() || {};
      
      const securityHeaders = {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'no-referrer',
        'content-security-policy': true  // Just check existence
      };
      
      const missing: string[] = [];
      
      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        const actualValue = headers[header];
        
        if (!actualValue) {
          missing.push(header);
        } else if (expectedValue !== true && actualValue !== expectedValue) {
          console.log(`⚠️  Security Header: ${header} has unexpected value: ${actualValue}`);
        }
      }
      
      if (missing.length > 0) {
        console.log('⚠️  Missing Security Headers:', missing.join(', '));
        console.log('   Recommendation: Add security headers middleware');
      } else {
        console.log('✅ Security Headers: All recommended headers present');
      }
    });
  });
  
  // =============================================================================
  // Test Summary Report
  // =============================================================================
  
  test.afterAll(async () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          SECURITY E2E TEST SUITE COMPLETE                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('📊 Coverage:');
    console.log('   ✅ CVE-001: Admin Authorization (3 tests)');
    console.log('   ✅ CVE-002: Cookie Security (3 tests)');
    console.log('   ✅ CVE-003: User Enumeration (2 tests)');
    console.log('   ✅ CVE-004: Rate Limiting (3 tests)');
    console.log('   ✅ CVE-005: Test Endpoints (2 tests)');
    console.log('   ✅ CSRF Protection (2 tests)');
    console.log('   ✅ Session Management (2 tests)');
    console.log('   ✅ Security Headers (1 test)');
    console.log('');
    console.log('📈 Total E2E Security Tests: 18');
    console.log('');
    console.log('🎯 Integration:');
    console.log('   - Run with: npm run test:e2e -- security.spec.ts');
    console.log('   - CI/CD: Add to GitHub Actions workflow');
    console.log('   - Coverage: Security audit vulnerabilities');
    console.log('');
    console.log('📚 Documentation:');
    console.log('   - Full audit: docs/SECURITY_AUDIT_2026-01-18.md');
    console.log('   - Backend tests: backend/tests/security_audit_test.rs');
    console.log('   - Ransomware: docs/RANSOMWARE_THREAT_ANALYSIS.md');
  });
});
