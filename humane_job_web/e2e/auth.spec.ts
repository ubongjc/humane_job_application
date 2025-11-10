import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display sign-in page', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page).toHaveTitle(/Sign in/i);
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should display sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).toHaveTitle(/Sign up/i);
    await expect(page.getByText('Get started')).toBeVisible();
  });

  test('should redirect to sign-in when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to sign-in
    await page.waitForURL('**/sign-in**');
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('Onboarding Flow', () => {
  test('should display onboarding wizard', async ({ page }) => {
    await page.goto('/onboarding');

    await expect(page.getByText('Welcome to Humane Job Application')).toBeVisible();
    await expect(page.getByText('Company Info')).toBeVisible();
  });

  test('should navigate through onboarding steps', async ({ page }) => {
    await page.goto('/onboarding');

    // Step 1: Company Info
    await page.fill('input[name="companyName"]', 'Test Company');
    await page.fill('input[name="companyDomain"]', 'testcompany.com');
    await page.click('button:has-text("Continue")');

    // Step 2: Role Selection
    await expect(page.getByText("What's your role?")).toBeVisible();
    await page.click('button:has-text("Admin")');
    await page.click('button:has-text("Continue")');

    // Step 3: Subscription
    await expect(page.getByText('Choose your plan')).toBeVisible();
  });
});
