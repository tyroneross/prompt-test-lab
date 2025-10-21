/**
 * User Workflows E2E Tests
 * 
 * Tests complete user workflows from registration through project creation,
 * prompt testing, and results viewing.
 */

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('Complete User Workflows', () => {
  test.describe('New User Registration Flow', () => {
    test('should complete full registration and onboarding', async ({ page }) => {
      // Navigate to registration page
      await page.goto('/register');

      // Fill registration form
      await page.fill('[data-testid="register-email"]', 'newuser@test.com');
      await page.fill('[data-testid="register-password"]', 'securepass123');
      await page.fill('[data-testid="register-confirm-password"]', 'securepass123');
      await page.fill('[data-testid="register-first-name"]', 'New');
      await page.fill('[data-testid="register-last-name"]', 'User');
      
      // Accept terms
      await page.check('[data-testid="accept-terms"]');
      
      // Submit registration
      await page.click('[data-testid="register-submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Should show welcome message for new users
      await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
      
      // Should show onboarding tour
      await expect(page.locator('[data-testid="onboarding-tour"]')).toBeVisible();
    });
  });

  test.describe('Project Management Workflow', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should create, configure, and manage a project', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      
      // Create new project
      await page.click('[data-testid="create-project-btn"]');
      
      // Fill project details
      await page.fill('[data-testid="project-name"]', 'E2E Test Project');
      await page.fill('[data-testid="project-description"]', 'A project created during E2E testing');
      
      // Configure project settings
      await page.click('[data-testid="project-settings-tab"]');
      await page.fill('[data-testid="max-concurrent-tests"]', '3');
      await page.fill('[data-testid="timeout-ms"]', '30000');
      
      // Create project
      await page.click('[data-testid="create-project-submit"]');
      
      // Should redirect to project detail page
      await expect(page).toHaveURL(/.*\/projects\/[a-f0-9-]+/);
      
      // Verify project details are displayed
      await expect(page.locator('[data-testid="project-title"]')).toHaveText('E2E Test Project');
      await expect(page.locator('[data-testid="project-description"]')).toHaveText('A project created during E2E testing');
      
      // Should show empty prompts state
      await expect(page.locator('[data-testid="empty-prompts-state"]')).toBeVisible();
    });

    test('should edit project settings', async ({ page }) => {
      // Assume we have a project from previous test or setup
      await page.goto('/projects');
      
      // Click on first project
      await page.click('[data-testid="project-card"]:first-child');
      
      // Open settings
      await page.click('[data-testid="project-settings-btn"]');
      
      // Edit project name
      await page.fill('[data-testid="edit-project-name"]', 'Updated Project Name');
      
      // Save changes
      await page.click('[data-testid="save-project-btn"]');
      
      // Verify changes are saved
      await expect(page.locator('[data-testid="project-title"]')).toHaveText('Updated Project Name');
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });
  });

  test.describe('Prompt Testing Workflow', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should create and test prompts end-to-end', async ({ page }) => {
      // Navigate to a project (assumes project exists)
      await page.goto('/projects');
      await page.click('[data-testid="project-card"]:first-child');
      
      // Create new prompt
      await page.click('[data-testid="create-prompt-btn"]');
      
      // Fill prompt details
      await page.fill('[data-testid="prompt-name"]', 'Test Prompt');
      await page.fill('[data-testid="prompt-content"]', 'You are a helpful assistant. Answer the following question: {{question}}');
      
      // Add variables
      await page.click('[data-testid="add-variable-btn"]');
      await page.fill('[data-testid="variable-name"]', 'question');
      await page.select('[data-testid="variable-type"]', 'string');
      await page.fill('[data-testid="variable-description"]', 'The question to answer');
      await page.check('[data-testid="variable-required"]');
      
      // Save prompt
      await page.click('[data-testid="save-prompt-btn"]');
      
      // Should redirect to prompt detail page
      await expect(page).toHaveURL(/.*\/prompts\/[a-f0-9-]+/);
      
      // Create test run
      await page.click('[data-testid="create-test-run-btn"]');
      
      // Configure test run
      await page.fill('[data-testid="test-run-name"]', 'E2E Test Run');
      
      // Select LLM providers
      await page.check('[data-testid="provider-openai"]');
      await page.check('[data-testid="provider-anthropic"]');
      
      // Add test cases
      await page.click('[data-testid="add-test-case-btn"]');
      await page.fill('[data-testid="test-case-name"]', 'Basic Question Test');
      await page.fill('[data-testid="test-case-input-question"]', 'What is the capital of France?');
      await page.fill('[data-testid="test-case-expected-output"]', 'Paris');
      
      // Add evaluators
      await page.check('[data-testid="evaluator-similarity"]');
      await page.check('[data-testid="evaluator-accuracy"]');
      
      // Start test run
      await page.click('[data-testid="start-test-run-btn"]');
      
      // Should show test run in progress
      await expect(page.locator('[data-testid="test-run-status"]')).toHaveText('Running');
      await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();
      
      // Wait for test run to complete (with timeout)
      await expect(page.locator('[data-testid="test-run-status"]')).toHaveText('Completed', { timeout: 60000 });
      
      // Should show results
      await expect(page.locator('[data-testid="test-results-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="result-row"]')).toHaveCount(2); // OpenAI + Anthropic
      
      // Verify results contain expected data
      await expect(page.locator('[data-testid="result-provider"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="result-output"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="result-evaluation"]').first()).toBeVisible();
    });

    test('should run A/B/C testing across multiple providers', async ({ page }) => {
      // Navigate to existing prompt
      await page.goto('/prompts');
      await page.click('[data-testid="prompt-card"]:first-child');
      
      // Create comparative test run
      await page.click('[data-testid="create-test-run-btn"]');
      await page.fill('[data-testid="test-run-name"]', 'A/B/C Provider Comparison');
      
      // Select multiple providers with different configurations
      await page.check('[data-testid="provider-openai-gpt35"]');
      await page.check('[data-testid="provider-openai-gpt4"]');
      await page.check('[data-testid="provider-anthropic-claude"]');
      
      // Configure temperature variations
      await page.fill('[data-testid="gpt35-temperature"]', '0.3');
      await page.fill('[data-testid="gpt4-temperature"]', '0.7');
      await page.fill('[data-testid="claude-temperature"]', '0.5');
      
      // Add multiple test cases
      for (let i = 1; i <= 3; i++) {
        await page.click('[data-testid="add-test-case-btn"]');
        await page.fill(`[data-testid="test-case-${i}-name"]`, `Test Case ${i}`);
        await page.fill(`[data-testid="test-case-${i}-input"]`, `Test input ${i}`);
      }
      
      // Start comparison test
      await page.click('[data-testid="start-test-run-btn"]');
      
      // Wait for completion
      await expect(page.locator('[data-testid="test-run-status"]')).toHaveText('Completed', { timeout: 120000 });
      
      // Should show comparison view
      await page.click('[data-testid="comparison-view-btn"]');
      
      // Verify comparison table shows all providers
      await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="provider-column"]')).toHaveCount(3);
      
      // Should show performance metrics
      await expect(page.locator('[data-testid="avg-latency"]')).toBeVisible();
      await expect(page.locator('[data-testid="avg-cost"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
    });
  });

  test.describe('Analytics and Reporting Workflow', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should view analytics and generate reports', async ({ page }) => {
      // Navigate to analytics page
      await page.goto('/analytics');
      
      // Should show overview dashboard
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
      
      // Should show key metrics
      await expect(page.locator('[data-testid="total-tests-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-rate-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="avg-cost-metric"]')).toBeVisible();
      
      // Filter by date range
      await page.click('[data-testid="date-range-picker"]');
      await page.click('[data-testid="last-30-days"]');
      
      // Should update charts
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="cost-chart"]')).toBeVisible();
      
      // View detailed reports
      await page.click('[data-testid="detailed-reports-tab"]');
      
      // Generate report
      await page.click('[data-testid="generate-report-btn"]');
      await page.select('[data-testid="report-type"]', 'performance');
      await page.select('[data-testid="report-format"]', 'pdf');
      await page.click('[data-testid="download-report-btn"]');
      
      // Should show download success
      await expect(page.locator('[data-testid="download-success"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should handle network errors gracefully', async ({ page }) => {
      // Navigate to project page
      await page.goto('/projects');
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to create a project (should fail)
      await page.click('[data-testid="create-project-btn"]');
      await page.fill('[data-testid="project-name"]', 'Network Test Project');
      await page.click('[data-testid="create-project-submit"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('network');
      
      // Should show retry button
      await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
      
      // Restore network and retry
      await page.unroute('**/api/**');
      await page.click('[data-testid="retry-btn"]');
      
      // Should succeed on retry
      await expect(page).toHaveURL(/.*\/projects\/[a-f0-9-]+/);
    });

    test('should handle session expiration', async ({ page }) => {
      // Navigate to protected page
      await page.goto('/projects');
      
      // Clear authentication storage to simulate session expiration
      await page.evaluate(() => {
        localStorage.removeItem('auth_token');
        sessionStorage.clear();
      });
      
      // Try to perform authenticated action
      await page.click('[data-testid="create-project-btn"]');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
      
      // Should show session expired message
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });
  });

  test.describe('Accessibility Testing', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should pass accessibility checks on key pages', async ({ page }) => {
      const pages = [
        '/dashboard',
        '/projects',
        '/analytics',
        '/settings'
      ];

      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
        
        // Run axe accessibility tests
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        
        // Should have no accessibility violations
        expect(accessibilityScanResults.violations).toEqual([]);
        
        console.log(`✅ Accessibility check passed for ${pageUrl}`);
      }
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test keyboard navigation through main elements
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="main-nav"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="create-project-btn"]')).toBeFocused();
      
      // Test keyboard activation
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="create-project-modal"]')).toBeVisible();
      
      // Test Escape key to close modal
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="create-project-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Responsive Design Testing', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/dashboard');
      
      // Should show mobile navigation
      await expect(page.locator('[data-testid="mobile-nav-trigger"]')).toBeVisible();
      
      // Test mobile menu
      await page.click('[data-testid="mobile-nav-trigger"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      
      // Should be able to navigate
      await page.click('[data-testid="mobile-nav-projects"]');
      await expect(page).toHaveURL(/.*\/projects/);
      
      // Test responsive tables
      await expect(page.locator('[data-testid="projects-table"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="projects-cards"]')).toBeVisible();
    });

    test('should adapt to tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.goto('/analytics');
      
      // Should show appropriate layout for tablet
      await expect(page.locator('[data-testid="analytics-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="analytics-main"]')).toBeVisible();
      
      // Charts should be appropriately sized
      const chartElement = page.locator('[data-testid="performance-chart"]');
      const boundingBox = await chartElement.boundingBox();
      expect(boundingBox?.width).toBeLessThan(768);
      expect(boundingBox?.width).toBeGreaterThan(300);
    });
  });
});