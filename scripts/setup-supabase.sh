#!/bin/bash

# =============================================================================
# Supabase Setup Script
# =============================================================================
# This script helps set up Supabase for the Prompt Testing Lab

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

# Check if Supabase CLI is installed
check_supabase_cli() {
    if ! command -v supabase >/dev/null 2>&1; then
        log_error "Supabase CLI is not installed."
        log_info "Install it with: npm install -g supabase"
        log_info "Or visit: https://supabase.com/docs/guides/cli"
        exit 1
    fi
    
    log_success "Supabase CLI is installed"
}

# Initialize Supabase project
init_supabase() {
    log_info "Initializing Supabase project..."
    
    if [ ! -f "supabase/config.toml" ]; then
        supabase init
        log_success "Supabase project initialized"
    else
        log_warning "Supabase project already initialized"
    fi
}

# Start local Supabase (for development)
start_local_supabase() {
    log_info "Starting local Supabase..."
    
    # Start Supabase local development
    supabase start
    
    # Get local connection details
    local db_url=$(supabase status --output json | jq -r '.DB_URL')
    local anon_key=$(supabase status --output json | jq -r '.ANON_KEY')
    local service_role_key=$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY')
    
    log_success "Local Supabase started"
    log_info "Database URL: $db_url"
    log_info "Anon Key: $anon_key"
    log_info "Service Role Key: $service_role_key"
    
    # Update local .env
    update_local_env "$db_url" "$anon_key" "$service_role_key"
}

# Update local environment file
update_local_env() {
    local db_url="$1"
    local anon_key="$2"
    local service_role_key="$3"
    
    log_info "Updating local environment file..."
    
    # Create or update .env.local
    cat > .env.local << EOF
# Supabase Local Development
DATABASE_URL="$db_url"
SUPABASE_URL="http://localhost:54321"
SUPABASE_ANON_KEY="$anon_key"
SUPABASE_SERVICE_ROLE_KEY="$service_role_key"

# API Configuration
NODE_ENV=development
PORT=4001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8000

# JWT Configuration (use Supabase JWT secret)
JWT_SECRET="$service_role_key"
EOF
    
    log_success "Local environment file updated: .env.local"
}

# Create Supabase migration from Prisma schema
create_migration_from_prisma() {
    log_info "Creating Supabase migration from Prisma schema..."
    
    cd packages/api
    
    # Generate SQL from Prisma schema
    pnpm exec prisma migrate diff \
        --from-empty \
        --to-schema-datamodel prisma/schema.prisma \
        --script > ../../supabase/migrations/$(date +%Y%m%d%H%M%S)_init_from_prisma.sql
    
    log_success "Migration created from Prisma schema"
    cd ../..
}

# Apply migrations to Supabase
apply_migrations() {
    log_info "Applying migrations to Supabase..."
    
    # Apply migrations to local Supabase
    supabase db push
    
    log_success "Migrations applied to Supabase"
}

# Generate TypeScript types
generate_types() {
    log_info "Generating TypeScript types..."
    
    # Generate types for the frontend
    supabase gen types typescript --local > packages/web/src/types/supabase.ts
    
    log_success "TypeScript types generated"
}

# Create Row Level Security (RLS) policies
create_rls_policies() {
    log_info "Creating Row Level Security policies..."
    
    cat > supabase/migrations/$(date +%Y%m%d%H%M%S)_enable_rls.sql << 'EOF'
-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_responses ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id::uuid);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id::uuid);

-- Project access based on ownership or membership
CREATE POLICY "Users can view projects they own or are members of" ON projects
    FOR SELECT USING (
        owner_id = auth.uid()::text OR
        id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Project owners can modify projects" ON projects
    FOR ALL USING (owner_id = auth.uid()::text);

-- Project members can view project content
CREATE POLICY "Members can view project prompts" ON prompts
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE
            owner_id = auth.uid()::text OR
            id IN (
                SELECT project_id FROM project_members 
                WHERE user_id = auth.uid()::text
            )
        )
    );

-- Similar policies for test_runs and test_responses
CREATE POLICY "Members can view test runs" ON test_runs
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE
            owner_id = auth.uid()::text OR
            id IN (
                SELECT project_id FROM project_members 
                WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can create test runs in their projects" ON test_runs
    FOR INSERT WITH CHECK (
        user_id = auth.uid()::text AND
        project_id IN (
            SELECT id FROM projects WHERE
            owner_id = auth.uid()::text OR
            id IN (
                SELECT project_id FROM project_members 
                WHERE user_id = auth.uid()::text
            )
        )
    );
EOF
    
    log_success "RLS policies created"
}

# Create Supabase functions
create_functions() {
    log_info "Creating Supabase edge functions..."
    
    # Create functions directory
    mkdir -p supabase/functions
    
    # Create a webhook handler function
    mkdir -p supabase/functions/webhook-handler
    cat > supabase/functions/webhook-handler/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { data, error } = await req.json()
    
    if (error) {
      throw error
    }

    // Process webhook data here
    console.log('Webhook received:', data)

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      },
    )
  }
})
EOF
    
    log_success "Edge functions created"
}

# Setup production Supabase project
setup_production() {
    log_info "Setting up production Supabase project..."
    
    # Link to production project (user needs to provide project reference)
    if [ -n "$SUPABASE_PROJECT_REF" ]; then
        supabase link --project-ref "$SUPABASE_PROJECT_REF"
        
        # Push migrations to production
        supabase db push --linked
        
        # Generate production types
        supabase gen types typescript --linked > packages/web/src/types/supabase-prod.ts
        
        log_success "Production Supabase project configured"
    else
        log_warning "SUPABASE_PROJECT_REF not set. Skipping production setup."
        log_info "To setup production:"
        log_info "1. Create a project at https://supabase.com"
        log_info "2. Set SUPABASE_PROJECT_REF environment variable"
        log_info "3. Run: $0 --production"
    fi
}

# Main setup function
main() {
    log_info "Setting up Supabase for Prompt Testing Lab..."
    
    check_supabase_cli
    init_supabase
    start_local_supabase
    create_migration_from_prisma
    apply_migrations
    create_rls_policies
    create_functions
    generate_types
    
    log_success "🎉 Supabase setup completed!"
    log_info "Local Supabase is running at http://localhost:54321"
    log_info "Dashboard: http://localhost:54321"
    log_info "Use .env.local for local development"
}

# Script arguments
case "${1:-}" in
    --production)
        log_info "Setting up production Supabase..."
        setup_production
        ;;
    --local-only)
        log_info "Setting up local Supabase only..."
        check_supabase_cli
        init_supabase
        start_local_supabase
        create_migration_from_prisma
        apply_migrations
        generate_types
        ;;
    --stop)
        log_info "Stopping local Supabase..."
        supabase stop
        log_success "Local Supabase stopped"
        ;;
    --reset)
        log_info "Resetting local Supabase..."
        supabase db reset
        log_success "Local Supabase reset"
        ;;
    --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --production   Setup production Supabase project"
        echo "  --local-only   Setup local development only"
        echo "  --stop         Stop local Supabase"
        echo "  --reset        Reset local Supabase database"
        echo "  --help         Show this help"
        echo ""
        echo "Environment variables:"
        echo "  SUPABASE_PROJECT_REF  Production project reference"
        exit 0
        ;;
    *)
        main
        ;;
esac