/**
 * Test Credentials Constants
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
  VALID_TEST_PASSWORD: 'TEST_ONLY_password123_NOT_PRODUCTION',
  
  // Password change test scenarios
  OLD_TEST_PASSWORD: 'TEST_ONLY_old_password_NOT_PRODUCTION', 
  NEW_TEST_PASSWORD: 'TEST_ONLY_new_password_NOT_PRODUCTION',
  
  // Invalid/wrong password scenarios
  WRONG_TEST_PASSWORD: 'TEST_ONLY_wrong_password_NOT_PRODUCTION',
  
  // Simple test password for basic scenarios
  SIMPLE_TEST_PASSWORD: 'TEST_ONLY_simple_NOT_PRODUCTION'
} as const;

/**
 * Test user data with obvious test-only naming
 */
export const TEST_USER_DATA = {
  VALID_USER: {
    email: 'test-user@testing.promptlab.com',
    password: TEST_PASSWORDS.VALID_TEST_PASSWORD,
    firstName: 'TestOnly',
    lastName: 'TestUser'
  },
  
  ADMIN_USER: {
    email: 'test-admin@testing.promptlab.com', 
    password: TEST_PASSWORDS.VALID_TEST_PASSWORD,
    firstName: 'TestOnly',
    lastName: 'TestAdmin'
  }
} as const;

/**
 * Hashed password constants for mocking
 */
export const TEST_HASHED_PASSWORDS = {
  MOCK_HASH: 'TEST_ONLY_mock_hash_NOT_PRODUCTION',
  OLD_HASH: 'TEST_ONLY_old_hash_NOT_PRODUCTION',
  NEW_HASH: 'TEST_ONLY_new_hash_NOT_PRODUCTION'
} as const;

/**
 * Type exports for type safety
 */
export type TestPasswordKey = keyof typeof TEST_PASSWORDS;
export type TestUserDataKey = keyof typeof TEST_USER_DATA;