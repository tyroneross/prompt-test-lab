#!/bin/bash

# Environment Validation Script for Production Deployment
# This script validates that all required environment variables are set
# and meet security requirements for production deployment.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}✗${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
}

# Function to validate environment variable
validate_env_var() {
    local var_name=$1
    local required=$2
    local validation_type=$3
    local validation_value=$4
    
    if [ -z "${!var_name}" ]; then
        if [ "$required" = "true" ]; then
            print_status "ERROR" "Missing required environment variable: $var_name"
            return 1
        else
            print_status "WARNING" "Optional environment variable not set: $var_name"
            return 0
        fi
    fi
    
    # Type-specific validation
    case $validation_type in
        "url")
            if [[ ! "${!var_name}" =~ ^https?:// ]]; then
                print_status "ERROR" "Invalid URL format for $var_name: ${!var_name}"
                return 1
            fi
            ;;
        "email")
            if [[ ! "${!var_name}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
                print_status "ERROR" "Invalid email format for $var_name: ${!var_name}"
                return 1
            fi
            ;;
        "length")
            if [ ${#var_name} -lt $validation_value ]; then
                print_status "ERROR" "$var_name must be at least $validation_value characters long"
                return 1
            fi
            ;;
        "postgresql")
            if [[ ! "${!var_name}" =~ ^postgresql:// ]]; then
                print_status "ERROR" "Invalid PostgreSQL URL format for $var_name"
                return 1
            fi
            ;;
    esac
    
    print_status "SUCCESS" "Environment variable $var_name is valid"
    return 0
}

# Function to check for hardcoded secrets
check_hardcoded_secrets() {
    print_status "INFO" "Checking for hardcoded secrets..."
    
    # Check for common hardcoded patterns
    local files_to_check=(
        "packages/api/src/**/*.ts"
        "packages/web/src/**/*.ts"
        "packages/shared/src/**/*.ts"
    )
    
    local patterns=(
        "password.*=.*['\"][^'\"]*['\"]"
        "secret.*=.*['\"][^'\"]*['\"]"
        "key.*=.*['\"][^'\"]*['\"]"
        "token.*=.*['\"][^'\"]*['\"]"
    )
    
    local found_hardcoded=false
    
    for file_pattern in "${files_to_check[@]}"; do
        for pattern in "${patterns[@]}"; do
            if grep -r "$pattern" $file_pattern 2>/dev/null | grep -v "test\|mock\|example" > /dev/null; then
                print_status "ERROR" "Potential hardcoded secret found in $file_pattern"
                found_hardcoded=true
            fi
        done
    done
    
    if [ "$found_hardcoded" = false ]; then
        print_status "SUCCESS" "No hardcoded secrets found"
    fi
}

# Function to validate SSL/TLS configuration
validate_ssl_config() {
    print_status "INFO" "Validating SSL/TLS configuration..."
    
    # Check if HTTPS is enforced in production
    if [ "$NODE_ENV" = "production" ]; then
        if [ "$NEXTAUTH_URL" != "${NEXTAUTH_URL/https/}" ]; then
            print_status "SUCCESS" "HTTPS URL configured for production"
        else
            print_status "ERROR" "HTTPS required for production NEXTAUTH_URL"
            return 1
        fi
    fi
}

# Function to validate database security
validate_database_security() {
    print_status "INFO" "Validating database security configuration..."
    
    if [ -n "$DATABASE_URL" ]; then
        # Check for SSL requirement in production
        if [ "$NODE_ENV" = "production" ]; then
            if [[ "$DATABASE_URL" =~ sslmode=require ]]; then
                print_status "SUCCESS" "Database SSL mode is properly configured"
            else
                print_status "WARNING" "Database SSL mode not explicitly set for production"
            fi
        fi
        
        # Check for strong password in database URL
        if [[ "$DATABASE_URL" =~ :[^:]*@ ]]; then
            print_status "SUCCESS" "Database URL contains authentication"
        else
            print_status "WARNING" "Database URL may not contain authentication"
        fi
    fi
}

# Main validation function
main() {
    echo "🔒 Environment Validation for Production Deployment"
    echo "=================================================="
    echo
    
    local errors=0
    local warnings=0
    
    # Required environment variables for production
    print_status "INFO" "Validating required environment variables..."
    
    # Core application variables
    validate_env_var "NODE_ENV" "true" "" "" || ((errors++))
    validate_env_var "DATABASE_URL" "true" "postgresql" "" || ((errors++))
    validate_env_var "JWT_SECRET" "true" "length" "32" || ((errors++))
    validate_env_var "NEXTAUTH_SECRET" "true" "length" "32" || ((errors++))
    validate_env_var "NEXTAUTH_URL" "true" "url" "" || ((errors++))
    
    # Authentication variables
    validate_env_var "GITHUB_ID" "false" "" "" || ((warnings++))
    validate_env_var "GITHUB_SECRET" "false" "" "" || ((warnings++))
    
    # LLM Provider variables
    validate_env_var "OPENAI_API_KEY" "false" "" "" || ((warnings++))
    validate_env_var "GROQ_API_KEY" "false" "" "" || ((warnings++))
    validate_env_var "ANTHROPIC_API_KEY" "false" "" "" || ((warnings++))
    
    # Monitoring variables (optional)
    validate_env_var "LOGFLARE_API_KEY" "false" "" "" || ((warnings++))
    validate_env_var "SENTRY_DSN" "false" "url" "" || ((warnings++))
    
    echo
    
    # Security checks
    check_hardcoded_secrets || ((errors++))
    validate_ssl_config || ((errors++))
    validate_database_security || ((warnings++))
    
    echo
    echo "=================================================="
    
    if [ $errors -gt 0 ]; then
        print_status "ERROR" "Environment validation failed with $errors error(s)"
        exit 1
    elif [ $warnings -gt 0 ]; then
        print_status "WARNING" "Environment validation completed with $warnings warning(s)"
        print_status "INFO" "Please review warnings before proceeding to production"
        exit 0
    else
        print_status "SUCCESS" "Environment validation passed successfully"
        exit 0
    fi
}

# Run main function
main "$@"