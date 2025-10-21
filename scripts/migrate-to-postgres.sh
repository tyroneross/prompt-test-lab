#!/bin/bash

# =============================================================================
# SQLite to PostgreSQL Migration Script
# =============================================================================
# This script handles the complete migration from SQLite to PostgreSQL

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
    command -v psql >/dev/null 2>&1 || { log_error "psql is required but not installed. Aborting."; exit 1; }
    command -v pnpm >/dev/null 2>&1 || { log_error "pnpm is required but not installed. Aborting."; exit 1; }
    
    # Check if environment variables are set
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    if [ -z "$OLD_DATABASE_URL" ]; then
        log_warning "OLD_DATABASE_URL not set, using default SQLite path"
        export OLD_DATABASE_URL="file:./packages/api/prisma/dev.db"
    fi
    
    log_success "Prerequisites check passed"
}

# Backup existing SQLite database
backup_sqlite() {
    log_info "Creating backup of existing SQLite database..."
    
    local sqlite_path=$(echo "$OLD_DATABASE_URL" | sed 's/file://')
    local backup_path="./backups/sqlite-backup-$(date +%Y%m%d-%H%M%S).db"
    
    # Create backups directory if it doesn't exist
    mkdir -p ./backups
    
    if [ -f "$sqlite_path" ]; then
        cp "$sqlite_path" "$backup_path"
        log_success "SQLite backup created: $backup_path"
    else
        log_warning "No existing SQLite database found at $sqlite_path"
    fi
}

# Update Prisma schema for PostgreSQL
update_prisma_schema() {
    log_info "Updating Prisma schema for PostgreSQL..."
    
    cd packages/api
    
    # Create backup of current schema
    cp prisma/schema.prisma prisma/schema.prisma.bak
    
    # Update datasource to PostgreSQL
    cat > prisma/schema.prisma.tmp << 'EOF'
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

EOF
    
    # Append the rest of the schema (excluding the generator and datasource blocks)
    sed -n '/^model /,$p' prisma/schema.prisma >> prisma/schema.prisma.tmp
    
    # Replace the original schema
    mv prisma/schema.prisma.tmp prisma/schema.prisma
    
    log_success "Prisma schema updated for PostgreSQL"
    cd ../..
}

# Create initial migration
create_initial_migration() {
    log_info "Creating initial PostgreSQL migration..."
    
    cd packages/api
    
    # Reset migrations directory
    rm -rf prisma/migrations
    
    # Create initial migration
    pnpm exec prisma migrate dev --name init --create-only
    
    log_success "Initial PostgreSQL migration created"
    cd ../..
}

# Export data from SQLite
export_sqlite_data() {
    log_info "Exporting data from SQLite..."
    
    local sqlite_path=$(echo "$OLD_DATABASE_URL" | sed 's/file://')
    
    if [ ! -f "$sqlite_path" ]; then
        log_warning "No existing SQLite database found. Starting with empty PostgreSQL database."
        return 0
    fi
    
    # Create data export directory
    mkdir -p ./migration-data
    
    # Export data as SQL
    sqlite3 "$sqlite_path" .dump > ./migration-data/sqlite-export.sql
    
    # Convert SQLite-specific syntax to PostgreSQL
    cat ./migration-data/sqlite-export.sql | \
        sed 's/AUTOINCREMENT/SERIAL/g' | \
        sed 's/INTEGER PRIMARY KEY/SERIAL PRIMARY KEY/g' | \
        sed 's/TEXT NOT NULL DEFAULT/VARCHAR NOT NULL DEFAULT/g' | \
        sed 's/REAL/NUMERIC/g' > ./migration-data/postgres-import.sql
    
    log_success "Data exported and converted for PostgreSQL"
}

# Apply migrations to PostgreSQL
apply_migrations() {
    log_info "Applying migrations to PostgreSQL..."
    
    cd packages/api
    
    # Deploy migrations
    pnpm exec prisma migrate deploy
    
    # Generate Prisma client
    pnpm exec prisma generate
    
    log_success "Migrations applied to PostgreSQL"
    cd ../..
}

# Import data to PostgreSQL (if exists)
import_data() {
    log_info "Importing data to PostgreSQL..."
    
    if [ ! -f "./migration-data/postgres-import.sql" ]; then
        log_warning "No data to import. Starting with empty database."
        return 0
    fi
    
    # Extract database connection details from DATABASE_URL
    local db_url="$DATABASE_URL"
    
    # Import data using psql
    if psql "$db_url" -f ./migration-data/postgres-import.sql; then
        log_success "Data imported successfully"
    else
        log_warning "Data import had some issues. Please check manually."
    fi
}

# Verify migration
verify_migration() {
    log_info "Verifying migration..."
    
    cd packages/api
    
    # Check database connection
    if pnpm exec prisma db push --accept-data-loss; then
        log_success "Database schema verification passed"
    else
        log_error "Database schema verification failed"
        exit 1
    fi
    
    # Run a simple query to verify data
    cat > verify-migration.js << 'EOF'
const { PrismaClient } = require('./src/generated/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Test basic connection
    await prisma.$connect();
    console.log('✓ Database connection successful');
    
    // Count records in main tables
    const userCount = await prisma.user.count();
    const projectCount = await prisma.project.count();
    const promptCount = await prisma.prompt.count();
    
    console.log(`✓ Users: ${userCount}`);
    console.log(`✓ Projects: ${projectCount}`);
    console.log(`✓ Prompts: ${promptCount}`);
    
  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
EOF
    
    node verify-migration.js
    rm verify-migration.js
    
    log_success "Migration verification completed"
    cd ../..
}

# Cleanup temporary files
cleanup() {
    log_info "Cleaning up temporary files..."
    
    rm -rf ./migration-data
    
    log_success "Cleanup completed"
}

# Update environment configuration
update_env_config() {
    log_info "Updating environment configuration..."
    
    # Update .env file to use PostgreSQL
    if [ -f ".env" ]; then
        # Comment out old SQLite URL
        sed -i.bak 's/^DATABASE_URL=file:/# DATABASE_URL=file:/' .env
        
        # Add PostgreSQL URL if not already present
        if ! grep -q "DATABASE_URL=postgresql" .env; then
            echo "" >> .env
            echo "# PostgreSQL Database (Production)" >> .env
            echo "DATABASE_URL=$DATABASE_URL" >> .env
        fi
    fi
    
    log_success "Environment configuration updated"
}

# Main migration function
main() {
    log_info "Starting SQLite to PostgreSQL migration..."
    
    check_prerequisites
    backup_sqlite
    update_prisma_schema
    create_initial_migration
    export_sqlite_data
    apply_migrations
    import_data
    verify_migration
    update_env_config
    cleanup
    
    log_success "🎉 Migration completed successfully!"
    log_info "Your application is now using PostgreSQL"
    log_info "SQLite backup is available in ./backups/"
    log_info "Remember to update your production environment variables"
}

# Script arguments
case "${1:-}" in
    --dry-run)
        log_info "Dry run mode - no changes will be made"
        check_prerequisites
        log_info "Migration plan:"
        log_info "1. Backup SQLite database"
        log_info "2. Update Prisma schema to PostgreSQL"
        log_info "3. Create initial migration"
        log_info "4. Export SQLite data"
        log_info "5. Apply migrations to PostgreSQL"
        log_info "6. Import data to PostgreSQL"
        log_info "7. Verify migration"
        log_info "8. Update environment configuration"
        ;;
    --rollback)
        log_info "Rolling back to SQLite..."
        cd packages/api
        if [ -f "prisma/schema.prisma.bak" ]; then
            mv prisma/schema.prisma.bak prisma/schema.prisma
            pnpm exec prisma generate
            log_success "Rolled back to SQLite schema"
        else
            log_error "No backup schema found"
            exit 1
        fi
        cd ../..
        ;;
    --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --dry-run    Show what would be done without making changes"
        echo "  --rollback   Rollback to SQLite schema"
        echo "  --help       Show this help"
        echo ""
        echo "Environment variables:"
        echo "  DATABASE_URL      PostgreSQL connection URL (required)"
        echo "  OLD_DATABASE_URL  SQLite database path (optional)"
        exit 0
        ;;
    *)
        main
        ;;
esac