#!/bin/bash

# Authentication Endpoints Test Script
# Tests all 4 newly implemented authentication endpoints

set -e

API_URL="${API_URL:-http://localhost:4001}"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"
NEW_PASSWORD="NewPassword456"

echo "🧪 Testing Authentication Endpoints"
echo "===================================="
echo ""
echo "API URL: $API_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test result
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} - $2"
  else
    echo -e "${RED}✗ FAIL${NC} - $2"
    exit 1
  fi
}

# Test 1: Register a new user (prerequisite)
echo -e "${YELLOW}Test 1: Registering test user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.id')

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
  print_result 0 "User registered successfully"
  echo "  Token: ${TOKEN:0:20}..."
  echo "  User ID: $USER_ID"
else
  print_result 1 "Failed to register user"
fi
echo ""

# Test 2: PATCH /auth/me - Update Profile
echo -e "${YELLOW}Test 2: Testing PATCH /auth/me (Update Profile)...${NC}"
UPDATE_RESPONSE=$(curl -s -X PATCH "$API_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Test User","avatar":"https://example.com/avatar.jpg"}')

UPDATED_NAME=$(echo "$UPDATE_RESPONSE" | jq -r '.data.name')
UPDATED_AVATAR=$(echo "$UPDATE_RESPONSE" | jq -r '.data.avatar')

if [ "$UPDATED_NAME" = "Updated Test User" ] && [ "$UPDATED_AVATAR" = "https://example.com/avatar.jpg" ]; then
  print_result 0 "Profile updated successfully"
  echo "  Name: $UPDATED_NAME"
  echo "  Avatar: $UPDATED_AVATAR"
else
  print_result 1 "Failed to update profile"
  echo "  Response: $UPDATE_RESPONSE"
fi
echo ""

# Test 3: POST /auth/change-password - Change Password
echo -e "${YELLOW}Test 3: Testing POST /auth/change-password...${NC}"
CHANGE_PASS_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"$TEST_PASSWORD\",\"newPassword\":\"$NEW_PASSWORD\"}")

CHANGE_SUCCESS=$(echo "$CHANGE_PASS_RESPONSE" | jq -r '.success')

if [ "$CHANGE_SUCCESS" = "true" ]; then
  print_result 0 "Password changed successfully"
  echo "  Message: $(echo "$CHANGE_PASS_RESPONSE" | jq -r '.message')"
else
  print_result 1 "Failed to change password"
  echo "  Response: $CHANGE_PASS_RESPONSE"
fi
echo ""

# Test 4: Verify new password works
echo -e "${YELLOW}Test 4: Verifying new password works...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$NEW_PASSWORD\"}")

NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$NEW_TOKEN" != "null" ] && [ "$NEW_TOKEN" != "" ]; then
  print_result 0 "Login with new password successful"
  echo "  New Token: ${NEW_TOKEN:0:20}..."
else
  print_result 1 "Failed to login with new password"
  echo "  Response: $LOGIN_RESPONSE"
fi
echo ""

# Test 5: POST /auth/reset-password - Request Reset
echo -e "${YELLOW}Test 5: Testing POST /auth/reset-password (Request Reset)...${NC}"
RESET_REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

RESET_SUCCESS=$(echo "$RESET_REQUEST_RESPONSE" | jq -r '.success')
RESET_MESSAGE=$(echo "$RESET_REQUEST_RESPONSE" | jq -r '.message')

# Check if we got a dev reset link
DEV_RESET_LINK=$(echo "$RESET_REQUEST_RESPONSE" | jq -r '.devResetLink // empty')

if [ "$RESET_SUCCESS" = "true" ]; then
  print_result 0 "Password reset request sent"
  echo "  Message: $RESET_MESSAGE"
  if [ -n "$DEV_RESET_LINK" ]; then
    echo -e "  ${YELLOW}Dev Reset Link:${NC} $DEV_RESET_LINK"

    # Extract token from dev link
    RESET_TOKEN=$(echo "$DEV_RESET_LINK" | grep -oP 'token=\K[^&]+' | head -1)
    if [ -z "$RESET_TOKEN" ]; then
      # URL encoded token might need different extraction
      RESET_TOKEN=$(echo "$DEV_RESET_LINK" | sed 's/.*token=\([^&]*\).*/\1/')
    fi
    echo "  Extracted Token: ${RESET_TOKEN:0:40}..."
  fi
else
  print_result 1 "Failed to request password reset"
  echo "  Response: $RESET_REQUEST_RESPONSE"
fi
echo ""

# Test 6: POST /auth/reset-password/confirm - Complete Reset
if [ -n "$RESET_TOKEN" ]; then
  echo -e "${YELLOW}Test 6: Testing POST /auth/reset-password/confirm (Complete Reset)...${NC}"
  FINAL_PASSWORD="FinalPassword789"

  RESET_CONFIRM_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/reset-password/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$RESET_TOKEN\",\"email\":\"$TEST_EMAIL\",\"newPassword\":\"$FINAL_PASSWORD\"}")

  CONFIRM_SUCCESS=$(echo "$RESET_CONFIRM_RESPONSE" | jq -r '.success')
  CONFIRM_MESSAGE=$(echo "$RESET_CONFIRM_RESPONSE" | jq -r '.message')

  if [ "$CONFIRM_SUCCESS" = "true" ]; then
    print_result 0 "Password reset completed successfully"
    echo "  Message: $CONFIRM_MESSAGE"

    # Test 7: Verify final password works
    echo ""
    echo -e "${YELLOW}Test 7: Verifying final password works...${NC}"
    FINAL_LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$FINAL_PASSWORD\"}")

    FINAL_TOKEN=$(echo "$FINAL_LOGIN_RESPONSE" | jq -r '.data.token')

    if [ "$FINAL_TOKEN" != "null" ] && [ "$FINAL_TOKEN" != "" ]; then
      print_result 0 "Login with final password successful"
      echo "  Final Token: ${FINAL_TOKEN:0:20}..."
    else
      print_result 1 "Failed to login with final password"
      echo "  Response: $FINAL_LOGIN_RESPONSE"
    fi
  else
    print_result 1 "Failed to complete password reset"
    echo "  Response: $RESET_CONFIRM_RESPONSE"
  fi
else
  echo -e "${YELLOW}⚠ Skipping Test 6 & 7: No reset token available (email service might be working)${NC}"
  echo "  This is normal if email service is properly configured."
  echo "  Check your email for the reset link to test manually."
fi

echo ""
echo "===================================="
echo -e "${GREEN}✓ All Available Tests Passed!${NC}"
echo ""
echo "Summary:"
echo "  ✓ Profile Update (PATCH /auth/me)"
echo "  ✓ Password Change (POST /auth/change-password)"
echo "  ✓ Password Reset Request (POST /auth/reset-password)"
if [ -n "$RESET_TOKEN" ]; then
  echo "  ✓ Password Reset Confirmation (POST /auth/reset-password/confirm)"
else
  echo "  ⚠ Password Reset Confirmation (skipped - no dev token)"
fi
echo ""
echo "Test user email: $TEST_EMAIL"
echo "Clean up: You may want to delete this test user from the database"
