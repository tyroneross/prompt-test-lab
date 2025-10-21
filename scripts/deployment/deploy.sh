#!/bin/bash
set -e

# Comprehensive deployment script for Prompt Testing Lab
# Supports multiple environments and deployment strategies

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$ROOT_DIR/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
STRATEGY="rolling"
DRY_RUN=false
SKIP_TESTS=false
SKIP_BACKUP=false
FORCE=false
ROLLBACK_ON_FAILURE=true

# Logging function
log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
  echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

# Help function
show_help() {
  cat << EOF
Prompt Testing Lab Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
  -e, --environment ENV     Target environment (staging|production) [default: staging]
  -s, --strategy STRATEGY   Deployment strategy (rolling|blue-green|canary) [default: rolling]
  -d, --dry-run            Show what would be deployed without executing
  -t, --skip-tests         Skip running tests before deployment
  -b, --skip-backup        Skip creating backup before deployment
  -f, --force              Force deployment even if checks fail
  -r, --no-rollback        Don't rollback on deployment failure
  -h, --help               Show this help message

EXAMPLES:
  $0                                    # Deploy to staging with default settings
  $0 -e production -s blue-green       # Deploy to production using blue-green strategy
  $0 -e staging -d                     # Dry run deployment to staging
  $0 -e production -t -b               # Deploy to production, skip tests and backup

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -s|--strategy)
      STRATEGY="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -t|--skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -b|--skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    -r|--no-rollback)
      ROLLBACK_ON_FAILURE=false
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Validate inputs
case $ENVIRONMENT in
  staging|production) ;;
  *)
    log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
    exit 1
    ;;
esac

case $STRATEGY in
  rolling|blue-green|canary) ;;
  *)
    log_error "Invalid strategy: $STRATEGY. Must be 'rolling', 'blue-green', or 'canary'"
    exit 1
    ;;
esac

# Initialize deployment
log_info "Starting deployment to $ENVIRONMENT using $STRATEGY strategy"
log_info "Dry run: $DRY_RUN"
log_info "Skip tests: $SKIP_TESTS"
log_info "Skip backup: $SKIP_BACKUP"

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  # Check required tools
  local missing_tools=()
  for tool in git node npm vercel docker terraform; do
    if ! command -v "$tool" &> /dev/null; then
      missing_tools+=("$tool")
    fi
  done
  
  if [[ ${#missing_tools[@]} -gt 0 ]]; then
    log_error "Missing required tools: ${missing_tools[*]}"
    return 1
  fi
  
  # Check git status
  if [[ -n "$(git status --porcelain)" ]]; then
    log_warning "Working directory is not clean. Uncommitted changes detected."
    if [[ "$FORCE" != true ]]; then
      log_error "Use --force to deploy with uncommitted changes"
      return 1
    fi
  fi
  
  # Check current branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$ENVIRONMENT" == "production" && "$current_branch" != "main" ]]; then
    log_warning "Deploying to production from branch: $current_branch"
    if [[ "$FORCE" != true ]]; then
      log_error "Production deployments should be from 'main' branch. Use --force to override."
      return 1
    fi
  fi
  
  log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
  if [[ "$SKIP_TESTS" == true ]]; then
    log_warning "Skipping tests as requested"
    return 0
  fi
  
  log_info "Running tests..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would run: npm test"
    return 0
  fi
  
  # Run different test suites
  if ! npm test; then
    log_error "Unit tests failed"
    return 1
  fi
  
  if ! npm run test:e2e; then
    log_error "E2E tests failed"
    return 1
  fi
  
  if [[ "$ENVIRONMENT" == "production" ]]; then
    if ! npm run test:security; then
      log_error "Security tests failed"
      return 1
    fi
  fi
  
  log_success "All tests passed"
}

# Create backup
create_backup() {
  if [[ "$SKIP_BACKUP" == true ]]; then
    log_warning "Skipping backup as requested"
    return 0
  fi
  
  log_info "Creating backup..."
  
  local backup_timestamp=$(date '+%Y%m%d_%H%M%S')
  local backup_tag="backup-${ENVIRONMENT}-${backup_timestamp}"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would create backup tag: $backup_tag"
    return 0
  fi
  
  # Create git tag for current state
  git tag "$backup_tag"
  git push origin "$backup_tag"
  
  # Create database backup if needed
  if [[ "$ENVIRONMENT" == "production" ]]; then
    log_info "Creating database backup..."
    # This would call your database backup script
    # "$SCRIPT_DIR/../database/backup.sh" --environment="$ENVIRONMENT"
  fi
  
  echo "$backup_tag" > "$ROOT_DIR/.last_backup"
  log_success "Backup created: $backup_tag"
}

# Build application
build_application() {
  log_info "Building application..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would run: npm run build"
    return 0
  fi
  
  # Clean previous builds
  npm run clean
  
  # Install dependencies
  npm ci
  
  # Build all packages
  if ! npm run build; then
    log_error "Build failed"
    return 1
  fi
  
  log_success "Build completed successfully"
}

# Deploy using rolling strategy
deploy_rolling() {
  log_info "Deploying using rolling strategy..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would deploy to Vercel"
    return 0
  fi
  
  # Deploy to Vercel
  if [[ "$ENVIRONMENT" == "production" ]]; then
    vercel --prod --yes
  else
    vercel --yes
  fi
  
  log_success "Rolling deployment completed"
}

# Deploy using blue-green strategy
deploy_blue_green() {
  log_info "Deploying using blue-green strategy..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would deploy blue-green to Vercel"
    return 0
  fi
  
  # For Vercel, this would involve deploying to a preview environment
  # then promoting it to production after health checks
  local preview_url=$(vercel --yes | grep -o 'https://[^[:space:]]*')
  
  # Health check the preview deployment
  if ! "$SCRIPT_DIR/health-check.sh" --url="$preview_url"; then
    log_error "Health check failed for preview deployment"
    return 1
  fi
  
  # Promote to production if health checks pass
  if [[ "$ENVIRONMENT" == "production" ]]; then
    vercel --prod --yes
  fi
  
  log_success "Blue-green deployment completed"
}

# Deploy using canary strategy
deploy_canary() {
  log_info "Deploying using canary strategy..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would deploy canary release"
    return 0
  fi
  
  # For a canary deployment, we'd deploy to a percentage of traffic
  # This is more complex and would require load balancer configuration
  log_warning "Canary deployment not fully implemented - falling back to rolling"
  deploy_rolling
}

# Run health checks
run_health_checks() {
  log_info "Running health checks..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would run health checks"
    return 0
  fi
  
  # Get the deployment URL
  local deployment_url
  if [[ "$ENVIRONMENT" == "production" ]]; then
    deployment_url="https://prompt-testing-lab.vercel.app"
  else
    deployment_url="https://prompt-testing-lab-staging.vercel.app"
  fi
  
  # Run health checks
  if ! "$SCRIPT_DIR/health-check.sh" --url="$deployment_url" --timeout=60; then
    log_error "Health checks failed"
    return 1
  fi
  
  log_success "Health checks passed"
}

# Rollback deployment
rollback_deployment() {
  if [[ "$ROLLBACK_ON_FAILURE" != true ]]; then
    log_warning "Rollback disabled, manual intervention required"
    return 0
  fi
  
  log_warning "Rolling back deployment..."
  
  local backup_tag
  if [[ -f "$ROOT_DIR/.last_backup" ]]; then
    backup_tag=$(cat "$ROOT_DIR/.last_backup")
    log_info "Rolling back to: $backup_tag"
    
    # Checkout the backup tag and redeploy
    git checkout "$backup_tag"
    
    # Quick redeploy
    if [[ "$ENVIRONMENT" == "production" ]]; then
      vercel --prod --yes
    else
      vercel --yes
    fi
    
    log_warning "Rollback completed to $backup_tag"
  else
    log_error "No backup tag found, manual rollback required"
    return 1
  fi
}

# Create rollback script
create_rollback_script() {
  local rollback_script="$ROOT_DIR/scripts/rollback/rollback-$(date '+%Y%m%d_%H%M%S').sh"
  
  cat > "$rollback_script" << EOF
#!/bin/bash
# Rollback script for deployment on $(date)
# Environment: $ENVIRONMENT
# Strategy: $STRATEGY

set -e

BACKUP_TAG=\$(cat "$ROOT_DIR/.last_backup" 2>/dev/null || echo "")

if [[ -z "\$BACKUP_TAG" ]]; then
  echo "Error: No backup tag found"
  exit 1
fi

echo "Rolling back to: \$BACKUP_TAG"

# Checkout backup
git checkout "\$BACKUP_TAG"

# Redeploy
if [[ "$ENVIRONMENT" == "production" ]]; then
  vercel --prod --yes
else
  vercel --yes
fi

echo "Rollback completed"
EOF
  
  chmod +x "$rollback_script"
  log_info "Rollback script created: $rollback_script"
}

# Main deployment function
main() {
  local start_time=$(date +%s)
  
  # Trap errors and rollback if needed
  if [[ "$ROLLBACK_ON_FAILURE" == true ]]; then
    trap 'log_error "Deployment failed, initiating rollback..."; rollback_deployment; exit 1' ERR
  fi
  
  # Run deployment steps
  check_prerequisites
  run_tests
  create_backup
  build_application
  
  # Deploy based on strategy
  case $STRATEGY in
    rolling)
      deploy_rolling
      ;;
    blue-green)
      deploy_blue_green
      ;;
    canary)
      deploy_canary
      ;;
  esac
  
  run_health_checks
  create_rollback_script
  
  # Calculate deployment time
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  log_success "Deployment completed successfully in ${duration}s"
  log_info "Environment: $ENVIRONMENT"
  log_info "Strategy: $STRATEGY"
  log_info "Deployed at: $(date)"
}

# Run main function
main "$@"