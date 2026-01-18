import { test, expect, type Page } from '@playwright/test';

async function createProjectViaUi(page: Page, projectName: string) {
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByLabel('Description').fill('A test project for E2E');
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(page.locator('.project-card', { hasText: projectName })).toBeVisible();
}

test.describe('Projects Module E2E', () => {
    test.beforeEach(async ({ page }) => {
        const unique = Date.now();
        const username = `proj_user_${unique}`;
        const email = `${username}@example.com`;
        const password = 'Password123!';

        await page.request.post('http://localhost:5300/api/auth/register', {
            data: { username, email, password },
        });

        await page.goto('/login');
        await page.getByLabel('Username or Email').fill(email);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: 'System Overview' })).toBeVisible({ timeout: 10000 });

        await page.goto('/projects');
    });

    test('should create a new project and navigate to details', async ({ page }) => {
        const projectName = `Test Project ${Date.now()}`;

        await createProjectViaUi(page, projectName);

        // Verify it appears in the list
        const projectCard = page.locator('.project-card', { hasText: projectName });
        await expect(projectCard).toBeVisible();

        // Click to navigate
        await projectCard.click();
        await page.waitForURL('**/projects/*');

        // Verify detail page header
        await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    });

    test('should navigate between project tabs', async ({ page }) => {
        const projectName = `Test Project ${Date.now()}`;
        await createProjectViaUi(page, projectName);

        await page.locator('.project-card', { hasText: projectName }).click();
        await page.waitForURL('**/projects/*');

        // Check Timeline
        await page.getByRole('tab', { name: 'Timeline (Gantt)' }).click();
        await expect(page.getByText('Task Name')).toBeVisible();

        // Check Sub-projects
        await page.getByRole('tab', { name: 'Sub-projects' }).click();
        await expect(page.getByText('No sub-projects found').or(page.locator('.project-card'))).toBeVisible();
    });

    test('should reflect active project in sidebar', async ({ page }) => {
        const projectName = `Test Project ${Date.now()}`;
        await createProjectViaUi(page, projectName);

        await page.locator('.project-card', { hasText: projectName }).click();
        await expect(page.getByRole('heading', { name: projectName })).toBeVisible();

        // Check sidebar context
        await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'All Projects' })).toBeVisible();
    });
});
