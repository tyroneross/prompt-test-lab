/**
 * Test Configuration Utility
 * 
 * Centralized configuration for test environments to avoid hardcoded credentials
 * and provide secure defaults for testing.
 */

export interface TestCredentials {
  email: string;
  password: string;
}

export interface TestConfig {
  credentials: {
    user: TestCredentials;
    admin: TestCredentials;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  database: {
    url: string;
  };
  performance: {
    responseTimeThreshold: number;
    concurrentRequests: number;
  };
}

/**
 * Validates that required environment variables are set
 */
function validateTestEnvironment(): void {
  const requiredEnvVars = [
    'TEST_USER_EMAIL',
    'TEST_USER_PASSWORD',
    'TEST_DATABASE_URL',
    'JWT_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required test environment variables: ${missingVars.join(', ')}\n` +
      'Please create a .env.test file with the required variables. ' +
      'Use .env.test.example as a template.'
    );
  }

  // Validate password strength for test environment
  const testPassword = process.env.TEST_USER_PASSWORD;
  if (testPassword && testPassword.length < 8) {
    console.warn('⚠️  Test password is weak. Consider using a stronger password for testing.');
  }
}

/**
 * Test configuration object with environment-based values
 */
export const TEST_CONFIG: TestConfig = {
  credentials: {
    user: {
      email: process.env.TEST_USER_EMAIL || 'test@promptlab.com',
      password: process.env.TEST_USER_PASSWORD || 'test_secure_password_2024'
    },
    admin: {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@promptlab.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin_secure_password_2024'
    }
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    timeout: parseInt(process.env.TEST_API_TIMEOUT || '5000')
  },
  database: {
    url: process.env.TEST_DATABASE_URL || 'file:./test.db'
  },
  performance: {
    responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '1000'),
    concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '10')
  }
};

/**
 * Initialize test configuration and validate environment
 * Call this at the beginning of test suites
 */
export function initializeTestConfig(): TestConfig {
  try {
    validateTestEnvironment();
    return TEST_CONFIG;
  } catch (error) {
    console.error('❌ Test configuration initialization failed:', error);
    throw error;
  }
}

/**
 * Get test credentials with validation
 */
export function getTestCredentials(): { user: TestCredentials; admin: TestCredentials } {
  validateTestEnvironment();
  
  return {
    user: {
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!
    },
    admin: {
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!
    }
  };
}