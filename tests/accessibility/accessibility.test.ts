/**
 * Accessibility Tests
 * 
 * Tests application accessibility using axe-core to ensure compliance
 * with WCAG guidelines and accessibility best practices.
 */

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.describe('Authentication Pages', () => {
    test('login page should be accessible', async ({ page }) => {
      await page.goto('/login');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('registration page should be accessible', async ({ page }) => {
      await page.goto('/register');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('forgot password page should be accessible', async ({ page }) => {
      await page.goto('/forgot-password');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Main Application Pages', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('dashboard should be accessible', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .exclude('[data-testid="third-party-widget"]') // Exclude third-party components
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('projects page should be accessible', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('project detail page should be accessible', async ({ page }) => {
      // Navigate to projects and click on first project
      await page.goto('/projects');
      await page.click('[data-testid="project-card"]:first-child');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('prompts page should be accessible', async ({ page }) => {
      await page.goto('/prompts');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('analytics page should be accessible', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('settings page should be accessible', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Interactive Elements Accessibility', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('modals should be accessible', async ({ page }) => {
      await page.goto('/projects');
      
      // Open create project modal
      await page.click('[data-testid="create-project-btn"]');
      await page.waitForSelector('[data-testid="create-project-modal"]');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .include('[data-testid="create-project-modal"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('dropdown menus should be accessible', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Open user menu dropdown
      await page.click('[data-testid="user-menu"]');
      await page.waitForSelector('[data-testid="user-menu-dropdown"]');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .include('[data-testid="user-menu-dropdown"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('form elements should be accessible', async ({ page }) => {
      await page.goto('/projects');
      await page.click('[data-testid="create-project-btn"]');
      await page.waitForSelector('[data-testid="create-project-form"]');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .include('[data-testid="create-project-form"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('data tables should be accessible', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForSelector('[data-testid="results-table"]');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .include('[data-testid="results-table"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('charts and visualizations should be accessible', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForSelector('[data-testid="performance-chart"]');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .include('[data-testid="charts-container"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should support keyboard navigation on main pages', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test Tab navigation
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement);
      
      // Should be able to tab through all interactive elements
      const tabPresses = 10;
      for (let i = 0; i < tabPresses; i++) {
        await page.keyboard.press('Tab');
        focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeDefined();
      }
    });

    test('should support keyboard shortcuts', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test common keyboard shortcuts
      await page.keyboard.press('Control+k'); // Search shortcut
      const searchModal = page.locator('[data-testid="search-modal"]');
      await expect(searchModal).toBeVisible();
      
      await page.keyboard.press('Escape');
      await expect(searchModal).not.toBeVisible();
    });

    test('should handle focus management in modals', async ({ page }) => {
      await page.goto('/projects');
      
      // Open modal
      await page.click('[data-testid="create-project-btn"]');
      await page.waitForSelector('[data-testid="create-project-modal"]');
      
      // Focus should be trapped in modal
      const firstInput = page.locator('[data-testid="project-name-input"]');
      await expect(firstInput).toBeFocused();
      
      // Tab should stay within modal
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => 
        document.activeElement?.closest('[data-testid="create-project-modal"]')
      );
      expect(focusedElement).toBeTruthy();
      
      // Escape should close modal and restore focus
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="create-project-modal"]')).not.toBeVisible();
      
      const createButton = page.locator('[data-testid="create-project-btn"]');
      await expect(createButton).toBeFocused();
    });
  });

  test.describe('Screen Reader Support', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should have proper ARIA labels and descriptions', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Check for proper ARIA labels on interactive elements
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');
        const textContent = await button.textContent();
        
        // Button should have accessible name (aria-label, aria-labelledby, or text content)
        expect(
          ariaLabel || ariaLabelledBy || (textContent && textContent.trim())
        ).toBeTruthy();
      }
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/dashboard');
      
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      const headingLevels = await Promise.all(
        headings.map(h => h.evaluate(el => parseInt(el.tagName.charAt(1))))
      );
      
      // Should start with h1
      expect(headingLevels[0]).toBe(1);
      
      // Should not skip heading levels
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1];
        expect(diff).toBeLessThanOrEqual(1);
      }
    });

    test('should have proper landmarks and regions', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Should have main landmark
      await expect(page.locator('main')).toBeVisible();
      
      // Should have navigation landmark
      await expect(page.locator('nav')).toBeVisible();
      
      // Should have proper role attributes where needed
      const regions = await page.locator('[role="region"], [role="banner"], [role="contentinfo"]').all();
      expect(regions.length).toBeGreaterThan(0);
    });

    test('should announce status changes', async ({ page }) => {
      await page.goto('/projects');
      
      // Create a project to test status announcements
      await page.click('[data-testid="create-project-btn"]');
      await page.fill('[data-testid="project-name"]', 'Test Project');
      await page.click('[data-testid="create-project-submit"]');
      
      // Should have aria-live region for status updates
      const statusRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]');
      await expect(statusRegion).toBeVisible();
      
      const statusText = await statusRegion.textContent();
      expect(statusText).toMatch(/(created|success|complete)/i);
    });
  });

  test.describe('Color and Contrast Accessibility', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/dashboard');
      
      // This test would ideally use a color contrast analyzer
      // For now, we'll check that the page follows accessibility standards
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      // Filter for color contrast violations
      const contrastViolations = accessibilityScanResults.violations.filter(
        violation => violation.id === 'color-contrast'
      );
      
      expect(contrastViolations).toEqual([]);
    });

    test('should not rely solely on color for information', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForSelector('[data-testid="status-indicators"]');
      
      // Status indicators should have text or icons, not just color
      const statusElements = await page.locator('[data-testid*="status"]').all();
      
      for (const element of statusElements) {
        const textContent = await element.textContent();
        const hasIcon = await element.locator('svg, [data-testid*="icon"]').count() > 0;
        
        // Should have text content or icon in addition to color
        expect(textContent?.trim() || hasIcon).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Accessibility', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should maintain accessibility on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/projects');
      
      // Touch targets should be at least 44x44 pixels
      const buttons = await page.locator('button, a').all();
      
      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Accessibility Error Recovery', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('/projects');
      
      // Trigger form validation error
      await page.click('[data-testid="create-project-btn"]');
      await page.click('[data-testid="create-project-submit"]'); // Submit without required fields
      
      // Error should be announced
      const errorElement = page.locator('[role="alert"], [aria-live="assertive"]');
      await expect(errorElement).toBeVisible();
      
      const errorText = await errorElement.textContent();
      expect(errorText).toMatch(/(error|required|invalid)/i);
    });

    test('should provide clear error messages', async ({ page }) => {
      await page.goto('/login');
      
      // Submit form with invalid data
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.fill('[data-testid="password-input"]', '123');
      await page.click('[data-testid="login-submit"]');
      
      // Should show specific, helpful error messages
      const errorMessages = await page.locator('[data-testid*="error"]').allTextContents();
      
      expect(errorMessages.some(msg => msg.includes('email'))).toBeTruthy();
      expect(errorMessages.some(msg => msg.includes('password'))).toBeTruthy();
    });
  });
});