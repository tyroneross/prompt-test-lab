#!/bin/bash

# Quick API test to verify servers are running
echo "================================================================"
echo "Quick API Test - Prompt Testing Lab"
echo "================================================================"
echo ""

# Test API health
echo "1. Testing API Health Endpoint..."
curl -s http://localhost:4001/api/health | python3 -m json.tool
echo ""

# Test magic link
echo "2. Requesting Magic Link..."
RESPONSE=$(curl -s -X POST http://localhost:4001/api/auth/magic-link/send \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}')

echo "$RESPONSE" | python3 -m json.tool

# Extract token if present
TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$TOKEN" ]; then
    echo ""
    echo "3. Token extracted: ${TOKEN:0:20}..."
    echo ""
    echo "4. Verifying Magic Link..."
    curl -s "http://localhost:4001/api/auth/magic-link/verify?token=$TOKEN" | python3 -m json.tool
else
    echo "No token found in response"
fi

echo ""
echo "================================================================"
echo "Test Complete"
echo "================================================================"