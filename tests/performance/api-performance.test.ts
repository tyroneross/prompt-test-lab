/**
 * API Performance Tests
 * 
 * Tests API response times, throughput, and performance under load
 * to ensure the application meets performance requirements.
 */

import { test, expect } from '@playwright/test';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { TEST_CONFIG, initializeTestConfig } from '../config/test-config';

test.describe('API Performance Tests', () => {
  let config: typeof TEST_CONFIG;

  test.beforeAll(() => {
    config = initializeTestConfig();
  });

  const API_BASE_URL = TEST_CONFIG.api.baseUrl;
  const RESPONSE_TIME_THRESHOLD = TEST_CONFIG.performance.responseTimeThreshold;
  const CONCURRENT_REQUESTS = TEST_CONFIG.performance.concurrentRequests;

  test('should respond to health check within threshold', async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.get(`${API_BASE_URL}/api/health`);
    
    const responseTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(100); // Health check should be very fast
  });

  test('should handle authentication requests within threshold', async ({ request }) => {
    const loginData = {
      email: TEST_CONFIG.credentials.user.email,
      password: TEST_CONFIG.credentials.user.password
    };

    const startTime = Date.now();
    
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: loginData
    });
    
    const responseTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(RESPONSE_TIME_THRESHOLD);
    
    console.log(`Authentication response time: ${responseTime}ms`);
  });

  test('should handle project creation within threshold', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.credentials.user.email,
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    const { token } = await authResponse.json();
    
    const projectData = {
      name: 'Performance Test Project',
      description: 'A project created for performance testing'
    };

    const startTime = Date.now();
    
    const response = await request.post(`${API_BASE_URL}/api/projects`, {
      data: projectData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(RESPONSE_TIME_THRESHOLD);
    
    console.log(`Project creation response time: ${responseTime}ms`);
  });

  test('should handle concurrent requests efficiently', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.credentials.user.email,
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    const { token } = await authResponse.json();
    
    // Create multiple concurrent requests
    const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => 
      request.get(`${API_BASE_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    );

    const startTime = Date.now();
    
    const responses = await Promise.all(requests);
    
    const totalTime = Date.now() - startTime;
    const avgResponseTime = totalTime / CONCURRENT_REQUESTS;
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
    
    // Average response time should be reasonable
    expect(avgResponseTime).toBeLessThan(RESPONSE_TIME_THRESHOLD);
    
    console.log(`Concurrent requests (${CONCURRENT_REQUESTS}): total=${totalTime}ms, avg=${avgResponseTime}ms`);
  });

  test('should handle large payload requests', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.credentials.user.email,
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    const { token } = await authResponse.json();
    
    // Create a large prompt content (simulating real-world usage)
    const largePromptContent = 'You are a helpful assistant. '.repeat(1000) + '{{input}}';
    
    const largePromptData = {
      name: 'Large Prompt Test',
      content: largePromptContent,
      variables: {
        input: {
          type: 'string',
          description: 'User input',
          required: true
        }
      }
    };

    const startTime = Date.now();
    
    const response = await request.post(`${API_BASE_URL}/api/prompts`, {
      data: largePromptData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(RESPONSE_TIME_THRESHOLD * 2); // Allow more time for large payloads
    
    console.log(`Large payload response time: ${responseTime}ms`);
  });

  test('should handle database queries efficiently', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.credentials.user.email,
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    const { token } = await authResponse.json();
    
    // Test paginated list endpoint (simulates complex queries)
    const startTime = Date.now();
    
    const response = await request.get(`${API_BASE_URL}/api/projects?page=1&limit=50&search=test`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(RESPONSE_TIME_THRESHOLD);
    
    // Verify response includes pagination metadata
    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('limit');
    
    console.log(`Database query response time: ${responseTime}ms`);
  });

  test('should handle error responses quickly', async ({ request }) => {
    const startTime = Date.now();
    
    // Make request to non-existent endpoint
    const response = await request.get(`${API_BASE_URL}/api/nonexistent`);
    
    const responseTime = Date.now() - startTime;
    
    expect(response.status()).toBe(404);
    expect(responseTime).toBeLessThan(200); // Error responses should be very fast
    
    console.log(`Error response time: ${responseTime}ms`);
  });
});

test.describe('Frontend Performance Tests', () => {
  test('should meet Lighthouse performance benchmarks', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      // Navigate to the main application
      await page.goto('http://localhost:5173');
      
      // Run Lighthouse audit
      const { port } = new URL(browser.wsEndpoint()).port;
      const { lhr } = await lighthouse('http://localhost:5173', {
        port: parseInt(port),
        output: 'json',
        logLevel: 'info',
        chromeFlags: ['--headless']
      });
      
      // Performance thresholds
      const performanceScore = lhr.categories.performance.score * 100;
      const firstContentfulPaint = lhr.audits['first-contentful-paint'].numericValue;
      const largestContentfulPaint = lhr.audits['largest-contentful-paint'].numericValue;
      const totalBlockingTime = lhr.audits['total-blocking-time'].numericValue;
      const cumulativeLayoutShift = lhr.audits['cumulative-layout-shift'].numericValue;
      
      console.log('Lighthouse Performance Metrics:');
      console.log(`Performance Score: ${performanceScore}`);
      console.log(`First Contentful Paint: ${firstContentfulPaint}ms`);
      console.log(`Largest Contentful Paint: ${largestContentfulPaint}ms`);
      console.log(`Total Blocking Time: ${totalBlockingTime}ms`);
      console.log(`Cumulative Layout Shift: ${cumulativeLayoutShift}`);
      
      // Performance assertions
      expect(performanceScore).toBeGreaterThan(80); // Minimum 80 performance score
      expect(firstContentfulPaint).toBeLessThan(2000); // FCP under 2 seconds
      expect(largestContentfulPaint).toBeLessThan(4000); // LCP under 4 seconds
      expect(totalBlockingTime).toBeLessThan(300); // TBT under 300ms
      expect(cumulativeLayoutShift).toBeLessThan(0.1); // CLS under 0.1
      
    } finally {
      await browser.close();
    }
  });

  test('should load dashboard quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    // Wait for main content to load
    await page.waitForSelector('[data-testid="dashboard-content"]');
    
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Dashboard should load in under 3 seconds
    
    console.log(`Dashboard load time: ${loadTime}ms`);
  });

  test('should handle large data sets efficiently', async ({ page }) => {
    // Navigate to analytics page which typically has large datasets
    const startTime = Date.now();
    
    await page.goto('/analytics');
    
    // Wait for charts to render
    await page.waitForSelector('[data-testid="performance-chart"]');
    await page.waitForSelector('[data-testid="cost-chart"]');
    
    const renderTime = Date.now() - startTime;
    
    expect(renderTime).toBeLessThan(5000); // Charts should render within 5 seconds
    
    console.log(`Analytics page render time: ${renderTime}ms`);
  });

  test('should optimize bundle size', async ({ page }) => {
    // Check that JavaScript bundles are appropriately sized
    const response = await page.goto('/');
    
    let totalJSSize = 0;
    let totalCSSSize = 0;
    
    page.on('response', async (response) => {
      if (response.url().includes('.js')) {
        const buffer = await response.body();
        totalJSSize += buffer.length;
      } else if (response.url().includes('.css')) {
        const buffer = await response.body();
        totalCSSSize += buffer.length;
      }
    });
    
    // Allow time for all resources to load
    await page.waitForLoadState('networkidle');
    
    console.log(`Total JS bundle size: ${(totalJSSize / 1024).toFixed(2)} KB`);
    console.log(`Total CSS bundle size: ${(totalCSSSize / 1024).toFixed(2)} KB`);
    
    // Bundle size thresholds
    expect(totalJSSize).toBeLessThan(1024 * 1024); // JS bundles under 1MB
    expect(totalCSSSize).toBeLessThan(200 * 1024); // CSS under 200KB
  });

  test('should handle rapid user interactions', async ({ page }) => {
    await page.goto('/projects');
    
    const startTime = Date.now();
    
    // Simulate rapid clicking and navigation
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="create-project-btn"]');
      await page.press('Escape'); // Close modal
      await page.waitForTimeout(50); // Small delay between actions
    }
    
    const interactionTime = Date.now() - startTime;
    
    // Should handle rapid interactions without blocking
    expect(interactionTime).toBeLessThan(2000);
    
    console.log(`Rapid interaction handling time: ${interactionTime}ms`);
  });
});

test.describe('Memory and Resource Usage', () => {
  test('should not have memory leaks', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    
    // Perform operations that could cause memory leaks
    for (let i = 0; i < 20; i++) {
      await page.goto('/projects');
      await page.goto('/analytics');
      await page.goto('/dashboard');
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
    
    console.log(`Memory usage - Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory increase: ${memoryIncreasePercent.toFixed(2)}%`);
    
    // Memory usage should not increase by more than 50% after navigation
    expect(memoryIncreasePercent).toBeLessThan(50);
  });
});