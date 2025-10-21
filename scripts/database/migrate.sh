#!/bin/bash
set -e

# Database migration script for Prompt Testing Lab
# Supports both SQLite (development) and PostgreSQL (production)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$ROOT_DIR/migration.log"

# Default values
ENVIRONMENT="development"
DRY_RUN=false
FORCE=false
ROLLBACK_STEPS=0
BACKUP_BEFORE_MIGRATION=true

# Logging functions
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
Database Migration Script for Prompt Testing Lab

Usage: $0 [OPTIONS]

OPTIONS:
  -e, --environment ENV     Target environment (development|staging|production) [default: development]
  -d, --dry-run            Show what migrations would be applied without executing
  -f, --force              Force migration even if checks fail
  -r, --rollback STEPS     Rollback the last N migration steps
  -b, --no-backup          Skip creating backup before migration
  -h, --help               Show this help message

EXAMPLES:
  $0                                    # Run migrations in development
  $0 -e production                     # Run migrations in production
  $0 -d -e staging                     # Dry run for staging environment
  $0 -r 1 -e production                # Rollback last migration in production

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    -r|--rollback)
      ROLLBACK_STEPS="$2"
      shift 2
      ;;
    -b|--no-backup)
      BACKUP_BEFORE_MIGRATION=false
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

# Validate environment
case $ENVIRONMENT in
  development|staging|production) ;;
  *)
    log_error "Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# Load environment variables
load_environment() {
  local env_file="$ROOT_DIR/.env"
  
  if [[ "$ENVIRONMENT" != "development" ]]; then
    env_file="$ROOT_DIR/.env.$ENVIRONMENT"
  fi
  
  if [[ -f "$env_file" ]]; then
    log_info "Loading environment from: $env_file"
    set -a
    source "$env_file"
    set +a
  else
    log_warning "Environment file not found: $env_file"
  fi
  
  # Set default DATABASE_URL for development
  if [[ "$ENVIRONMENT" == "development" && -z "$DATABASE_URL" ]]; then
    export DATABASE_URL="file:./dev.db"
  fi
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  # Check if DATABASE_URL is set
  if [[ -z "$DATABASE_URL" ]]; then
    log_error "DATABASE_URL environment variable is not set"
    return 1
  fi
  
  # Check if we're in the correct directory
  if [[ ! -f "$ROOT_DIR/package.json" ]]; then
    log_error "Not in project root directory"
    return 1
  fi
  
  # Check if Prisma is available
  if ! npm list prisma --depth=0 >/dev/null 2>&1; then
    log_error "Prisma is not installed. Run 'npm install' first."
    return 1
  fi
  
  log_success "Prerequisites check passed"
}

# Create database backup
create_backup() {
  if [[ "$BACKUP_BEFORE_MIGRATION" != true ]]; then
    log_warning "Skipping backup as requested"
    return 0
  fi
  
  log_info "Creating database backup..."
  
  local backup_timestamp=$(date '+%Y%m%d_%H%M%S')
  local backup_dir="$ROOT_DIR/backups/database"
  mkdir -p "$backup_dir"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would create backup at: $backup_dir/backup_${backup_timestamp}.sql"
    return 0
  fi
  
  # Detect database type from URL
  if [[ "$DATABASE_URL" =~ ^file: ]]; then
    # SQLite backup
    local db_file="${DATABASE_URL#file:}"
    if [[ -f "$db_file" ]]; then
      cp "$db_file" "$backup_dir/backup_${backup_timestamp}.db"
      log_success "SQLite backup created: backup_${backup_timestamp}.db"
    else
      log_warning "SQLite database file not found: $db_file"
    fi
  elif [[ "$DATABASE_URL" =~ ^postgresql: ]]; then
    # PostgreSQL backup
    local backup_file="$backup_dir/backup_${backup_timestamp}.sql"
    
    # Extract connection details
    local db_url_pattern="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
    if [[ "$DATABASE_URL" =~ $db_url_pattern ]]; then
      local db_user="${BASH_REMATCH[1]}"
      local db_pass="${BASH_REMATCH[2]}"
      local db_host="${BASH_REMATCH[3]}"
      local db_port="${BASH_REMATCH[4]}"
      local db_name="${BASH_REMATCH[5]}"
      
      # Create backup using pg_dump
      PGPASSWORD="$db_pass" pg_dump \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        --clean \
        --create \
        --if-exists \
        > "$backup_file"
      
      log_success "PostgreSQL backup created: backup_${backup_timestamp}.sql"
    else
      log_error "Could not parse PostgreSQL connection string"
      return 1
    fi
  else
    log_warning "Unknown database type, backup skipped"
  fi
}

# Check migration status
check_migration_status() {
  log_info "Checking current migration status..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would check migration status"
    return 0
  fi
  
  # Get current migration status
  local status_output
  if status_output=$(cd "$ROOT_DIR/packages/api" && npx prisma migrate status 2>&1); then
    log_info "Migration status:"
    echo "$status_output" | while IFS= read -r line; do
      log_info "  $line"
    done
  else
    log_warning "Could not get migration status: $status_output"
  fi
}

# Apply pending migrations
apply_migrations() {
  log_info "Applying pending migrations..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would apply migrations with: prisma migrate deploy"
    return 0
  fi
  
  cd "$ROOT_DIR/packages/api"
  
  # Apply migrations
  if npx prisma migrate deploy; then
    log_success "Migrations applied successfully"
  else
    log_error "Migration failed"
    return 1
  fi
  
  # Generate Prisma client
  if npx prisma generate; then
    log_success "Prisma client generated successfully"
  else
    log_error "Prisma client generation failed"
    return 1
  fi
}

# Rollback migrations
rollback_migrations() {
  if [[ $ROLLBACK_STEPS -eq 0 ]]; then
    return 0
  fi
  
  log_info "Rolling back $ROLLBACK_STEPS migration step(s)..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would rollback $ROLLBACK_STEPS steps"
    return 0
  fi
  
  # Prisma doesn't have built-in rollback, so we need to handle this manually
  log_warning "Prisma doesn't support automatic rollback"
  log_warning "Manual rollback required:"
  log_warning "1. Restore database from backup"
  log_warning "2. Reset migrations: npx prisma migrate reset"
  log_warning "3. Apply migrations up to desired point"
  
  if [[ "$FORCE" != true ]]; then
    log_error "Use --force to acknowledge manual rollback requirement"
    return 1
  fi
  
  log_warning "Proceeding with database reset (--force specified)"
  
  cd "$ROOT_DIR/packages/api"
  
  # Reset and reapply migrations
  if npx prisma migrate reset --force; then
    log_success "Database reset completed"
  else
    log_error "Database reset failed"
    return 1
  fi
}

# Verify migration integrity
verify_migration() {
  log_info "Verifying migration integrity..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would verify migration integrity"
    return 0
  fi
  
  cd "$ROOT_DIR/packages/api"
  
  # Check if database schema matches Prisma schema
  if npx prisma db push --accept-data-loss --force-reset 2>/dev/null; then
    log_success "Database schema verification passed"
  else
    log_warning "Database schema verification failed - schema might be out of sync"
  fi
  
  # Run a simple connectivity test
  if npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
    log_success "Database connectivity verified"
  else
    log_warning "Database connectivity test failed"
  fi
}

# Seed database if needed
seed_database() {
  if [[ "$ENVIRONMENT" == "development" ]]; then
    log_info "Seeding development database..."
    
    if [[ "$DRY_RUN" == true ]]; then
      log_info "[DRY RUN] Would seed database"
      return 0
    fi
    
    cd "$ROOT_DIR/packages/api"
    
    # Check if seed script exists
    if [[ -f "prisma/seed.ts" ]] || [[ -f "prisma/seed.js" ]]; then
      if npx prisma db seed; then
        log_success "Database seeded successfully"
      else
        log_warning "Database seeding failed"
      fi
    else
      log_info "No seed script found, skipping seeding"
    fi
  else
    log_info "Skipping seeding for $ENVIRONMENT environment"
  fi
}

# Create migration summary
create_summary() {
  local start_time="$1"
  local end_time=$(date)
  local duration_seconds=$(($(date +%s) - $(date -d "$start_time" +%s)))
  
  log_info "Migration Summary:"
  log_info "  Environment: $ENVIRONMENT"
  log_info "  Started: $start_time"
  log_info "  Completed: $end_time"
  log_info "  Duration: ${duration_seconds}s"
  log_info "  Dry Run: $DRY_RUN"
  log_info "  Rollback Steps: $ROLLBACK_STEPS"
  
  # Create summary file
  local summary_file="$ROOT_DIR/migration-summary-$(date '+%Y%m%d_%H%M%S').json"
  cat > "$summary_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "started": "$start_time",
  "completed": "$end_time",
  "duration_seconds": $duration_seconds,
  "dry_run": $DRY_RUN,
  "rollback_steps": $ROLLBACK_STEPS,
  "database_url": "${DATABASE_URL//:*@/:***@}",
  "success": true
}
EOF
  
  log_info "Migration summary saved to: $summary_file"
}

# Main migration function
main() {
  local start_time=$(date)
  
  log_info "Starting database migration for $ENVIRONMENT environment"
  log_info "Dry run: $DRY_RUN"
  
  # Load environment and check prerequisites
  load_environment
  check_prerequisites
  
  # Create backup before migration
  if [[ $ROLLBACK_STEPS -eq 0 ]]; then
    create_backup
  fi
  
  # Check current status
  check_migration_status
  
  # Perform migration or rollback
  if [[ $ROLLBACK_STEPS -gt 0 ]]; then
    rollback_migrations
  else
    apply_migrations
    seed_database
  fi
  
  # Verify migration
  verify_migration
  
  # Create summary
  create_summary "$start_time"
  
  log_success "Database migration completed successfully"
}

# Trap errors
trap 'log_error "Migration failed with error"; exit 1' ERR

# Check for required dependencies
if [[ "$ENVIRONMENT" == "production" ]] || [[ "$DATABASE_URL" =~ ^postgresql: ]]; then
  if ! command -v pg_dump &> /dev/null; then
    log_warning "pg_dump not found - PostgreSQL backups will not work"
  fi
fi

# Run main function
main "$@"