/**
 * Playwright Global Teardown
 * 
 * Cleans up test environment after E2E tests complete.
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...');
  
  // Clean up test database
  await cleanupTestDatabase();
  
  // Clean up auth files
  await cleanupAuthFiles();
  
  // Clean up temporary files
  await cleanupTempFiles();
  
  console.log('✅ Playwright global teardown completed');
}

async function cleanupTestDatabase() {
  console.log('📊 Cleaning up test database...');
  
  try {
    // Remove test database file if it exists
    const testDbPath = path.join(process.cwd(), 'test-e2e.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('✅ Test database cleaned up');
    }
  } catch (error) {
    console.warn('⚠️  Failed to cleanup test database:', error);
  }
}

async function cleanupAuthFiles() {
  console.log('🔐 Cleaning up auth files...');
  
  try {
    const authDir = path.join(__dirname, '../../playwright/.auth');
    if (fs.existsSync(authDir)) {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        fs.unlinkSync(path.join(authDir, file));
      }
      console.log('✅ Auth files cleaned up');
    }
  } catch (error) {
    console.warn('⚠️  Failed to cleanup auth files:', error);
  }
}

async function cleanupTempFiles() {
  console.log('🗂️  Cleaning up temporary files...');
  
  try {
    // Clean up any temporary uploads or generated files
    const tempDirs = [
      path.join(process.cwd(), 'tmp'),
      path.join(process.cwd(), 'uploads/temp')
    ];
    
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }
    
    console.log('✅ Temporary files cleaned up');
  } catch (error) {
    console.warn('⚠️  Failed to cleanup temporary files:', error);
  }
}

export default globalTeardown;