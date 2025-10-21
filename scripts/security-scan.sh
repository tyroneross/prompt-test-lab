#!/bin/bash

# Security Scanning Script
# Scans the codebase for security vulnerabilities including hardcoded secrets

set -e

echo "🔍 Running security scans for prompt-testing-lab..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize results
TOTAL_ISSUES=0
SCAN_RESULTS_FILE="$PROJECT_ROOT/security-scan-results.txt"

echo "📂 Project root: $PROJECT_ROOT"
echo "📋 Results will be saved to: $SCAN_RESULTS_FILE"
echo ""

# Clear previous results
> "$SCAN_RESULTS_FILE"

# Function to log results
log_result() {
    echo "$1" | tee -a "$SCAN_RESULTS_FILE"
}

# Function to check for hardcoded secrets
check_hardcoded_secrets() {
    echo -e "${BLUE}🔐 Checking for hardcoded secrets...${NC}"
    local issues=0
    
    # Check for hardcoded passwords
    echo "  → Scanning for hardcoded passwords..."
    if grep -r --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" --exclude="security-scan-results.txt" \
        -E "(password\s*[:=]\s*['\"][^'\"]{3,}['\"]|pwd\s*[:=]\s*['\"][^'\"]{3,}['\"])" "$PROJECT_ROOT" 2>/dev/null; then
        log_result "❌ CRITICAL: Found hardcoded passwords"
        issues=$((issues + 1))
    else
        log_result "✅ No hardcoded passwords found"
    fi
    
    # Check for API keys
    echo "  → Scanning for hardcoded API keys..."
    if grep -r --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" --exclude="security-scan-results.txt" \
        -E "(api[_-]?key\s*[:=]\s*['\"][^'\"]{10,}['\"]|secret[_-]?key\s*[:=]\s*['\"][^'\"]{10,}['\"])" "$PROJECT_ROOT" 2>/dev/null; then
        log_result "❌ CRITICAL: Found hardcoded API keys"
        issues=$((issues + 1))
    else
        log_result "✅ No hardcoded API keys found"
    fi
    
    # Check for database URLs with credentials
    echo "  → Scanning for database URLs with credentials..."
    if grep -r --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" --exclude="security-scan-results.txt" \
        -E "(DATABASE_URL\s*[:=]\s*['\"][^'\"]*://[^:]+:[^@]+@)" "$PROJECT_ROOT" 2>/dev/null; then
        log_result "⚠️  WARNING: Found database URLs with embedded credentials"
        issues=$((issues + 1))
    else
        log_result "✅ No database URLs with embedded credentials found"
    fi
    
    # Check for JWT secrets
    echo "  → Scanning for JWT secrets..."
    if grep -r --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" --exclude="security-scan-results.txt" \
        -E "(jwt[_-]?secret\s*[:=]\s*['\"][^'\"]{8,}['\"])" "$PROJECT_ROOT" 2>/dev/null; then
        log_result "❌ CRITICAL: Found hardcoded JWT secrets"
        issues=$((issues + 1))
    else
        log_result "✅ No hardcoded JWT secrets found"
    fi
    
    return $issues
}

# Function to check test files specifically
check_test_security() {
    echo -e "${BLUE}🧪 Checking test files for security issues...${NC}"
    local issues=0
    
    # Check for hardcoded test credentials
    echo "  → Scanning test files for hardcoded credentials..."
    if find "$PROJECT_ROOT/tests" -name "*.ts" -o -name "*.js" 2>/dev/null | \
        xargs grep -l "password.*=.*['\"].*['\"]" 2>/dev/null | \
        grep -v "test-config.ts"; then
        log_result "❌ CRITICAL: Found hardcoded passwords in test files"
        issues=$((issues + 1))
    else
        log_result "✅ No hardcoded passwords in test files"
    fi
    
    # Check for production URLs in tests
    echo "  → Scanning for production URLs in test files..."
    if find "$PROJECT_ROOT/tests" -name "*.ts" -o -name "*.js" 2>/dev/null | \
        xargs grep -E "(https?://[^/]*\.com|https?://[^/]*\.org)" 2>/dev/null | \
        grep -v "localhost" | grep -v "127.0.0.1" | grep -v "test\.com"; then
        log_result "⚠️  WARNING: Found production URLs in test files"
        issues=$((issues + 1))
    else
        log_result "✅ No production URLs in test files"
    fi
    
    return $issues
}

# Function to check environment files
check_environment_files() {
    echo -e "${BLUE}🌍 Checking environment configuration...${NC}"
    local issues=0
    
    # Check if .env files exist in repository
    echo "  → Checking for committed .env files..."
    if find "$PROJECT_ROOT" -name ".env" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -1; then
        log_result "⚠️  WARNING: Found .env files in repository"
        issues=$((issues + 1))
    else
        log_result "✅ No .env files found in repository"
    fi
    
    # Check if .env.example exists
    echo "  → Checking for .env.example files..."
    if find "$PROJECT_ROOT" -name ".env*.example" 2>/dev/null | head -1 > /dev/null; then
        log_result "✅ Environment example files found"
    else
        log_result "⚠️  WARNING: No .env.example files found"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Function to check for common security patterns
check_security_patterns() {
    echo -e "${BLUE}🔒 Checking for security anti-patterns...${NC}"
    local issues=0
    
    # Check for console.log with sensitive data patterns
    echo "  → Scanning for console.log with sensitive data..."
    if grep -r --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" --exclude="security-scan-results.txt" \
        -E "console\.log.*\b(password|token|secret|key|auth)\b" "$PROJECT_ROOT" 2>/dev/null; then
        log_result "⚠️  WARNING: Found console.log statements with potentially sensitive data"
        issues=$((issues + 1))
    else
        log_result "✅ No console.log with sensitive data patterns found"
    fi
    
    # Check for TODO or FIXME comments related to security
    echo "  → Scanning for security-related TODO/FIXME comments..."
    if grep -r --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" --exclude="security-scan-results.txt" \
        -iE "(TODO|FIXME).*\b(security|auth|password|token|vulnerability)\b" "$PROJECT_ROOT" 2>/dev/null; then
        log_result "ℹ️  INFO: Found security-related TODO/FIXME comments"
    else
        log_result "✅ No security-related TODO/FIXME comments found"
    fi
    
    return $issues
}

# Function to validate test configuration
check_test_configuration() {
    echo -e "${BLUE}⚙️  Validating test configuration...${NC}"
    local issues=0
    
    # Check if test config exists
    if [ -f "$PROJECT_ROOT/tests/config/test-config.ts" ]; then
        log_result "✅ Test configuration file exists"
        
        # Check if test config uses environment variables
        if grep -q "process\.env\." "$PROJECT_ROOT/tests/config/test-config.ts"; then
            log_result "✅ Test configuration uses environment variables"
        else
            log_result "⚠️  WARNING: Test configuration may not use environment variables"
            issues=$((issues + 1))
        fi
    else
        log_result "❌ CRITICAL: Test configuration file missing"
        issues=$((issues + 1))
    fi
    
    # Check if .env.test.example exists
    if [ -f "$PROJECT_ROOT/.env.test.example" ]; then
        log_result "✅ Test environment example file exists"
    else
        log_result "⚠️  WARNING: .env.test.example file missing"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Run all security checks
echo -e "${YELLOW}Starting comprehensive security scan...${NC}"
echo ""

check_hardcoded_secrets
TOTAL_ISSUES=$((TOTAL_ISSUES + $?))

echo ""

check_test_security  
TOTAL_ISSUES=$((TOTAL_ISSUES + $?))

echo ""

check_environment_files
TOTAL_ISSUES=$((TOTAL_ISSUES + $?))

echo ""

check_security_patterns
TOTAL_ISSUES=$((TOTAL_ISSUES + $?))

echo ""

check_test_configuration
TOTAL_ISSUES=$((TOTAL_ISSUES + $?))

echo ""
echo "=" >> "$SCAN_RESULTS_FILE"
echo "SECURITY SCAN SUMMARY" >> "$SCAN_RESULTS_FILE"
echo "=" >> "$SCAN_RESULTS_FILE"
echo "Total issues found: $TOTAL_ISSUES" >> "$SCAN_RESULTS_FILE"
echo "Scan completed at: $(date)" >> "$SCAN_RESULTS_FILE"

# Display summary
echo -e "${YELLOW}📊 Security Scan Summary${NC}"
echo "========================"
log_result "Total issues found: $TOTAL_ISSUES"
log_result "Scan completed at: $(date)"

if [ $TOTAL_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Security scan passed! No critical issues found.${NC}"
    exit 0
elif [ $TOTAL_ISSUES -le 3 ]; then
    echo -e "${YELLOW}⚠️  Security scan completed with minor issues. Review recommended.${NC}"
    exit 0
else
    echo -e "${RED}❌ Security scan failed! Critical issues found that need immediate attention.${NC}"
    exit 1
fi