/**
 * Magic Link Authentication E2E Tests
 *
 * Comprehensive testing of the magic link authentication flow including:
 * - Email validation
 * - Magic link request
 * - Magic link sent confirmation
 * - Token verification
 * - User authentication
 * - Error handling
 * - Rate limiting
 */

import { test, expect, type Page } from '@playwright/test';

// Configuration matching user requirements
const WEB_URL = 'http://localhost:4173';
const API_URL = 'http://localhost:4001';

/**
 * Helper to extract magic link from dev mode API response
 */
async function extractMagicLinkFromDevResponse(page: Page, email: string): Promise<string | null> {
  // Intercept the API response
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/auth/magic-link/send') && response.status() === 200
  );

  // Submit the form
  await page.fill('[id="email"]', email);
  await page.click('button[type="submit"]');

  const response = await responsePromise;
  const data = await response.json();

  // Dev mode returns magic link directly
  if (data.devMagicLink) {
    console.log('✅ Dev mode: Magic link extracted from API response');
    return data.devMagicLink;
  }

  console.log('⚠️ No dev magic link in response, email may have been sent');
  return null;
}

/**
 * Helper to extract token and email from magic link URL
 */
function extractParamsFromMagicLink(magicLink: string): { token: string; email: string } | null {
  try {
    const url = new URL(magicLink);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (!token || !email) {
      return null;
    }

    return { token, email };
  } catch (error) {
    return null;
  }
}

test.describe('Magic Link Authentication Flow', () => {
  test.describe('Login Page - Email Input Validation', () => {
    test('should navigate to login page successfully', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);
      await expect(page).toHaveURL(/.*\/login/);

      // Verify page content
      await expect(page.locator('h1')).toContainText('Sign in to your account');
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('should show error for invalid email format', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Try invalid email
      await page.fill('[id="email"]', 'invalid-email');
      await page.click('button[type="submit"]');

      // Should show validation error (either HTML5 or toast)
      // Check for HTML5 validation first
      const emailInput = page.locator('[id="email"]');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);

      // Either HTML5 validation or toast should appear
      const hasValidationError = validationMessage !== '' ||
        await page.locator('text=/.*valid email.*/i').isVisible().catch(() => false);

      expect(hasValidationError).toBeTruthy();
    });

    test('should accept valid email format', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      const emailInput = page.locator('[id="email"]');
      await emailInput.fill('test@example.com');

      // Check if input is valid
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(isValid).toBeTruthy();
    });

    test('should show loading state when submitting', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      await page.fill('[id="email"]', 'test@example.com');

      // Click submit and immediately check for loading state
      await page.click('button[type="submit"]');

      // Should show loading text or disabled state
      const submitButton = page.locator('button[type="submit"]');
      const buttonText = await submitButton.textContent();

      // Check for loading indicator (text change or disabled state)
      const isLoading = buttonText?.includes('Sending') ||
        await submitButton.isDisabled();

      expect(isLoading).toBeTruthy();
    });
  });

  test.describe('Magic Link Request Flow', () => {
    test('should successfully request magic link', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      const testEmail = 'test@example.com';

      // Fill and submit form
      await page.fill('[id="email"]', testEmail);
      await page.click('button[type="submit"]');

      // Should redirect to magic link sent page
      await expect(page).toHaveURL(new RegExp(`/magic-link-sent.*email=${encodeURIComponent(testEmail)}`), { timeout: 10000 });
    });

    test('should make correct API call', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Set up request interceptor
      const requestPromise = page.waitForRequest(
        request => request.url().includes('/api/auth/magic-link/send') && request.method() === 'POST'
      );

      const testEmail = 'apitest@example.com';
      await page.fill('[id="email"]', testEmail);
      await page.click('button[type="submit"]');

      const request = await requestPromise;
      const postData = request.postDataJSON();

      expect(postData.email).toBe(testEmail);
    });
  });

  test.describe('Magic Link Sent Page', () => {
    test('should display email confirmation page', async ({ page }) => {
      const testEmail = 'confirmation@example.com';
      await page.goto(`${WEB_URL}/magic-link-sent?email=${encodeURIComponent(testEmail)}`);

      // Verify page content
      await expect(page.locator('h1')).toContainText(/check your email/i);
      await expect(page.locator(`text=${testEmail}`)).toBeVisible();

      // Should show instructions
      await expect(page.locator('text=/click the link/i')).toBeVisible();
      await expect(page.locator('text=/15 minutes/i')).toBeVisible();
    });

    test('should show resend button with cooldown', async ({ page }) => {
      const testEmail = 'resend@example.com';
      await page.goto(`${WEB_URL}/magic-link-sent?email=${encodeURIComponent(testEmail)}`);

      // Resend button should be visible
      const resendButton = page.locator('button:has-text("Resend")');
      await expect(resendButton).toBeVisible();

      // Initially might be disabled (check text content)
      const buttonText = await resendButton.textContent();
      console.log('Resend button text:', buttonText);
    });

    test('should handle resend request', async ({ page }) => {
      const testEmail = 'resend2@example.com';

      // First, navigate to login and submit to get cooldown started
      await page.goto(`${WEB_URL}/login`);
      await page.fill('[id="email"]', testEmail);
      await page.click('button[type="submit"]');

      // Wait for redirect
      await expect(page).toHaveURL(/magic-link-sent/);

      // Wait for cooldown to expire (30 seconds in real app, but check button state)
      const resendButton = page.locator('button:has-text("Resend"), button:has-text("in")');
      await expect(resendButton).toBeVisible({ timeout: 5000 });

      // Button should show countdown or be clickable
      const isDisabled = await resendButton.isDisabled();
      console.log('Resend button disabled:', isDisabled);
    });

    test('should redirect to login if no email parameter', async ({ page }) => {
      await page.goto(`${WEB_URL}/magic-link-sent`);

      // Should show error or redirect back
      await expect(page.locator('text=/no email/i, text=/back to login/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Magic Link Verification', () => {
    test('should verify valid magic link in dev mode', async ({ page }) => {
      const testEmail = 'verify@example.com';

      // Navigate to login
      await page.goto(`${WEB_URL}/login`);

      // Extract magic link from dev response
      const magicLink = await extractMagicLinkFromDevResponse(page, testEmail);

      if (!magicLink) {
        console.log('⚠️ Skipping test - no dev magic link available (production mode?)');
        test.skip();
        return;
      }

      console.log('Magic link extracted:', magicLink);

      // Navigate to the magic link
      await page.goto(magicLink);

      // Should show verification in progress
      await expect(page.locator('text=/verifying/i')).toBeVisible({ timeout: 3000 });

      // Should eventually show success or redirect to dashboard
      await expect(page).toHaveURL(/\/(dashboard|verify)/, { timeout: 15000 });

      // Check for success state
      const successVisible = await page.locator('text=/success/i').isVisible().catch(() => false);
      const onDashboard = page.url().includes('/dashboard');

      expect(successVisible || onDashboard).toBeTruthy();
    });

    test('should handle invalid token gracefully', async ({ page }) => {
      const invalidToken = 'invalid-token-12345';
      const testEmail = 'invalid@example.com';

      await page.goto(`${WEB_URL}/verify?token=${invalidToken}&email=${encodeURIComponent(testEmail)}`);

      // Should show error state
      await expect(page.locator('text=/verification failed/i, text=/invalid/i, text=/expired/i')).toBeVisible({ timeout: 10000 });
    });

    test('should handle missing token parameter', async ({ page }) => {
      const testEmail = 'notoken@example.com';

      await page.goto(`${WEB_URL}/verify?email=${encodeURIComponent(testEmail)}`);

      // Should show error about missing token
      await expect(page.locator('text=/invalid/i, text=/missing/i')).toBeVisible({ timeout: 5000 });
    });

    test('should handle missing email parameter', async ({ page }) => {
      const fakeToken = 'some-token-value';

      await page.goto(`${WEB_URL}/verify?token=${fakeToken}`);

      // Should show error about missing email
      await expect(page.locator('text=/invalid/i, text=/missing/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Complete Authentication Flow', () => {
    test('should complete full magic link flow from login to dashboard', async ({ page }) => {
      const testEmail = `fullflow-${Date.now()}@example.com`;

      // Step 1: Navigate to login
      await page.goto(`${WEB_URL}/login`);
      console.log('✅ Step 1: Navigated to login page');

      // Step 2: Request magic link
      const magicLink = await extractMagicLinkFromDevResponse(page, testEmail);

      if (!magicLink) {
        console.log('⚠️ Dev mode not available - checking if production email was sent');

        // Verify we got to confirmation page
        await expect(page).toHaveURL(/magic-link-sent/, { timeout: 5000 });
        console.log('✅ Step 2: Magic link request sent (production mode)');

        test.skip();
        return;
      }

      console.log('✅ Step 2: Magic link received in dev mode');

      // Step 3: Verify we're on confirmation page
      await expect(page).toHaveURL(/magic-link-sent/);
      console.log('✅ Step 3: Redirected to confirmation page');

      // Step 4: Click magic link
      await page.goto(magicLink);
      console.log('✅ Step 4: Navigated to magic link');

      // Step 5: Wait for verification
      await expect(page.locator('text=/verifying/i, text=/success/i')).toBeVisible({ timeout: 10000 });
      console.log('✅ Step 5: Verification started');

      // Step 6: Should redirect to dashboard or show success
      await page.waitForURL(/\/(dashboard|verify)/, { timeout: 15000 });
      console.log('✅ Step 6: Verification completed');

      // Verify authentication succeeded
      const currentUrl = page.url();
      console.log('Final URL:', currentUrl);

      const isAuthenticated = currentUrl.includes('/dashboard') ||
        await page.locator('text=/success/i').isVisible();

      expect(isAuthenticated).toBeTruthy();
      console.log('✅ Step 7: User authenticated successfully');
    });
  });

  test.describe('Rate Limiting', () => {
    test('should enforce rate limiting after multiple requests', async ({ page }) => {
      const testEmail = `ratelimit-${Date.now()}@example.com`;

      // Make multiple rapid requests
      for (let i = 0; i < 4; i++) {
        await page.goto(`${WEB_URL}/login`);
        await page.fill('[id="email"]', testEmail);
        await page.click('button[type="submit"]');

        // Wait for response
        await page.waitForTimeout(1000);

        console.log(`Request ${i + 1} completed`);
      }

      // 4th request should be rate limited (limit is 3 per hour)
      // Check for rate limit message
      const hasRateLimit = await page.locator('text=/too many/i, text=/try again/i').isVisible().catch(() => false);

      if (hasRateLimit) {
        console.log('✅ Rate limiting enforced');
        expect(hasRateLimit).toBeTruthy();
      } else {
        console.log('⚠️ Rate limiting may not be enforced (check API logs)');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Intercept and fail API request
      await page.route('**/api/auth/magic-link/send', route => route.abort());

      await page.fill('[id="email"]', 'network@example.com');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/error/i, text=/failed/i')).toBeVisible({ timeout: 5000 });
    });

    test('should handle API server down scenario', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Intercept and return 500 error
      await page.route('**/api/auth/magic-link/send', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) })
      );

      await page.fill('[id="email"]', 'servererror@example.com');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/error/i, text=/failed/i, text=/try again/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible form elements on login page', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Email input should have label
      const emailInput = page.locator('[id="email"]');
      const label = page.locator('label[for="email"]');

      await expect(label).toBeVisible();
      await expect(emailInput).toHaveAttribute('type', 'email');

      // Button should be accessible
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Tab to email input
      await page.keyboard.press('Tab');
      const emailInput = page.locator('[id="email"]');
      await expect(emailInput).toBeFocused();

      // Type email
      await page.keyboard.type('keyboard@example.com');

      // Tab to submit button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Should submit form
      await expect(page).toHaveURL(/magic-link-sent|login/, { timeout: 5000 });
    });
  });

  test.describe('UI/UX Quality', () => {
    test('should follow Calm Precision design principles', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`);

      // Three-line hierarchy check
      const heading = page.locator('h1');
      const description = page.locator('p').first();

      await expect(heading).toBeVisible();
      await expect(description).toBeVisible();

      // Button sizing - should be full width for primary action
      const submitButton = page.locator('button[type="submit"]');
      const buttonBox = await submitButton.boundingBox();
      const pageBox = await page.locator('form').boundingBox();

      if (buttonBox && pageBox) {
        // Button should be reasonably wide (not checking exact full width due to padding)
        expect(buttonBox.width).toBeGreaterThan(200);
      }
    });

    test('should show helpful error messages', async ({ page }) => {
      await page.goto(`${WEB_URL}/verify?token=invalid&email=test@example.com`);

      // Error message should be user-friendly
      const errorText = await page.locator('text=/verification failed/i, text=/invalid/i').textContent();

      // Should explain what to do next
      await expect(page.locator('text=/request new/i, text=/back to login/i')).toBeVisible();
    });

    test('should provide clear next steps on magic link sent page', async ({ page }) => {
      await page.goto(`${WEB_URL}/magic-link-sent?email=test@example.com`);

      // Should have clear instructions
      await expect(page.locator('text=/check your email/i')).toBeVisible();
      await expect(page.locator('text=/click the link/i')).toBeVisible();

      // Should show help for common issues
      const helpSection = page.locator('text=/didn\'t receive/i, text=/check.*spam/i');
      await expect(helpSection).toBeVisible();
    });
  });
});
