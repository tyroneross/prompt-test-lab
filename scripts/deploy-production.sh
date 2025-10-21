#!/bin/bash

# =============================================================================
# Production Deployment Script
# =============================================================================
# This script handles the complete production deployment workflow

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    command -v pnpm >/dev/null 2>&1 || { log_error "pnpm is required but not installed. Aborting."; exit 1; }
    command -v git >/dev/null 2>&1 || { log_error "git is required but not installed. Aborting."; exit 1; }
    
    # Check if we're on main branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" != "main" ]; then
        log_warning "Not on main branch. Current branch: $current_branch"
        read -p "Do you want to continue? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Deployment cancelled."
            exit 1
        fi
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_error "You have uncommitted changes. Please commit or stash them before deploying."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and test
build_and_test() {
    log_info "Building and testing..."
    
    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Run tests
    log_info "Running tests..."
    pnpm test:ci || {
        log_error "Tests failed. Deployment cancelled."
        exit 1
    }
    
    # Type check
    log_info "Running type check..."
    pnpm type-check || {
        log_error "Type check failed. Deployment cancelled."
        exit 1
    }
    
    # Build projects
    log_info "Building API..."
    pnpm build:api
    
    log_info "Building web..."
    pnpm build:web
    
    log_success "Build and test completed successfully"
}

# Database migration
migrate_database() {
    log_info "Running database migrations..."
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Run migrations
    cd packages/api
    pnpm exec prisma migrate deploy
    cd ../..
    
    log_success "Database migration completed"
}

# Deploy to Railway (API)
deploy_api() {
    log_info "Deploying API to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway >/dev/null 2>&1; then
        log_warning "Railway CLI not installed. Please deploy manually via Railway dashboard."
        return 0
    fi
    
    # Deploy to Railway
    railway up --service api
    
    log_success "API deployed to Railway"
}

# Deploy to Vercel (Frontend)
deploy_web() {
    log_info "Deploying web to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel >/dev/null 2>&1; then
        log_warning "Vercel CLI not installed. Please deploy manually via Vercel dashboard."
        return 0
    fi
    
    cd packages/web
    vercel --prod
    cd ../..
    
    log_success "Web deployed to Vercel"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait a bit for services to come online
    sleep 30
    
    # Check API health
    if [ -n "$API_URL" ]; then
        if curl -f "$API_URL/health" >/dev/null 2>&1; then
            log_success "API health check passed"
        else
            log_error "API health check failed"
            return 1
        fi
    else
        log_warning "API_URL not set, skipping API health check"
    fi
    
    # Check web deployment
    if [ -n "$WEB_URL" ]; then
        if curl -f "$WEB_URL" >/dev/null 2>&1; then
            log_success "Web health check passed"
        else
            log_error "Web health check failed"
            return 1
        fi
    else
        log_warning "WEB_URL not set, skipping web health check"
    fi
}

# Tag release
tag_release() {
    log_info "Tagging release..."
    
    # Get current version
    version=$(node -p "require('./package.json').version")
    
    # Create git tag
    git tag "v$version"
    git push origin "v$version"
    
    log_success "Tagged release v$version"
}

# Main deployment function
main() {
    log_info "Starting production deployment..."
    
    check_prerequisites
    build_and_test
    
    # Ask for confirmation
    echo
    read -p "Ready to deploy to production. Continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled."
        exit 1
    fi
    
    migrate_database
    deploy_api
    deploy_web
    health_check
    tag_release
    
    log_success "🚀 Production deployment completed successfully!"
    log_info "API: ${API_URL:-https://prompt-testing-lab-api.railway.app}"
    log_info "Web: ${WEB_URL:-https://prompt-testing-lab.vercel.app}"
}

# Script arguments
case "${1:-}" in
    --skip-tests)
        log_warning "Skipping tests (not recommended for production)"
        check_prerequisites
        migrate_database
        deploy_api
        deploy_web
        health_check
        tag_release
        ;;
    --api-only)
        log_info "Deploying API only"
        check_prerequisites
        build_and_test
        migrate_database
        deploy_api
        ;;
    --web-only)
        log_info "Deploying web only"
        check_prerequisites
        build_and_test
        deploy_web
        ;;
    --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --skip-tests    Skip tests (not recommended)"
        echo "  --api-only      Deploy API only"
        echo "  --web-only      Deploy web only"
        echo "  --help          Show this help"
        exit 0
        ;;
    *)
        main
        ;;
esac