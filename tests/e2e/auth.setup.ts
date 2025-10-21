/**
 * Authentication Setup for E2E Tests
 * 
 * Sets up authentication state for use in E2E tests by creating
 * a test user and saving the authentication state.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication for E2E tests...');

  // Navigate to the login page
  await page.goto('/login');

  // Wait for the login form to be visible
  await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

  // Test user credentials (these should match your test database seeding)
  const testEmail = 'test@promptlab.com';
  const testPassword = 'testpass123';

  // Fill in the login form
  await page.fill('[data-testid="email-input"]', testEmail);
  await page.fill('[data-testid="password-input"]', testPassword);

  // Submit the form
  await page.click('[data-testid="login-submit"]');

  // Wait for successful login - should redirect to dashboard
  await expect(page).toHaveURL(/.*\/dashboard/);

  // Verify we're logged in by checking for user-specific content
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

  // Save signed-in state to 'user.json'
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication setup completed and saved to:', authFile);
});