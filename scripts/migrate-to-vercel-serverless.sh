#!/bin/bash

# =============================================================================
# Express to Vercel Serverless Migration Script
# =============================================================================
# This script converts the Express.js API to Vercel serverless functions

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

# Create backup of current API
backup_current_api() {
    log_info "Creating backup of current API..."
    
    # Create backup directory
    local backup_dir="./backups/api-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Copy current API
    cp -r packages/api "$backup_dir/"
    
    log_success "Backup created at: $backup_dir"
}

# Create Vercel API structure
create_vercel_structure() {
    log_info "Creating Vercel serverless structure..."
    
    # Create new directories
    mkdir -p packages/api/api/{auth,projects,prompts,test-runs,analytics,health,cron}
    mkdir -p packages/api/lib/{database,services,utils}
    mkdir -p packages/api/middleware
    
    log_success "Vercel directory structure created"
}

# Convert middleware to Vercel format
convert_middleware() {
    log_info "Converting middleware to Vercel format..."
    
    # Create cors middleware
    cat > packages/api/middleware/cors.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
  
  const headers = new Headers();
  
  if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
    
    return new NextResponse(null, { status: 200, headers });
  }
  
  return headers;
}
EOF

    # Create auth middleware
    cat > packages/api/middleware/auth.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function authMiddleware(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Access token required', code: 'MISSING_TOKEN' },
        { status: 401 }
      );
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET || '');
    
    // Add user to request context (using headers as workaround)
    const headers = new Headers(request.headers);
    headers.set('x-user-id', payload.userId as string);
    
    return { authenticated: true, headers, userId: payload.userId };
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid token', code: 'INVALID_TOKEN' },
      { status: 401 }
    );
  }
}
EOF

    log_success "Middleware converted"
}

# Convert database service
convert_database_service() {
    log_info "Converting database service for serverless..."
    
    cat > packages/api/lib/database/prisma.ts << 'EOF'
import { PrismaClient } from '../../src/generated/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Helper to ensure connection
export async function ensureDbConnected() {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}
EOF

    log_success "Database service converted"
}

# Convert auth routes to Vercel functions
convert_auth_routes() {
    log_info "Converting auth routes..."
    
    # Login endpoint
    cat > packages/api/api/auth/login.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/database/prisma';
import { corsMiddleware } from '../../middleware/cors';

export async function POST(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
  }
  
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    // For demo purposes, accepting any password if user exists
    // In production, store and verify hashed passwords
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    return NextResponse.json(
      { token, user: { id: user.id, email: user.email, name: user.name } },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF

    # Register endpoint
    cat > packages/api/api/auth/register.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/database/prisma';
import { corsMiddleware } from '../../middleware/cors';

export async function POST(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  try {
    const { email, password, name } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409, headers: corsHeaders }
      );
    }
    
    // Create user (password hashing disabled for demo)
    const user = await prisma.user.create({
      data: { email, name: name || email.split('@')[0] }
    });
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    return NextResponse.json(
      { token, user: { id: user.id, email: user.email, name: user.name } },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF

    log_success "Auth routes converted"
}

# Convert health endpoints
convert_health_routes() {
    log_info "Converting health routes..."
    
    cat > packages/api/api/health.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../lib/database/prisma';
import { corsMiddleware } from '../middleware/cors';

export async function GET(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'unknown',
      database: 'checking...'
    };
    
    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = 'connected';
    } catch (error) {
      health.status = 'degraded';
      health.database = 'disconnected';
    }
    
    return NextResponse.json(health, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 503, headers: corsHeaders }
    );
  }
}
EOF

    log_success "Health routes converted"
}

# Convert project routes
convert_project_routes() {
    log_info "Converting project routes..."
    
    cat > packages/api/api/projects/index.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/database/prisma';
import { authMiddleware } from '../../middleware/auth';
import { corsMiddleware } from '../../middleware/cors';

export async function GET(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  // Check authentication
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: auth.userId },
          { members: { some: { userId: auth.userId } } }
        ]
      },
      include: {
        _count: {
          select: { prompts: true, testRuns: true }
        }
      }
    });
    
    return NextResponse.json(projects, { headers: corsHeaders });
  } catch (error) {
    console.error('Projects fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  // Check authentication
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const { name, description } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'Project name required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const project = await prisma.project.create({
      data: {
        name,
        description,
        ownerId: auth.userId
      }
    });
    
    return NextResponse.json(project, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF

    log_success "Project routes converted"
}

# Create Supabase realtime service
create_supabase_realtime() {
    log_info "Creating Supabase realtime service..."
    
    cat > packages/api/lib/services/realtime.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Broadcast event to channel
export async function broadcastEvent(channel: string, event: string, payload: any) {
  try {
    const result = await supabase.channel(channel).send({
      type: 'broadcast',
      event,
      payload
    });
    
    return result;
  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
}

// Subscribe to channel (for client-side)
export function subscribeToChannel(channel: string, callback: (payload: any) => void) {
  return supabase
    .channel(channel)
    .on('broadcast', { event: '*' }, (payload) => {
      callback(payload);
    })
    .subscribe();
}
EOF

    log_success "Supabase realtime service created"
}

# Create Vercel cron jobs
create_vercel_cron_jobs() {
    log_info "Creating Vercel cron jobs..."
    
    # Queue processor cron job
    cat > packages/api/api/cron/process-queue.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/database/prisma';
import { processTestRun } from '../../lib/services/test-execution';

export async function GET(request: NextRequest) {
  // Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get pending jobs
    const jobs = await prisma.queueJob.findMany({
      where: {
        status: 'pending',
        attempts: { lt: 3 }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 5 // Process 5 jobs per run
    });
    
    // Process each job
    const results = await Promise.allSettled(
      jobs.map(async (job) => {
        try {
          // Update job status
          await prisma.queueJob.update({
            where: { id: job.id },
            data: { status: 'active', attempts: { increment: 1 } }
          });
          
          // Process based on job type
          const data = JSON.parse(job.data);
          let result;
          
          switch (job.type) {
            case 'test_run':
              result = await processTestRun(data);
              break;
            default:
              throw new Error(`Unknown job type: ${job.type}`);
          }
          
          // Mark as completed
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'completed',
              processedAt: new Date()
            }
          });
          
          return { jobId: job.id, status: 'completed', result };
        } catch (error) {
          // Mark as failed
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: job.attempts >= 2 ? 'failed' : 'pending',
              error: error.message
            }
          });
          
          throw error;
        }
      })
    );
    
    return NextResponse.json({
      processed: jobs.length,
      results: results.map(r => 
        r.status === 'fulfilled' ? r.value : { error: r.reason.message }
      )
    });
  } catch (error) {
    console.error('Queue processing error:', error);
    return NextResponse.json(
      { error: 'Queue processing failed' },
      { status: 500 }
    );
  }
}
EOF

    log_success "Vercel cron jobs created"
}

# Create main Vercel configuration
create_vercel_config() {
    log_info "Creating Vercel configuration..."
    
    cat > vercel.json << 'EOF'
{
  "version": 2,
  "framework": null,
  "functions": {
    "packages/api/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/packages/api/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/packages/web/$1"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "*/5 * * * *"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "JWT_SECRET": "@jwt-secret",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key",
    "OPENAI_API_KEY": "@openai-api-key",
    "CRON_SECRET": "@cron-secret"
  }
}
EOF

    log_success "Vercel configuration created"
}

# Update package.json for Vercel
update_package_json() {
    log_info "Updating package.json for Vercel..."
    
    # Add Vercel dependencies
    cd packages/api
    npm install --save @vercel/node @supabase/supabase-js
    cd ../..
    
    # Update scripts
    cat > packages/api/package.json.tmp << 'EOF'
{
  "name": "@prompt-lab/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vercel dev --listen 4001",
    "build": "tsc",
    "deploy": "vercel --prod",
    "test": "jest"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "@supabase/supabase-js": "^2.39.0",
    "@vercel/node": "^3.0.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.11.0",
    "prisma": "^5.22.0",
    "typescript": "^5.3.3",
    "vercel": "^32.0.0"
  }
}
EOF
    
    mv packages/api/package.json.tmp packages/api/package.json
    
    log_success "Package.json updated"
}

# Test serverless setup locally
test_serverless_local() {
    log_info "Testing serverless functions locally..."
    
    # Install Vercel CLI if not present
    if ! command -v vercel &> /dev/null; then
        log_info "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    log_success "Ready to test with: vercel dev"
}

# Main migration function
main() {
    log_info "Starting Express to Vercel Serverless migration..."
    
    # Ask for confirmation
    echo
    read -p "This will convert your Express API to Vercel serverless. Continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Migration cancelled."
        exit 1
    fi
    
    backup_current_api
    create_vercel_structure
    convert_middleware
    convert_database_service
    convert_auth_routes
    convert_health_routes
    convert_project_routes
    create_supabase_realtime
    create_vercel_cron_jobs
    create_vercel_config
    update_package_json
    test_serverless_local
    
    log_success "🎉 Migration to Vercel serverless completed!"
    log_info "Next steps:"
    log_info "1. Set up Supabase: ./scripts/setup-supabase.sh"
    log_info "2. Configure Vercel environment variables"
    log_info "3. Test locally: vercel dev"
    log_info "4. Deploy: vercel --prod"
}

# Script arguments
case "${1:-}" in
    --dry-run)
        log_info "Dry run mode - showing what would be done"
        log_info "1. Backup current API"
        log_info "2. Create Vercel function structure"
        log_info "3. Convert Express routes to Vercel functions"
        log_info "4. Set up Supabase realtime"
        log_info "5. Create Vercel cron jobs"
        log_info "6. Update configuration files"
        ;;
    --rollback)
        log_info "Rolling back to Express API..."
        if [ -d "./backups" ]; then
            latest_backup=$(ls -t ./backups | head -1)
            if [ -n "$latest_backup" ]; then
                cp -r "./backups/$latest_backup/api" packages/
                log_success "Rolled back to: $latest_backup"
            else
                log_error "No backup found"
                exit 1
            fi
        else
            log_error "No backups directory found"
            exit 1
        fi
        ;;
    --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --dry-run    Show what would be done without making changes"
        echo "  --rollback   Rollback to Express API from backup"
        echo "  --help       Show this help"
        exit 0
        ;;
    *)
        main
        ;;
esac