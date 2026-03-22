/**
 * E2E Tests for CVE-004 Rate Limiting
 * 
 * Tests rate limiting on authentication endpoints:
 * - Login: 5 attempts / 15 minutes
 * - Registration: 3 attempts / hour
 * - Password Reset: 3 requests / hour
 * - MFA: 10 attempts / 5 minutes
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:5300';

test.describe('CVE-004 Rate Limiting', () => {
  
  test.describe('Login Rate Limiting', () => {
    test('should allow 5 login attempts then rate limit', async ({ request }) => {
      const attempts = [];
      
      // Make 5 failed login attempts
      for (let i = 1; i <= 5; i++) {
        const response = await request.post(`${API_BASE}/api/auth/login`, {
          data: {
            username: `test_user_${Date.now()}_${i}`,
            password: 'wrong_password'
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        attempts.push({
          attempt: i,
          status: response.status(),
          statusText: response.statusText()
        });
        
        // Should not be rate limited yet
        expect(response.status()).not.toBe(429);
        console.log(`Attempt ${i}: ${response.status()} ${response.statusText()}`);
      }
      
      // 6th attempt should be rate limited
      const sixthAttempt = await request.post(`${API_BASE}/api/auth/login`, {
        data: {
          username: `test_user_${Date.now()}_6`,
          password: 'wrong_password'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Attempt 6: ${sixthAttempt.status()} ${sixthAttempt.statusText()}`);
      
      // Should be rate limited
      expect(sixthAttempt.status()).toBe(429);
      
      // Check for Retry-After header
      const retryAfter = sixthAttempt.headers()['retry-after'];
      expect(retryAfter).toBeTruthy();
      console.log(`Retry-After: ${retryAfter} seconds`);
    });

    test('should include rate limit headers in 429 response', async ({ request }) => {
      // First exhaust the limit (5 attempts)
      for (let i = 1; i <= 5; i++) {
        await request.post(`${API_BASE}/api/auth/login`, {
          data: {
            username: `exhaust_${Date.now()}_${i}`,
            password: 'wrong'
          }
        });
      }
      
      // Next request should be rate limited
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: {
          username: `exhaust_${Date.now()}_6`,
          password: 'wrong'
        }
      });
      
      expect(response.status()).toBe(429);
      
      const headers = response.headers();
      expect(headers['retry-after']).toBeTruthy();
      expect(headers['x-ratelimit-rule']).toBe('auth-login');
      
      const body = await response.json();
      expect(body.error).toContain('Too many requests');
      expect(body.retry_after).toBeGreaterThan(0);
    });
  });

  test.describe('Registration Rate Limiting', () => {
    test('should allow 3 registration attempts then rate limit', async ({ request }) => {
      const timestamp = Date.now();
      
      // Make 3 registration attempts
      for (let i = 1; i <= 3; i++) {
        const response = await request.post(`${API_BASE}/api/auth/register`, {
          data: {
            username: `newuser_${timestamp}_${i}`,
            email: `newuser_${timestamp}_${i}@test.com`,
            password: 'Password123!'
          }
        });
        
        console.log(`Registration attempt ${i}: ${response.status()}`);
        expect(response.status()).not.toBe(429);
      }
      
      // 4th attempt should be rate limited
      const fourthAttempt = await request.post(`${API_BASE}/api/auth/register`, {
        data: {
          username: `newuser_${timestamp}_4`,
          email: `newuser_${timestamp}_4@test.com`,
          password: 'Password123!'
        }
      });
      
      console.log(`Registration attempt 4: ${fourthAttempt.status()}`);
      expect(fourthAttempt.status()).toBe(429);
    });
  });

  test.describe('Password Reset Rate Limiting', () => {
    test('should allow 3 password reset requests then rate limit', async ({ request }) => {
      const timestamp = Date.now();
      
      // Make 3 password reset requests
      for (let i = 1; i <= 3; i++) {
        const response = await request.post(`${API_BASE}/api/auth/forgot-password`, {
          data: {
            email: `user_${timestamp}_${i}@test.com`
          }
        });
        
        console.log(`Password reset attempt ${i}: ${response.status()}`);
        expect(response.status()).not.toBe(429);
      }
      
      // 4th attempt should be rate limited
      const fourthAttempt = await request.post(`${API_BASE}/api/auth/forgot-password`, {
        data: {
          email: `user_${timestamp}_4@test.com`
        }
      });
      
      console.log(`Password reset attempt 4: ${fourthAttempt.status()}`);
      expect(fourthAttempt.status()).toBe(429);
      
      const body = await fourthAttempt.json();
      expect(body.error).toContain('Too many requests');
    });
  });

  test.describe('Rate Limit Window Expiry', () => {
    test.skip('should reset after window expires', async ({ request }) => {
      // This test would take 15+ minutes to run
      // Skip in normal test runs, enable for integration testing
      
      // Exhaust limit
      for (let i = 1; i <= 5; i++) {
        await request.post(`${API_BASE}/api/auth/login`, {
          data: { username: 'test', password: 'wrong' }
        });
      }
      
      // Should be rate limited
      let response = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'test', password: 'wrong' }
      });
      expect(response.status()).toBe(429);
      
      // Wait for window to expire (15 minutes + 1 second)
      await new Promise(resolve => setTimeout(resolve, (15 * 60 + 1) * 1000));
      
      // Should work again
      response = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'test', password: 'wrong' }
      });
      expect(response.status()).not.toBe(429);
    });
  });

  test.describe('Different IPs', () => {
    test('should rate limit per IP address', async ({ request }) => {
      // Note: In a real test environment, you'd need multiple IPs or proxy support
      // This test documents the expected behavior
      
      const response1 = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'user1', password: 'wrong' },
        headers: {
          'X-Forwarded-For': '192.168.1.1'
        }
      });
      
      const response2 = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'user2', password: 'wrong' },
        headers: {
          'X-Forwarded-For': '192.168.1.2'
        }
      });
      
      // Both should be allowed (different IPs have separate limits)
      expect(response1.status()).not.toBe(429);
      expect(response2.status()).not.toBe(429);
    });
  });

  test.describe('Security Headers', () => {
    test('should include security information in rate limit response', async ({ request }) => {
      // Exhaust limit
      for (let i = 1; i <= 5; i++) {
        await request.post(`${API_BASE}/api/auth/login`, {
          data: { username: `sec_test_${Date.now()}_${i}`, password: 'wrong' }
        });
      }
      
      // Get rate limited response
      const response = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: `sec_test_${Date.now()}_6`, password: 'wrong' }
      });
      
      expect(response.status()).toBe(429);
      
      const body = await response.json();
      
      // Verify response structure
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('retry_after');
      
      // Verify error message doesn't leak sensitive info
      expect(body.message).not.toContain('database');
      expect(body.message).not.toContain('exception');
      expect(body.message).not.toContain('sql');
    });
  });
});

test.describe('Rate Limiting Performance', () => {
  test('should handle rate limit checks efficiently', async ({ request }) => {
    const start = Date.now();
    
    // Make multiple requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        request.post(`${API_BASE}/api/auth/login`, {
          data: { username: `perf_${i}`, password: 'wrong' }
        })
      );
    }
    
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    console.log(`10 requests completed in ${duration}ms`);
    
    // Should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);
  });
});
