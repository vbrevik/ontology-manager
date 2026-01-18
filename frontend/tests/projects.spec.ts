import { test, expect } from '@playwright/test';

test.describe('Projects Module E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Assume user is already logged in or login if needed
        await page.goto('http://localhost:5373/login');
        await page.fill('input[placeholder="username or email@example.com"]', 'admin');
        await page.fill('input[placeholder="Enter your password"]', 'admin');
        await page.click('button[type="submit"]:has-text("Sign in")');
        await page.waitForURL('http://localhost:5373/');
        await page.goto('http://localhost:5373/projects');
    });

    test('should create a new project and navigate to details', async ({ page }) => {
        const projectName = `Test Project ${Date.now()}`;

        await page.click('button:has-text("+ New Project")');
        await page.fill('input[placeholder="Enter project name"]', projectName);
        await page.fill('textarea[placeholder="Enter project description"]', 'A test project for E2E');
        await page.click('button[type="submit"]:has-text("Create Project")');

        // Verify it appears in the list
        await expect(page.locator(`h3:has-text("${projectName}")`)).toBeVisible();

        // Click to navigate
        await page.click(`h3:has-text("${projectName}")`);
        await page.waitForURL('**/projects/*');

        // Verify detail page header
        await expect(page.locator('h1')).toContainText(projectName);
        await expect(page.locator('button:has-text("Overview")')).toBeVisible();
    });

    test('should navigate between project tabs', async ({ page }) => {
        await page.click('.project-card >> h3'); // Click the first project
        await page.waitForURL('**/projects/*');

        // Check Timeline
        await page.click('button:has-text("Timeline (Gantt)")');
        await expect(page.locator('.gantt-chart-container')).toBeVisible();

        // Check Sub-projects
        await page.click('button:has-text("Sub-projects")');
        await expect(page.locator('h3:has-text("Sub-projects")')).toBeHidden(); // It's a tab content header
        await expect(page.locator('div:has-text("No sub-projects found")').or(page.locator('.project-card'))).toBeVisible();
    });

    test('should reflect active project in sidebar', async ({ page }) => {
        await page.click('.project-card >> h3');
        await page.locator('h1').innerText();

        // Check sidebar context
        await expect(page.locator('aside')).toContainText('Sub-projects');
        await expect(page.locator('aside')).toContainText('Overview');
    });
});
