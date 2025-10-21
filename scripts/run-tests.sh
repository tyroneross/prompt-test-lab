#!/bin/bash

# Comprehensive Test Execution Script for Prompt Testing Lab
# This script runs all test suites in the correct order with proper reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test execution flags
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=true
RUN_PERFORMANCE=false
RUN_SECURITY=false
RUN_ACCESSIBILITY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --unit-only)
      RUN_UNIT=true
      RUN_INTEGRATION=false
      RUN_E2E=false
      shift
      ;;
    --integration-only)
      RUN_UNIT=false
      RUN_INTEGRATION=true
      RUN_E2E=false
      shift
      ;;
    --e2e-only)
      RUN_UNIT=false
      RUN_INTEGRATION=false
      RUN_E2E=true
      shift
      ;;
    --all)
      RUN_UNIT=true
      RUN_INTEGRATION=true
      RUN_E2E=true
      RUN_PERFORMANCE=true
      RUN_SECURITY=true
      RUN_ACCESSIBILITY=true
      shift
      ;;
    --performance)
      RUN_PERFORMANCE=true
      shift
      ;;
    --security)
      RUN_SECURITY=true
      shift
      ;;
    --accessibility)
      RUN_ACCESSIBILITY=true
      shift
      ;;
    *)
      echo "Unknown option $1"
      echo "Usage: $0 [--unit-only|--integration-only|--e2e-only|--all|--performance|--security|--accessibility]"
      exit 1
      ;;
  esac
done

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

# Function to print success messages
print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error messages
print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Function to print warning messages
print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Start time
START_TIME=$(date +%s)

print_header "🧪 PROMPT TESTING LAB - AUTOMATED TEST SUITE"

echo "Test Configuration:"
echo "- Unit Tests: $RUN_UNIT"
echo "- Integration Tests: $RUN_INTEGRATION"
echo "- E2E Tests: $RUN_E2E"
echo "- Performance Tests: $RUN_PERFORMANCE"
echo "- Security Tests: $RUN_SECURITY"
echo "- Accessibility Tests: $RUN_ACCESSIBILITY"

# Test results tracking
UNIT_RESULT=0
INTEGRATION_RESULT=0
E2E_RESULT=0
PERFORMANCE_RESULT=0
SECURITY_RESULT=0
ACCESSIBILITY_RESULT=0

# Install dependencies if needed
print_header "📦 DEPENDENCY CHECK"
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  print_success "Dependencies installed"
else
  print_success "Dependencies already installed"
fi

# 1. Unit Tests
if [ "$RUN_UNIT" = true ]; then
  print_header "🔬 UNIT TESTS"
  
  echo "Running API unit tests..."
  if npm run test --workspace=@prompt-lab/api; then
    print_success "API unit tests passed"
  else
    print_error "API unit tests failed"
    UNIT_RESULT=1
  fi
  
  echo -e "\nRunning Frontend unit tests..."
  if npm run test:coverage --workspace=@prompt-lab/web; then
    print_success "Frontend unit tests passed"
  else
    print_error "Frontend unit tests failed"
    UNIT_RESULT=1
  fi
fi

# 2. Integration Tests
if [ "$RUN_INTEGRATION" = true ]; then
  print_header "🔗 INTEGRATION TESTS"
  
  echo "Setting up test database..."
  export NODE_ENV=test
  export DATABASE_URL="file:./test-integration.db"
  export JWT_SECRET="test-jwt-secret-key-for-testing-only"
  
  # Initialize test database
  npm run db:init --workspace=@prompt-lab/api
  
  echo "Running API integration tests..."
  if npm test -- --testPathPattern=integration --workspace=@prompt-lab/api; then
    print_success "Integration tests passed"
  else
    print_error "Integration tests failed"
    INTEGRATION_RESULT=1
  fi
  
  # Cleanup
  rm -f ./packages/api/test-integration.db
fi

# 3. E2E Tests
if [ "$RUN_E2E" = true ]; then
  print_header "🌐 END-TO-END TESTS"
  
  echo "Installing Playwright browsers..."
  npx playwright install --with-deps
  
  echo "Starting application servers..."
  export NODE_ENV=test
  export DATABASE_URL="file:./test-e2e.db"
  export JWT_SECRET="test-jwt-secret-key-for-testing-only"
  
  # Initialize test database
  npm run db:init --workspace=@prompt-lab/api
  npm run db:seed --workspace=@prompt-lab/api
  
  # Start servers in background
  npm run dev:api &
  API_PID=$!
  
  npm run dev:web &
  WEB_PID=$!
  
  # Wait for servers to start
  sleep 30
  
  echo "Running E2E tests..."
  if npm run test:e2e; then
    print_success "E2E tests passed"
  else
    print_error "E2E tests failed"
    E2E_RESULT=1
  fi
  
  # Cleanup
  kill $API_PID $WEB_PID 2>/dev/null || true
  rm -f ./packages/api/test-e2e.db
fi

# 4. Performance Tests
if [ "$RUN_PERFORMANCE" = true ]; then
  print_header "⚡ PERFORMANCE TESTS"
  
  echo "Starting application servers for performance testing..."
  npm run dev:api &
  API_PID=$!
  
  npm run dev:web &
  WEB_PID=$!
  
  sleep 30
  
  echo "Running performance tests..."
  if npx playwright test tests/performance/; then
    print_success "Performance tests passed"
  else
    print_error "Performance tests failed"
    PERFORMANCE_RESULT=1
  fi
  
  # Cleanup
  kill $API_PID $WEB_PID 2>/dev/null || true
fi

# 5. Security Tests
if [ "$RUN_SECURITY" = true ]; then
  print_header "🔒 SECURITY TESTS"
  
  echo "Running npm security audit..."
  if npm audit --audit-level moderate; then
    print_success "Security audit passed"
  else
    print_warning "Security audit found issues"
  fi
  
  echo "Starting application servers for security testing..."
  npm run dev:api &
  API_PID=$!
  
  npm run dev:web &
  WEB_PID=$!
  
  sleep 30
  
  echo "Running security tests..."
  if npx playwright test tests/security/; then
    print_success "Security tests passed"
  else
    print_error "Security tests failed"
    SECURITY_RESULT=1
  fi
  
  # Cleanup
  kill $API_PID $WEB_PID 2>/dev/null || true
fi

# 6. Accessibility Tests
if [ "$RUN_ACCESSIBILITY" = true ]; then
  print_header "♿ ACCESSIBILITY TESTS"
  
  echo "Starting application servers for accessibility testing..."
  npm run dev:api &
  API_PID=$!
  
  npm run dev:web &
  WEB_PID=$!
  
  sleep 30
  
  echo "Running accessibility tests..."
  if npx playwright test tests/accessibility/; then
    print_success "Accessibility tests passed"
  else
    print_error "Accessibility tests failed"
    ACCESSIBILITY_RESULT=1
  fi
  
  # Cleanup
  kill $API_PID $WEB_PID 2>/dev/null || true
fi

# Calculate total execution time
END_TIME=$(date +%s)
EXECUTION_TIME=$((END_TIME - START_TIME))

# Test Summary
print_header "📊 TEST EXECUTION SUMMARY"

TOTAL_FAILED=0

if [ "$RUN_UNIT" = true ]; then
  if [ $UNIT_RESULT -eq 0 ]; then
    print_success "Unit Tests: PASSED"
  else
    print_error "Unit Tests: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
fi

if [ "$RUN_INTEGRATION" = true ]; then
  if [ $INTEGRATION_RESULT -eq 0 ]; then
    print_success "Integration Tests: PASSED"
  else
    print_error "Integration Tests: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
fi

if [ "$RUN_E2E" = true ]; then
  if [ $E2E_RESULT -eq 0 ]; then
    print_success "E2E Tests: PASSED"
  else
    print_error "E2E Tests: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
fi

if [ "$RUN_PERFORMANCE" = true ]; then
  if [ $PERFORMANCE_RESULT -eq 0 ]; then
    print_success "Performance Tests: PASSED"
  else
    print_error "Performance Tests: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
fi

if [ "$RUN_SECURITY" = true ]; then
  if [ $SECURITY_RESULT -eq 0 ]; then
    print_success "Security Tests: PASSED"
  else
    print_error "Security Tests: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
fi

if [ "$RUN_ACCESSIBILITY" = true ]; then
  if [ $ACCESSIBILITY_RESULT -eq 0 ]; then
    print_success "Accessibility Tests: PASSED"
  else
    print_error "Accessibility Tests: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
fi

echo -e "\nExecution Time: ${EXECUTION_TIME} seconds"

if [ $TOTAL_FAILED -eq 0 ]; then
  print_success "🎉 ALL TESTS PASSED!"
  echo -e "\n${GREEN}Your application is ready for production deployment.${NC}"
  exit 0
else
  print_error "💥 $TOTAL_FAILED TEST SUITE(S) FAILED"
  echo -e "\n${RED}Please review and fix the failing tests before deployment.${NC}"
  exit 1
fi