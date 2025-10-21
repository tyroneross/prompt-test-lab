/**
 * Security Tests
 * 
 * Tests authentication, authorization, input sanitization, rate limiting,
 * and other security measures to ensure the application is secure.
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

test.describe('Authentication Security', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  test('should reject requests without authentication token', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/projects`);
    
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should reject requests with invalid token', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/projects`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    expect(response.status()).toBe(401);
  });

  test('should reject requests with expired token', async ({ request }) => {
    // This would typically require a pre-generated expired token
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk0NTkyMDB9.invalid';
    
    const response = await request.get(`${API_BASE_URL}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${expiredToken}`
      }
    });
    
    expect(response.status()).toBe(401);
  });

  test('should validate JWT token signature', async ({ request }) => {
    // Token with invalid signature
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjA5NDU5MjAwfQ.invalid-signature';
    
    const response = await request.get(`${API_BASE_URL}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${invalidToken}`
      }
    });
    
    expect(response.status()).toBe(401);
  });

  test('should enforce secure password requirements', async ({ request }) => {
    const weakPasswords = [
      '123',           // Too short
      '12345678',      // No complexity
      'password',      // Common password
      'abcdefgh',      // No numbers/symbols
      '12345678'       // Only numbers
    ];

    for (const password of weakPasswords) {
      const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
        data: {
          email: `test${Date.now()}@test.com`,
          password,
          firstName: 'Test',
          lastName: 'User'
        }
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toMatch(/(password|weak|requirements)/i);
    }
  });

  test('should prevent brute force attacks on login', async ({ request }) => {
    const email = 'test@promptlab.com';
    const wrongPassword = 'wrong-password';
    
    // Attempt multiple failed logins
    const attempts = 6; // Assuming rate limit is 5 attempts
    const responses = [];
    
    for (let i = 0; i < attempts; i++) {
      const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
        data: { email, password: wrongPassword }
      });
      responses.push(response);
    }
    
    // First few attempts should return 401 (Unauthorized)
    expect(responses[0].status()).toBe(401);
    expect(responses[1].status()).toBe(401);
    
    // Later attempts should be rate limited (429)
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.status()).toBe(429);
    
    const body = await lastResponse.json();
    expect(body.error).toMatch(/(rate limit|too many|attempts)/i);
  });
});

test.describe('Authorization Security', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  test('should prevent users from accessing other users\' projects', async ({ request }) => {
    // Login as first user
    const user1Response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'user1@test.com',
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    // Assume we have another user's project ID
    const otherUserProjectId = 'other-users-project-id';
    
    if (user1Response.ok()) {
      const { token } = await user1Response.json();
      
      const response = await request.get(`${API_BASE_URL}/api/projects/${otherUserProjectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(response.status()).toBe(403); // Forbidden
    }
  });

  test('should prevent privilege escalation', async ({ request }) => {
    // Login as regular user
    const userResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'user@test.com',
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    if (userResponse.ok()) {
      const { token } = await userResponse.json();
      
      // Try to access admin-only endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/system',
        '/api/admin/settings'
      ];
      
      for (const endpoint of adminEndpoints) {
        const response = await request.get(`${API_BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        expect(response.status()).toBe(403); // Should be forbidden
      }
    }
  });
});

test.describe('Input Sanitization and Validation', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  test('should sanitize XSS attempts in project creation', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@promptlab.com',
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    if (authResponse.ok()) {
      const { token } = await authResponse.json();
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">'
      ];
      
      for (const payload of xssPayloads) {
        const response = await request.post(`${API_BASE_URL}/api/projects`, {
          data: {
            name: payload,
            description: `Project with XSS payload: ${payload}`
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok()) {
          const project = await response.json();
          
          // Verify XSS payload was sanitized
          expect(project.name).not.toContain('<script>');
          expect(project.name).not.toContain('javascript:');
          expect(project.name).not.toContain('onerror');
          expect(project.name).not.toContain('onload');
        }
      }
    }
  });

  test('should prevent SQL injection in search queries', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@promptlab.com',
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    if (authResponse.ok()) {
      const { token } = await authResponse.json();
      
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO projects (name) VALUES ('hacked'); --",
        "' OR 1=1 --"
      ];
      
      for (const payload of sqlInjectionPayloads) {
        const response = await request.get(`${API_BASE_URL}/api/projects?search=${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Should not cause internal server error or expose database structure
        expect(response.status()).not.toBe(500);
        
        if (response.ok()) {
          const body = await response.json();
          // Should return normal search results, not database errors
          expect(body).toHaveProperty('projects');
        }
      }
    }
  });

  test('should validate file upload types and sizes', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@promptlab.com',
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    if (authResponse.ok()) {
      const { token } = await authResponse.json();
      
      // Test malicious file types
      const maliciousFiles = [
        { name: 'malicious.exe', content: 'fake exe content' },
        { name: 'script.php', content: '<?php echo "hack"; ?>' },
        { name: 'evil.js', content: 'alert("xss")' }
      ];
      
      for (const file of maliciousFiles) {
        const response = await request.post(`${API_BASE_URL}/api/projects/import`, {
          multipart: {
            file: {
              name: file.name,
              mimeType: 'application/octet-stream',
              buffer: Buffer.from(file.content)
            }
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Should reject malicious file types
        expect(response.status()).toBe(400);
        
        const body = await response.json();
        expect(body.error).toMatch(/(file type|not allowed|invalid)/i);
      }
    }
  });
});

test.describe('Rate Limiting', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  test('should enforce rate limits on API endpoints', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@promptlab.com',
        password: TEST_CONFIG.credentials.user.password
      }
    });
    
    if (authResponse.ok()) {
      const { token } = await authResponse.json();
      
      // Make rapid requests to test rate limiting
      const rapidRequests = Array.from({ length: 100 }, () =>
        request.get(`${API_BASE_URL}/api/projects`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      );
      
      const responses = await Promise.all(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      const headers = rateLimitedResponse.headers();
      expect(headers).toHaveProperty('x-ratelimit-limit');
      expect(headers).toHaveProperty('x-ratelimit-remaining');
    }
  });

  test('should have stricter rate limits for sensitive endpoints', async ({ request }) => {
    const sensitiveEndpoints = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password'
    ];
    
    for (const endpoint of sensitiveEndpoints) {
      const rapidRequests = Array.from({ length: 20 }, () =>
        request.post(`${API_BASE_URL}${endpoint}`, {
          data: {
            email: 'test@test.com',
            password: TEST_CONFIG.credentials.user.password
          }
        })
      );
      
      const responses = await Promise.all(rapidRequests);
      
      // Should have stricter limits on sensitive endpoints
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(10); // More than half should be limited
    }
  });
});

test.describe('Frontend Security', () => {
  test('should have proper Content Security Policy', async ({ page }) => {
    const response = await page.goto('/');
    
    const headers = response?.headers();
    
    // Should have CSP header
    expect(headers).toHaveProperty('content-security-policy');
    
    const csp = headers?.['content-security-policy'];
    
    // CSP should include important directives
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
  });

  test('should prevent clickjacking attacks', async ({ page }) => {
    const response = await page.goto('/');
    
    const headers = response?.headers();
    
    // Should have X-Frame-Options or frame-ancestors in CSP
    expect(
      headers?.['x-frame-options'] === 'DENY' || 
      headers?.['x-frame-options'] === 'SAMEORIGIN' ||
      headers?.['content-security-policy']?.includes('frame-ancestors')
    ).toBeTruthy();
  });

  test('should not expose sensitive information in client-side code', async ({ page }) => {
    await page.goto('/');
    
    const content = await page.content();
    
    // Should not contain sensitive information
    expect(content).not.toMatch(/api[_-]?key/i);
    expect(content).not.toMatch(/secret/i);
    expect(content).not.toMatch(/password/i);
    expect(content).not.toMatch(/token.*[a-f0-9]{32,}/i);
  });

  test('should properly handle logout and session cleanup', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@promptlab.com');
    await page.fill('[data-testid="password-input"]', TEST_CONFIG.credentials.user.password);
    await page.click('[data-testid="login-submit"]');
    
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-btn"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    
    // Should clear authentication data
    const localStorage = await page.evaluate(() => {
      return {
        authToken: localStorage.getItem('auth_token'),
        refreshToken: localStorage.getItem('refresh_token')
      };
    });
    
    expect(localStorage.authToken).toBeNull();
    expect(localStorage.refreshToken).toBeNull();
    
    // Should not be able to access protected pages
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should handle session timeout properly', async ({ page }) => {
    // This test would require mocking time or using a test environment
    // with very short session timeouts
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@promptlab.com');
    await page.fill('[data-testid="password-input"]', TEST_CONFIG.credentials.user.password);
    await page.click('[data-testid="login-submit"]');
    
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Simulate expired session by manipulating token
    await page.evaluate(() => {
      // Set an expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk0NTkyMDB9.expired';
      localStorage.setItem('auth_token', expiredToken);
    });
    
    // Try to make an authenticated request
    await page.click('[data-testid="create-project-btn"]');
    
    // Should detect expired session and redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
  });
});