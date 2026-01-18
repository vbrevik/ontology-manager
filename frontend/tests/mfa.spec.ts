import { test, expect } from '@playwright/test';

test.describe('MFA Login Flow', () => {
    // Note: These tests require a user with MFA enabled
    // In a real test environment, you'd create the user and enable MFA via API

    test.skip('should redirect to MFA challenge when MFA is required', async ({ page }) => {
        // This test requires MFA to be set up for a test user
        // Skip by default as it needs manual setup
        
        await page.goto('http://localhost:5373/login');
        
        // Login with MFA-enabled user
        await page.fill('input[placeholder*="username or email"]', 'mfa_user@example.com');
        await page.fill('input[placeholder*="password"]', 'Password123!');
        await page.click('button[type="submit"]');
        
        // Should redirect to MFA challenge
        await page.waitForURL('**/mfa-challenge', { timeout: 5000 });
        await expect(page.locator('h1:has-text("Two-Factor Authentication")')).toBeVisible();
    });

    test('MFA challenge page should have correct elements', async ({ page }) => {
        // Navigate directly to MFA challenge page
        // (Would normally have mfa_token in sessionStorage from login)
        await page.goto('http://localhost:5373/mfa-challenge');
        
        // Without MFA token, should redirect back to login
        await page.waitForURL('**/login', { timeout: 5000 });
    });

    test.skip('should accept valid TOTP code', async ({ page }) => {
        // This test requires manual TOTP code generation
        // Skip by default
        
        // Assuming mfa_token is in sessionStorage
        await page.goto('http://localhost:5373/mfa-challenge');
        
        await page.fill('input[placeholder*="000000"]', '123456');
        await page.click('button[type="submit"]');
        
        // Should either succeed or show error based on code validity
        // In real test, we'd generate valid TOTP code
    });

    test.skip('should show error for invalid TOTP code', async ({ page }) => {
        await page.goto('http://localhost:5373/mfa-challenge');
        
        await page.fill('input[placeholder*="000000"]', '000000');
        await page.click('button[type="submit"]');
        
        // Should show error
        await expect(page.locator('text=Invalid verification code')).toBeVisible({ timeout: 5000 });
    });

    test('should allow canceling MFA challenge', async ({ page }) => {
        // Set fake MFA token to access the page
        await page.goto('http://localhost:5373/login');
        
        // Inject MFA token into sessionStorage
        await page.evaluate(() => {
            sessionStorage.setItem('mfa_token', 'fake_token_for_testing');
        });
        
        await page.goto('http://localhost:5373/mfa-challenge');
        
        // Should show the form now
        await expect(page.getByText('Two-Factor Authentication')).toBeVisible({ timeout: 5000 });
        
        // Click cancel
        await page.click('button:has-text("Cancel")');
        
        // Should return to login
        await page.waitForURL('**/login', { timeout: 5000 });
        
        // Verify sessionStorage is cleared
        const mfaToken = await page.evaluate(() => sessionStorage.getItem('mfa_token'));
        expect(mfaToken).toBeNull();
    });

    test('should have backup code help text', async ({ page }) => {
        // Inject fake MFA token
        await page.goto('http://localhost:5373/login');
        await page.evaluate(() => {
            sessionStorage.setItem('mfa_token', 'fake_token_for_testing');
        });
        
        await page.goto('http://localhost:5373/mfa-challenge');
        
        // Should show backup code help
        await expect(page.locator('text=Lost your device?')).toBeVisible();
        await expect(page.locator('text=backup codes')).toBeVisible();
    });
});

test.describe('MFA Setup (Profile)', () => {
    // Tests for MFA setup flow in user profile
    // These would test the MFA setup wizard when implemented

    test.skip('should be able to enable MFA from profile', async ({ page }) => {
        // Login first
        await page.goto('http://localhost:5373/login');
        await page.fill('input[placeholder*="username or email"]', 'test@example.com');
        await page.fill('input[placeholder*="password"]', 'Password123!');
        await page.click('button[type="submit"]');
        
        // Go to profile
        await page.goto('http://localhost:5373/profile');
        
        // Find enable MFA button
        await page.click('button:has-text("Enable Two-Factor")');
        
        // Should show QR code
        await expect(page.locator('text=Scan QR Code')).toBeVisible();
    });

    test.skip('should display backup codes after MFA setup', async ({ page }) => {
        // After MFA setup completes
        await expect(page.locator('text=Backup Codes')).toBeVisible();
        await expect(page.locator('text=Save these codes')).toBeVisible();
    });

    test.skip('should be able to disable MFA', async ({ page }) => {
        // With MFA enabled user
        await page.goto('http://localhost:5373/profile');
        
        await page.click('button:has-text("Disable Two-Factor")');
        
        // Should ask for password confirmation
        await page.fill('input[type="password"]', 'Password123!');
        await page.click('button:has-text("Confirm")');
        
        // Should show success message
        await expect(page.locator('text=disabled')).toBeVisible();
    });
});
