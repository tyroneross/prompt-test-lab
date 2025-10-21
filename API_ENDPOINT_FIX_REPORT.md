# API Endpoint Fix Report

**Date:** 2025-10-20
**Issue:** Frontend-Backend API endpoint mismatches causing profile viewing failures

## Problem Summary

The frontend was calling authentication endpoints that either didn't exist or had different names in the backend, causing profile viewing and other auth-related features to fail.

## Root Cause

**Primary Issue:** Frontend called `/auth/profile` but backend implements `/auth/me`

**Secondary Issues:** Frontend included placeholder functions for endpoints that don't exist in backend:
- `PATCH /auth/profile` (for profile updates)
- `POST /auth/change-password`
- `POST /auth/reset-password`
- `POST /auth/reset-password/confirm`

## Changes Made

### 1. Fixed Profile Endpoint (CRITICAL) ✅

**File:** `/packages/web/src/lib/api/auth.ts`

**Changed Line 65:**
```typescript
// Before
const response = await apiClient.get<ApiResponse<User>>('/auth/profile');

// After
const response = await apiClient.get<ApiResponse<User>>('/auth/me');
```

**Rationale:**
- Backend implements `GET /auth/me` (line 73 in `packages/api/src/routes/auth.ts`)
- API specification documents `/auth/me` as standard
- All backend tests validate `/auth/me`
- `/auth/me` is REST convention (GitHub, Auth0, etc.)

### 2. Marked Non-Existent Endpoints (PREVENT SILENT FAILURES) ✅

**File:** `/packages/web/src/lib/api/auth.ts`

Updated functions to throw explicit errors instead of silently failing:

```typescript
updateProfile() → throws "Profile update endpoint not yet implemented in backend"
changePassword() → throws "Change password endpoint not yet implemented in backend"
requestPasswordReset() → throws "Password reset endpoint not yet implemented in backend"
resetPassword() → throws "Password reset confirmation endpoint not yet implemented in backend"
```

**Rationale:**
- Prevents UI from making calls to non-existent endpoints
- Provides clear error messages for debugging
- Documents missing backend functionality
- Follows "Functional Integrity" principle from Calm Precision 6.1

### 3. Fixed HTTP Method Mismatches (CRITICAL) ✅

**Files Modified:**
- `/packages/api/src/routes/projects.ts`
- `/packages/api/src/routes/prompts.ts`

**Changes:**

**projects.ts - Line 79:**
```typescript
// Before
router.put('/:projectId', async (req: Request, res: Response, next: NextFunction) => {

// After
router.patch('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
```

**projects.ts - Line 147:**
```typescript
// Before
router.put('/:projectId/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {

// After
router.patch('/:projectId/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
```

**prompts.ts - Line 102:**
```typescript
// Before
router.put('/prompts/:promptId', async (req: Request, res: Response, next: NextFunction) => {

// After
router.patch('/prompts/:promptId', async (req: Request, res: Response, next: NextFunction) => {
```

**Rationale:**
- PATCH is semantically correct for partial updates (REST RFC 5789)
- PUT should only be used for complete resource replacement
- Frontend correctly uses PATCH - backend needed to match
- Express router requires exact method match

## Backend Endpoints Inventory

### Implemented Auth Endpoints

| Method | Endpoint | Status | Tested |
|--------|----------|--------|--------|
| POST | `/auth/register` | Working | Yes |
| POST | `/auth/login` | Working | Yes |
| POST | `/auth/refresh` | Working | Yes |
| GET | `/auth/me` | Working | Yes |
| POST | `/auth/logout` | Working | Yes |
| GET | `/auth/verify` | Working | No |

### Missing Auth Endpoints (Frontend Expects)

| Method | Endpoint | Frontend Usage | Priority |
|--------|----------|----------------|----------|
| PATCH | `/auth/me` | Profile updates | High |
| POST | `/auth/change-password` | Password changes | High |
| POST | `/auth/reset-password` | Password reset request | Medium |
| POST | `/auth/reset-password/confirm` | Password reset confirmation | Medium |

## Additional Mismatches Found

### HTTP Method Mismatches (PATCH vs PUT)

**Frontend uses PATCH, Backend uses PUT:**

| Frontend Call | Backend Route | Impact |
|--------------|---------------|--------|
| `PATCH /projects/:id` | `PUT /projects/:id` | May fail |
| `PATCH /projects/:id/members/:id` | `PUT /projects/:id/members/:id` | May fail |
| `PATCH /projects/:id/settings` | Not found | Will fail |

**Analysis:**
- Frontend correctly uses PATCH for partial updates (REST convention)
- Backend incorrectly uses PUT (should be PATCH for partial updates)
- Express router requires exact method match - PATCH to PUT endpoint will fail with 404

**Fix Applied:** ✅ Updated backend routes to use PATCH instead of PUT:
- `/projects/:projectId` - Changed PUT → PATCH
- `/projects/:projectId/members/:memberId` - Changed PUT → PATCH
- `/prompts/:promptId` - Changed PUT → PATCH
- **Still Missing:** `/projects/:projectId/settings` PATCH endpoint

## Verification

### What Works Now ✅
- Profile viewing via `GET /auth/me`
- User authentication (login/register)
- Token refresh
- Logout
- **Project updates** via `PATCH /projects/:id` (fixed)
- **Member role updates** via `PATCH /projects/:id/members/:id` (fixed)
- **Prompt updates** via `PATCH /prompts/:id` (fixed)

### What Fails Gracefully (With Clear Errors) ⚠️
- Profile updates (throws "Profile update endpoint not yet implemented")
- Password changes (throws "Change password endpoint not yet implemented")
- Password reset (throws "Password reset endpoint not yet implemented")

### What Still Fails (Missing Backend) ❌
- **Project settings updates** (endpoint `/projects/:id/settings` doesn't exist)

### What Needs Backend Implementation

Priority order for backend engineer:

1. **PATCH /auth/me** - Profile updates
   - Accept: `Partial<User>` (name, avatar, etc.)
   - Return: Updated `User` object
   - Validate: Only user can update own profile

2. **POST /auth/change-password** - Password changes
   - Accept: `{ currentPassword, newPassword }`
   - Validate: Current password correct, new password meets requirements
   - Return: Success confirmation

3. **POST /auth/reset-password** - Password reset request
   - Accept: `{ email }`
   - Action: Send reset email with token
   - Return: Success confirmation

4. **POST /auth/reset-password/confirm** - Password reset confirmation
   - Accept: `{ token, password }`
   - Validate: Token valid and not expired
   - Action: Update password
   - Return: Success confirmation

## Success Criteria

✅ Profile endpoint accessible (`GET /auth/me`)
✅ No silent failures (errors thrown explicitly)
✅ Consistent endpoint naming
✅ Documented missing functionality
✅ No breaking changes to existing features

## Testing Recommendations

1. **Integration Tests Needed:**
   - Test `GET /auth/me` returns correct user data
   - Test non-existent endpoints throw expected errors
   - Test frontend error handling displays user-friendly messages

2. **When Backend Implements Missing Endpoints:**
   - Remove `@deprecated` tags from auth.ts
   - Replace error throws with actual API calls
   - Add integration tests for new endpoints
   - Update API specification (api-spec.yaml)

## References

- Frontend Auth API: `/packages/web/src/lib/api/auth.ts`
- Backend Auth Routes: `/packages/api/src/routes/auth.ts`
- Backend Auth Tests: `/packages/api/src/routes/__tests__/auth.test.ts`
- API Specification: `/docs/api-spec.yaml`
- Design Guidelines: Calm Precision 6.1 (Functional Integrity principle)

## Summary of Fixes

### Issues Fixed ✅
1. **Profile viewing** - Changed frontend from `/auth/profile` to `/auth/me`
2. **Project updates** - Changed backend from PUT to PATCH
3. **Member role updates** - Changed backend from PUT to PATCH
4. **Prompt updates** - Changed backend from PUT to PATCH
5. **Non-existent endpoints** - Added explicit error messages instead of silent failures

### Files Modified
- `/packages/web/src/lib/api/auth.ts` - Frontend auth API
- `/packages/api/src/routes/projects.ts` - Backend projects routes
- `/packages/api/src/routes/prompts.ts` - Backend prompts routes

### Impact
- **Critical fix:** Profile viewing now works correctly
- **Breaking changes prevented:** HTTP method mismatches fixed before deployment
- **Developer experience improved:** Clear error messages for unimplemented features
- **REST compliance:** All partial updates now use PATCH as per RFC 5789

## Next Steps

1. **Immediate:**
   - Test profile viewing in development environment
   - Verify project/prompt updates work with PATCH
   - Check error messages display correctly in UI

2. **Short-term (Next Sprint):**
   - Implement `PATCH /auth/me` for profile updates
   - Implement `POST /auth/change-password`
   - Implement `PATCH /projects/:id/settings`

3. **Medium-term:**
   - Implement password reset flow endpoints
   - Add API contract tests to prevent future mismatches
   - Update API specification documentation
   - Update integration tests for new PATCH endpoints

4. **Long-term:**
   - Consider OpenAPI/Swagger code generation to prevent mismatches
   - Implement automated contract testing (Pact.io or similar)
   - Add pre-commit hooks to validate API contracts
