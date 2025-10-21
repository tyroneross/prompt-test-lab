#!/bin/bash
set -e

# Database backup script for Prompt Testing Lab
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
LOG_FILE="$ROOT_DIR/backup.log"

# Default values
ENVIRONMENT="development"
RETENTION_DAYS=30
COMPRESS=true
VERIFY_BACKUP=true
UPLOAD_TO_S3=false
S3_BUCKET=""
DRY_RUN=false

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
Database Backup Script for Prompt Testing Lab

Usage: $0 [OPTIONS]

OPTIONS:
  -e, --environment ENV     Target environment (development|staging|production) [default: development]
  -r, --retention DAYS      Number of days to retain backups [default: 30]
  -c, --no-compress         Don't compress backup files
  -v, --no-verify           Skip backup verification
  -s, --s3-upload           Upload backup to S3
  -b, --s3-bucket BUCKET    S3 bucket name for uploads
  -d, --dry-run            Show what would be backed up without executing
  -h, --help               Show this help message

EXAMPLES:
  $0                                    # Backup development database
  $0 -e production -s -b my-backups    # Backup production and upload to S3
  $0 -r 7 -c                           # Keep 7 days of uncompressed backups
  $0 -d -e staging                     # Dry run for staging environment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -r|--retention)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    -c|--no-compress)
      COMPRESS=false
      shift
      ;;
    -v|--no-verify)
      VERIFY_BACKUP=false
      shift
      ;;
    -s|--s3-upload)
      UPLOAD_TO_S3=true
      shift
      ;;
    -b|--s3-bucket)
      S3_BUCKET="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
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
  
  # Check for required tools based on database type
  if [[ "$DATABASE_URL" =~ ^postgresql: ]]; then
    if ! command -v pg_dump &> /dev/null; then
      log_error "pg_dump is required for PostgreSQL backups"
      return 1
    fi
  fi
  
  # Check for compression tools
  if [[ "$COMPRESS" == true ]]; then
    if ! command -v gzip &> /dev/null; then
      log_warning "gzip not found, disabling compression"
      COMPRESS=false
    fi
  fi
  
  # Check for S3 tools
  if [[ "$UPLOAD_TO_S3" == true ]]; then
    if ! command -v aws &> /dev/null; then
      log_error "AWS CLI is required for S3 uploads"
      return 1
    fi
    
    if [[ -z "$S3_BUCKET" ]]; then
      log_error "S3 bucket name is required for uploads"
      return 1
    fi
  fi
  
  log_success "Prerequisites check passed"
}

# Create backup directory
create_backup_directory() {
  local backup_dir="$ROOT_DIR/backups/database"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would create backup directory: $backup_dir"
    return 0
  fi
  
  mkdir -p "$backup_dir"
  log_info "Backup directory: $backup_dir"
  echo "$backup_dir"
}

# Create SQLite backup
backup_sqlite() {
  local db_file="$1"
  local backup_dir="$2"
  local timestamp="$3"
  
  local backup_file="$backup_dir/sqlite_${ENVIRONMENT}_${timestamp}.db"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would backup SQLite: $db_file -> $backup_file"
    return 0
  fi
  
  if [[ -f "$db_file" ]]; then
    # Create SQLite backup using .backup command
    sqlite3 "$db_file" ".backup '$backup_file'"
    
    log_success "SQLite backup created: $(basename "$backup_file")"
    
    # Compress if requested
    if [[ "$COMPRESS" == true ]]; then
      gzip "$backup_file"
      backup_file="${backup_file}.gz"
      log_info "Backup compressed: $(basename "$backup_file")"
    fi
    
    echo "$backup_file"
  else
    log_error "SQLite database file not found: $db_file"
    return 1
  fi
}

# Create PostgreSQL backup
backup_postgresql() {
  local db_url="$1"
  local backup_dir="$2"
  local timestamp="$3"
  
  local backup_file="$backup_dir/postgresql_${ENVIRONMENT}_${timestamp}.sql"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would backup PostgreSQL to: $backup_file"
    return 0
  fi
  
  # Parse connection details
  local db_url_pattern="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
  if [[ "$db_url" =~ $db_url_pattern ]]; then
    local db_user="${BASH_REMATCH[1]}"
    local db_pass="${BASH_REMATCH[2]}"
    local db_host="${BASH_REMATCH[3]}"
    local db_port="${BASH_REMATCH[4]}"
    local db_name="${BASH_REMATCH[5]}"
    
    log_info "Creating PostgreSQL backup for database: $db_name"
    
    # Create backup using pg_dump
    PGPASSWORD="$db_pass" pg_dump \
      -h "$db_host" \
      -p "$db_port" \
      -U "$db_user" \
      -d "$db_name" \
      --clean \
      --create \
      --if-exists \
      --verbose \
      --format=plain \
      > "$backup_file" 2>>"$LOG_FILE"
    
    log_success "PostgreSQL backup created: $(basename "$backup_file")"
    
    # Compress if requested
    if [[ "$COMPRESS" == true ]]; then
      gzip "$backup_file"
      backup_file="${backup_file}.gz"
      log_info "Backup compressed: $(basename "$backup_file")"
    fi
    
    echo "$backup_file"
  else
    log_error "Could not parse PostgreSQL connection string"
    return 1
  fi
}

# Verify backup integrity
verify_backup() {
  local backup_file="$1"
  
  if [[ "$VERIFY_BACKUP" != true ]]; then
    log_info "Skipping backup verification"
    return 0
  fi
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would verify backup: $backup_file"
    return 0
  fi
  
  log_info "Verifying backup integrity..."
  
  # Check if file exists and is not empty
  if [[ ! -f "$backup_file" ]]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi
  
  if [[ ! -s "$backup_file" ]]; then
    log_error "Backup file is empty: $backup_file"
    return 1
  fi
  
  # Check file type and verify accordingly
  if [[ "$backup_file" =~ \.gz$ ]]; then
    # Verify gzip file
    if gzip -t "$backup_file"; then
      log_success "Compressed backup verification passed"
    else
      log_error "Compressed backup verification failed"
      return 1
    fi
  elif [[ "$backup_file" =~ \.sql$ ]]; then
    # Basic SQL file verification
    if grep -q "PostgreSQL database dump" "$backup_file"; then
      log_success "PostgreSQL backup verification passed"
    else
      log_warning "PostgreSQL backup verification inconclusive"
    fi
  elif [[ "$backup_file" =~ \.db$ ]]; then
    # SQLite file verification
    if sqlite3 "$backup_file" "PRAGMA integrity_check;" | grep -q "ok"; then
      log_success "SQLite backup verification passed"
    else
      log_error "SQLite backup verification failed"
      return 1
    fi
  fi
  
  # Check file size (should be reasonable)
  local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
  if [[ $file_size -gt 0 ]]; then
    log_info "Backup size: $(numfmt --to=iec "$file_size")"
  fi
}

# Upload backup to S3
upload_to_s3() {
  local backup_file="$1"
  
  if [[ "$UPLOAD_TO_S3" != true ]]; then
    return 0
  fi
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would upload to S3: s3://$S3_BUCKET/$(basename "$backup_file")"
    return 0
  fi
  
  log_info "Uploading backup to S3..."
  
  local s3_key="database-backups/$ENVIRONMENT/$(basename "$backup_file")"
  
  if aws s3 cp "$backup_file" "s3://$S3_BUCKET/$s3_key" \
    --storage-class STANDARD_IA \
    --metadata "environment=$ENVIRONMENT,created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; then
    log_success "Backup uploaded to S3: s3://$S3_BUCKET/$s3_key"
  else
    log_error "Failed to upload backup to S3"
    return 1
  fi
}

# Clean up old backups
cleanup_old_backups() {
  local backup_dir="$1"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would clean up backups older than $RETENTION_DAYS days"
    return 0
  fi
  
  log_info "Cleaning up backups older than $RETENTION_DAYS days..."
  
  local deleted_count=0
  
  # Find and delete old backup files
  while IFS= read -r -d '' file; do
    if [[ -f "$file" ]]; then
      rm "$file"
      log_info "Deleted old backup: $(basename "$file")"
      ((deleted_count++))
    fi
  done < <(find "$backup_dir" -name "*_${ENVIRONMENT}_*" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
  
  if [[ $deleted_count -eq 0 ]]; then
    log_info "No old backups to clean up"
  else
    log_success "Cleaned up $deleted_count old backup(s)"
  fi
  
  # Clean up old S3 backups if enabled
  if [[ "$UPLOAD_TO_S3" == true ]]; then
    cleanup_s3_backups
  fi
}

# Clean up old S3 backups
cleanup_s3_backups() {
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would clean up S3 backups older than $RETENTION_DAYS days"
    return 0
  fi
  
  log_info "Cleaning up old S3 backups..."
  
  local cutoff_date=$(date -d "$RETENTION_DAYS days ago" -u +%Y-%m-%dT%H:%M:%SZ)
  
  # List and delete old backups
  aws s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "database-backups/$ENVIRONMENT/" \
    --query "Contents[?LastModified<='$cutoff_date'].Key" \
    --output text | \
  while read -r key; do
    if [[ -n "$key" && "$key" != "None" ]]; then
      aws s3 rm "s3://$S3_BUCKET/$key"
      log_info "Deleted old S3 backup: $key"
    fi
  done
}

# Generate backup report
generate_report() {
  local backup_file="$1"
  local start_time="$2"
  local end_time=$(date)
  local duration_seconds=$(($(date +%s) - $(date -d "$start_time" +%s)))
  
  local file_size=0
  if [[ -f "$backup_file" ]]; then
    file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo 0)
  fi
  
  log_info "Backup Report:"
  log_info "  Environment: $ENVIRONMENT"
  log_info "  Started: $start_time"
  log_info "  Completed: $end_time"
  log_info "  Duration: ${duration_seconds}s"
  log_info "  File Size: $(numfmt --to=iec "$file_size")"
  log_info "  Compressed: $COMPRESS"
  log_info "  Verified: $VERIFY_BACKUP"
  log_info "  S3 Upload: $UPLOAD_TO_S3"
  
  # Create JSON report
  local report_file="$ROOT_DIR/backup-report-$(date '+%Y%m%d_%H%M%S').json"
  cat > "$report_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "started": "$start_time",
  "completed": "$end_time",
  "duration_seconds": $duration_seconds,
  "file_size_bytes": $file_size,
  "file_path": "$backup_file",
  "compressed": $COMPRESS,
  "verified": $VERIFY_BACKUP,
  "s3_upload": $UPLOAD_TO_S3,
  "s3_bucket": "$S3_BUCKET",
  "retention_days": $RETENTION_DAYS,
  "success": true
}
EOF
  
  log_info "Backup report saved to: $report_file"
}

# Main backup function
main() {
  local start_time=$(date)
  local timestamp=$(date '+%Y%m%d_%H%M%S')
  
  log_info "Starting database backup for $ENVIRONMENT environment"
  log_info "Retention: $RETENTION_DAYS days, Compress: $COMPRESS, Verify: $VERIFY_BACKUP"
  
  # Load environment and check prerequisites
  load_environment
  check_prerequisites
  
  # Create backup directory
  local backup_dir
  backup_dir=$(create_backup_directory)
  
  # Create backup based on database type
  local backup_file=""
  
  if [[ "$DATABASE_URL" =~ ^file: ]]; then
    # SQLite backup
    local db_file="${DATABASE_URL#file:}"
    # Convert relative path to absolute
    if [[ ! "$db_file" =~ ^/ ]]; then
      db_file="$ROOT_DIR/packages/api/$db_file"
    fi
    backup_file=$(backup_sqlite "$db_file" "$backup_dir" "$timestamp")
  elif [[ "$DATABASE_URL" =~ ^postgresql: ]]; then
    # PostgreSQL backup
    backup_file=$(backup_postgresql "$DATABASE_URL" "$backup_dir" "$timestamp")
  else
    log_error "Unsupported database type in DATABASE_URL: $DATABASE_URL"
    exit 1
  fi
  
  # Verify backup
  if [[ -n "$backup_file" ]]; then
    verify_backup "$backup_file"
    upload_to_s3 "$backup_file"
  fi
  
  # Clean up old backups
  cleanup_old_backups "$backup_dir"
  
  # Generate report
  generate_report "$backup_file" "$start_time"
  
  log_success "Database backup completed successfully"
}

# Trap errors
trap 'log_error "Backup failed with error"; exit 1' ERR

# Run main function
main "$@"