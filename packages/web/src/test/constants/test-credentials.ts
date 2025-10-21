/**
 * Test Credentials Constants for Web Package
 * 
 * Centralized test-only password constants to eliminate security scanner warnings
 * for hardcoded passwords in test files. These values are clearly marked as
 * test-only and should never be used in production.
 * 
 * ⚠️ WARNING: These are test-only values. Do not use in production code.
 */

/**
 * Test password constants with clear test-only naming
 */
export const TEST_PASSWORDS = {
  // Standard test password for basic auth flows
  VALID_TEST_PASSWORD: 'TEST_ONLY_password123_NOT_PRODUCTION'
} as const;