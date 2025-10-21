/**
 * Playwright Global Setup
 * 
 * Sets up test environment, database, and authentication before running E2E tests.
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TEST_CONFIG, initializeTestConfig } from '../config/test-config';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');
  
  // Initialize and validate test configuration
  const testConfig = initializeTestConfig();
  console.log('✅ Test configuration validated');
  
  // Ensure auth directory exists
  const authDir = path.join(__dirname, '../../playwright/.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  
  // Set up test database
  await setupTestDatabase();
  
  // Set up authentication state
  await setupAuthentication();
  
  console.log('✅ Playwright global setup completed');
}

async function setupTestDatabase() {
  console.log('📊 Setting up test database...');
  
  // Initialize test database with clean state
  // This would typically involve:
  // 1. Creating a test database
  // 2. Running migrations
  // 3. Seeding with test data
  
  // Use configuration-based database URL
  process.env.DATABASE_URL = TEST_CONFIG.database.url;
  
  console.log('✅ Test database setup completed');
}

async function setupAuthentication() {
  console.log('🔐 Setting up authentication state...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto('http://localhost:5173/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Use environment-based credentials
    const testEmail = TEST_CONFIG.credentials.user.email;
    const testPassword = TEST_CONFIG.credentials.user.password;
    
    console.log(`🔑 Using test credentials: ${testEmail}`);
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    
    // Submit login
    await page.click('[data-testid="login-submit"]');
    
    // Wait for successful login (redirect to dashboard)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Save authenticated state
    await page.context().storageState({ 
      path: path.join(__dirname, '../../playwright/.auth/user.json') 
    });
    
    console.log('✅ Authentication state saved');
  } catch (error) {
    console.warn('⚠️  Authentication setup failed, tests will run without auth state:', error);
    
    // Create minimal auth state for tests that don't require actual authentication
    const minimalAuthState = {
      cookies: [],
      origins: []
    };
    
    fs.writeFileSync(
      path.join(__dirname, '../../playwright/.auth/user.json'),
      JSON.stringify(minimalAuthState, null, 2)
    );
  } finally {
    await browser.close();
  }
}

export default globalSetup;