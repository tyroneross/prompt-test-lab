# Test Infrastructure

## Test Constants

To eliminate security scanner warnings about hardcoded passwords in test files, all password-related test data should use the centralized constants from `tests/constants/test-credentials.ts`.

### Usage

```typescript
import { TEST_PASSWORDS, TEST_HASHED_PASSWORDS } from '../tests/constants/test-credentials';

// Use constants instead of hardcoded strings
const userData = {
  email: 'test@example.com',
  password: TEST_PASSWORDS.VALID_TEST_PASSWORD,  // ✅ Good
  // password: 'password123',                    // ❌ Bad - security scanner warning
};
```

### Available Constants

- `TEST_PASSWORDS.VALID_TEST_PASSWORD` - Standard test password
- `TEST_PASSWORDS.OLD_TEST_PASSWORD` - For password change scenarios  
- `TEST_PASSWORDS.NEW_TEST_PASSWORD` - For password change scenarios
- `TEST_PASSWORDS.WRONG_TEST_PASSWORD` - For invalid password tests
- `TEST_PASSWORDS.SIMPLE_TEST_PASSWORD` - For basic scenarios
- `TEST_HASHED_PASSWORDS.*` - Mock hash values for bcrypt mocking

### Benefits

1. **Eliminates security scanner warnings** - No hardcoded passwords in code
2. **Centralized management** - Single place to update test credentials
3. **Clear test-only marking** - Values are obviously for testing only
4. **Type safety** - TypeScript constants prevent typos

### Pattern

All test passwords follow the pattern: `TEST_ONLY_[purpose]_NOT_PRODUCTION` to make it clear they are test-only values that should never be used in production.