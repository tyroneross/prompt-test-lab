#!/bin/bash

# Magic Link Authentication Test Suite
# Tests the complete magic link flow

API_URL="http://localhost:4001"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Magic Link Authentication Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Send magic link
echo -e "${BLUE}Test 1: Send magic link${NC}"
RESPONSE=$(curl -s -X POST $API_URL/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com"}')

echo "$RESPONSE" | grep -q '"success":true' && echo -e "${GREEN}✓ Magic link sent successfully${NC}" || echo -e "${RED}✗ Failed to send magic link${NC}"

# Extract magic link
MAGIC_LINK=$(echo "$RESPONSE" | grep -o '"devMagicLink":"[^"]*"' | cut -d'"' -f4)
echo -e "Magic link: ${MAGIC_LINK:0:80}..."
echo ""

# Test 2: Verify magic link
echo -e "${BLUE}Test 2: Verify magic link${NC}"
TOKEN=$(echo "$MAGIC_LINK" | sed 's/.*token=//' | cut -d'&' -f1)
EMAIL=$(echo "$MAGIC_LINK" | sed 's/.*email=//')

VERIFY_RESPONSE=$(curl -s "$API_URL/api/auth/magic-link/verify?token=$TOKEN&email=$EMAIL")
echo "$VERIFY_RESPONSE" | grep -q '"success":true' && echo -e "${GREEN}✓ Token verified successfully${NC}" || echo -e "${RED}✗ Token verification failed${NC}"
echo "$VERIFY_RESPONSE" | grep -q '"token":' && echo -e "${GREEN}✓ Auth token received${NC}" || echo -e "${RED}✗ No auth token received${NC}"
echo ""

# Test 3: Invalid email format
echo -e "${BLUE}Test 3: Invalid email format${NC}"
RESPONSE=$(curl -s -X POST $API_URL/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email"}')

echo "$RESPONSE" | grep -q 'VALIDATION_ERROR' && echo -e "${GREEN}✓ Email validation working${NC}" || echo -e "${RED}✗ Email validation not working${NC}"
echo ""

# Test 4: Missing email
echo -e "${BLUE}Test 4: Missing email${NC}"
RESPONSE=$(curl -s -X POST $API_URL/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$RESPONSE" | grep -q 'VALIDATION_ERROR' && echo -e "${GREEN}✓ Missing email validation working${NC}" || echo -e "${RED}✗ Missing email validation not working${NC}"
echo ""

# Test 5: Wrong email for token
echo -e "${BLUE}Test 5: Wrong email for token${NC}"
RESPONSE=$(curl -s "$API_URL/api/auth/magic-link/verify?token=$TOKEN&email=wrong@example.com")

echo "$RESPONSE" | grep -q 'AUTH_ERROR' && echo -e "${GREEN}✓ Email mismatch detection working${NC}" || echo -e "${RED}✗ Email mismatch detection not working${NC}"
echo ""

# Test 6: Invalid token
echo -e "${BLUE}Test 6: Invalid token${NC}"
RESPONSE=$(curl -s "$API_URL/api/auth/magic-link/verify?token=invalid-token-abc123&email=test@example.com")

echo "$RESPONSE" | grep -q 'AUTH_ERROR' && echo -e "${GREEN}✓ Invalid token detection working${NC}" || echo -e "${RED}✗ Invalid token detection not working${NC}"
echo ""

# Test 7: Rate limiting
echo -e "${BLUE}Test 7: Rate limiting (4 requests)${NC}"
EMAIL_RL="ratelimit2@test.com"

for i in {1..4}; do
  RESPONSE=$(curl -s -X POST $API_URL/api/auth/magic-link/send \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL_RL\"}")

  if [ $i -le 3 ]; then
    echo "$RESPONSE" | grep -q '"success":true' && echo -e "${GREEN}✓ Request $i: Accepted${NC}" || echo -e "${RED}✗ Request $i: Failed${NC}"
  else
    echo "$RESPONSE" | grep -q 'Too many requests' && echo -e "${GREEN}✓ Request $i: Rate limited correctly${NC}" || echo -e "${RED}✗ Request $i: Rate limit not working${NC}"
  fi
done
echo ""

# Test 8: POST verify endpoint
echo -e "${BLUE}Test 8: POST verify endpoint${NC}"
RESPONSE=$(curl -s -X POST $API_URL/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{"email":"posttest@example.com"}')

TOKEN=$(echo "$RESPONSE" | grep -o '"devMagicLink":"[^"]*"' | cut -d'"' -f4 | sed 's/.*token=//' | cut -d'&' -f1)

VERIFY_RESPONSE=$(curl -s -X POST $API_URL/api/auth/magic-link/verify \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"email\":\"posttest@example.com\"}")

echo "$VERIFY_RESPONSE" | grep -q '"success":true' && echo -e "${GREEN}✓ POST verify working${NC}" || echo -e "${RED}✗ POST verify not working${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Suite Complete${NC}"
echo -e "${BLUE}========================================${NC}"
