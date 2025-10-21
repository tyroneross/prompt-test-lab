# Vercel Serverless Migration Guide

## Architecture: Full Vercel + Supabase

This guide shows how to migrate from the hybrid Railway + Vercel architecture to a full serverless setup using only Vercel and Supabase.

## New Architecture

```
Frontend (Vercel) → API Functions (Vercel) → Database (Supabase)
                ↘ Real-time (Supabase) ↗
                ↘ Background Jobs (Vercel Cron) ↗
```

## Required Changes

### 1. API Structure Changes

Move from Express.js server to Vercel API routes:

```
packages/api/src/
├── api/                    # Vercel API routes
│   ├── auth/
│   │   └── login.ts       # /api/auth/login
│   ├── projects/
│   │   └── index.ts       # /api/projects
│   ├── prompts/
│   │   └── [id]/
│   │       └── test.ts    # /api/prompts/[id]/test
│   └── health.ts          # /api/health
├── lib/                   # Shared utilities
│   ├── database.ts
│   ├── auth.ts
│   └── llm.ts
└── middleware/            # Middleware functions
    ├── auth.ts
    └── cors.ts
```

### 2. Replace Express with Vercel Functions

**Before (Express):**
```typescript
// packages/api/src/index.ts
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
```

**After (Vercel Functions):**
```typescript
// packages/api/api/auth/login.ts
import { NextRequest, NextResponse } from 'next/server';
import { authService } from '../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await authService.login(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 3. WebSocket → Supabase Realtime

**Before (WebSocket server):**
```typescript
// packages/api/src/services/websocket.service.ts
websocketService.broadcast('test-completed', result);
```

**After (Supabase Realtime):**
```typescript
// packages/api/lib/realtime.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

export async function broadcastUpdate(channel: string, payload: any) {
  await supabase.channel(channel).send({
    type: 'broadcast',
    event: 'update',
    payload
  });
}
```

### 4. Background Jobs → Vercel Cron

**Before (Queue service):**
```typescript
// packages/api/src/services/queue.service.ts
QueueService.add('test-run', { promptId, config });
```

**After (Vercel Cron):**
```typescript
// packages/api/api/cron/process-queue.ts
export async function GET() {
  const jobs = await getQueuedJobs();
  for (const job of jobs) {
    await processJob(job);
  }
  return NextResponse.json({ processed: jobs.length });
}
```

**Vercel cron config:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-queue",
    "schedule": "*/5 * * * *"
  }]
}
```

### 5. Database Connection Optimization

**Serverless-optimized Prisma:**
```typescript
// packages/api/lib/database.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

## Migration Steps

### Step 1: Update Package Structure

```bash
# Create new API structure
mkdir -p packages/api/api
mkdir -p packages/api/lib
mkdir -p packages/api/middleware

# Copy current logic to new structure
cp packages/api/src/routes/* packages/api/api/
cp packages/api/src/services/* packages/api/lib/
cp packages/api/src/middleware/* packages/api/middleware/
```

### Step 2: Convert Routes to API Functions

```bash
# Run conversion script
./scripts/convert-to-vercel-functions.sh
```

### Step 3: Update Database for Supabase

```bash
# Enable Supabase real-time
./scripts/setup-supabase.sh --production
```

### Step 4: Configure Vercel Deployment

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/web/**/*",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "packages/api/api/**/*.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/packages/api/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/packages/web/$1"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Step 5: Environment Variables

Update for serverless:
```bash
# Vercel Environment Variables
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-32-char-secret
OPENAI_API_KEY=your-openai-key
```

## Performance Comparison

| Feature | Railway + Vercel | Vercel Serverless |
|---------|------------------|-------------------|
| Cold Start | 0ms (always warm) | 200-500ms |
| Concurrent Requests | High (dedicated) | Plan-dependent |
| WebSocket Support | Native | External service |
| Background Jobs | Native | Cron + external queue |
| Cost (low usage) | $15-30/month | $0-10/month |
| Cost (high usage) | $30-100/month | $50-200/month |

## When to Choose Serverless

**✅ Good for:**
- Infrequent usage patterns
- Budget-conscious projects
- Simple request/response APIs
- Automatic scaling needs

**❌ Not ideal for:**
- Real-time features (gaming, live chat)
- Long-running processes (>15 minutes)
- High-frequency background jobs
- Consistent low latency requirements

## Migration Script

Want me to create the conversion scripts to migrate your current codebase to this serverless architecture?

```bash
# Generate migration
./scripts/generate-serverless-migration.sh

# Apply migration  
./scripts/apply-serverless-migration.sh

# Test locally
vercel dev

# Deploy
vercel --prod
```

## Recommendation

For your **Prompt Testing Lab** use case:
- **Keep hybrid architecture** if you plan to have many concurrent users or real-time features
- **Switch to serverless** if you want simpler deployment and lower costs for moderate usage

The serverless approach works well for prompt testing since:
- ✅ Tests are typically async anyway
- ✅ Cold starts acceptable for testing workflows  
- ✅ Cost scales with actual usage
- ✅ Real-time updates can use Supabase subscriptions