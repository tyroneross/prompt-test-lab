#!/bin/bash

# =============================================================================
# Convert Remaining Express Routes to Vercel Functions
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Convert prompts routes
create_prompts_routes() {
    log_info "Creating prompts API routes..."
    
    # List prompts
    cat > packages/api/api/prompts/index.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/database/prisma';
import { authMiddleware } from '../../middleware/auth';
import { corsMiddleware } from '../../middleware/cors';

export async function GET(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const prompts = await prisma.prompt.findMany({
      where: {
        projectId,
        isArchived: false
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    return NextResponse.json(prompts, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const data = await request.json();
    
    const prompt = await prisma.prompt.create({
      data: {
        ...data,
        tags: JSON.stringify(data.tags || []),
        metadata: JSON.stringify(data.metadata || {})
      }
    });
    
    return NextResponse.json(prompt, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF

    # Test prompt endpoint
    cat > packages/api/api/prompts/test.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/database/prisma';
import { authMiddleware } from '../../middleware/auth';
import { corsMiddleware } from '../../middleware/cors';
import { testPrompt } from '../../lib/services/llm';
import { broadcastEvent } from '../../lib/services/realtime';

export async function POST(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const { promptId, input, models } = await request.json();
    
    // Create test run
    const testRun = await prisma.testRun.create({
      data: {
        name: `Test run ${new Date().toISOString()}`,
        status: 'RUNNING',
        config: JSON.stringify({ models, input }),
        promptId,
        projectId: (await prisma.prompt.findUnique({ 
          where: { id: promptId }, 
          select: { projectId: true } 
        }))?.projectId!,
        userId: auth.userId
      }
    });
    
    // Queue the test job
    await prisma.queueJob.create({
      data: {
        type: 'test_run',
        data: JSON.stringify({
          testRunId: testRun.id,
          promptId,
          input,
          models
        }),
        priority: 1
      }
    });
    
    // Broadcast test started event via Supabase
    await broadcastEvent(
      `project-${testRun.projectId}`,
      'test-started',
      { testRunId: testRun.id }
    );
    
    return NextResponse.json(
      { testRunId: testRun.id, status: 'queued' },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start test' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF
    
    log_success "Prompts routes created"
}

# Convert test runs routes
create_test_runs_routes() {
    log_info "Creating test runs API routes..."
    
    cat > packages/api/api/test-runs/index.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/database/prisma';
import { authMiddleware } from '../../middleware/auth';
import { corsMiddleware } from '../../middleware/cors';

export async function GET(request: NextRequest) {
  const corsHeaders = corsMiddleware(request);
  
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    const testRuns = await prisma.testRun.findMany({
      where: projectId ? { projectId } : { userId: auth.userId },
      include: {
        prompt: { select: { name: true } },
        responses: true,
        metrics: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    return NextResponse.json(testRuns, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch test runs' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF

    # Test run details endpoint
    cat > packages/api/api/test-runs/[id].ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/database/prisma';
import { authMiddleware } from '../../../middleware/auth';
import { corsMiddleware } from '../../../middleware/cors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const corsHeaders = corsMiddleware(request);
  
  const auth = await authMiddleware(request);
  if (!auth.authenticated) return auth;
  
  try {
    const testRun = await prisma.testRun.findUnique({
      where: { id: params.id },
      include: {
        prompt: true,
        responses: true,
        metrics: true,
        project: { select: { name: true } }
      }
    });
    
    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    
    return NextResponse.json(testRun, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch test run' },
      { status: 500, headers: corsHeaders }
    );
  }
}
EOF
    
    log_success "Test runs routes created"
}

# Create LLM service for serverless
create_llm_service() {
    log_info "Creating LLM service for serverless..."
    
    cat > packages/api/lib/services/llm.ts << 'EOF'
import OpenAI from 'openai';

// Initialize LLM clients
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function testPrompt(
  prompt: string,
  input: string,
  model: string
): Promise<{ output: string; tokenUsage?: any; latencyMs: number; cost?: number }> {
  const startTime = Date.now();
  
  try {
    if (model.startsWith('gpt-') && openai) {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: input }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });
      
      return {
        output: response.choices[0]?.message?.content || '',
        tokenUsage: response.usage,
        latencyMs: Date.now() - startTime,
        cost: calculateCost(model, response.usage)
      };
    }
    
    // Add other providers (Groq, Anthropic) here
    
    throw new Error(`Model ${model} not supported`);
  } catch (error) {
    throw new Error(`LLM test failed: ${error.message}`);
  }
}

function calculateCost(model: string, usage: any): number {
  // Simple cost calculation
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 }
  };
  
  const modelCost = costs[model] || { input: 0, output: 0 };
  return (
    (usage?.prompt_tokens || 0) * modelCost.input / 1000 +
    (usage?.completion_tokens || 0) * modelCost.output / 1000
  );
}

export async function processTestRun(data: any) {
  const { testRunId, promptId, input, models } = data;
  
  try {
    // Get prompt content
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId }
    });
    
    if (!prompt) throw new Error('Prompt not found');
    
    // Test with each model
    const results = await Promise.allSettled(
      models.map(async (model: string) => {
        const result = await testPrompt(prompt.content, input, model);
        
        // Save response
        await prisma.testResponse.create({
          data: {
            testRunId,
            modelProvider: model.split('-')[0],
            modelName: model,
            input,
            output: result.output,
            tokenUsage: JSON.stringify(result.tokenUsage),
            latencyMs: result.latencyMs,
            cost: result.cost
          }
        });
        
        return result;
      })
    );
    
    // Update test run status
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    
    // Broadcast completion
    await broadcastEvent(
      `test-${testRunId}`,
      'test-completed',
      { testRunId, results }
    );
    
    return results;
  } catch (error) {
    // Update test run with error
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'FAILED',
        metadata: JSON.stringify({ error: error.message })
      }
    });
    
    throw error;
  }
}
EOF
    
    log_success "LLM service created"
}

# Update frontend for serverless
update_frontend_config() {
    log_info "Updating frontend configuration for serverless..."
    
    # Update API client
    cat > packages/web/src/lib/api-client-serverless.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase for real-time
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// Subscribe to test updates
export function subscribeToTestUpdates(
  testRunId: string,
  onUpdate: (data: any) => void
) {
  return supabase
    .channel(`test-${testRunId}`)
    .on('broadcast', { event: 'test-completed' }, ({ payload }) => {
      onUpdate(payload);
    })
    .subscribe();
}

// Subscribe to project updates
export function subscribeToProjectUpdates(
  projectId: string,
  onUpdate: (data: any) => void
) {
  return supabase
    .channel(`project-${projectId}`)
    .on('broadcast', { event: '*' }, ({ payload }) => {
      onUpdate(payload);
    })
    .subscribe();
}

export { supabase };
EOF

    # Update environment example
    cat > packages/web/.env.serverless.example << 'EOF'
# Serverless API Configuration
VITE_API_URL=/api

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional
VITE_ENABLE_ANALYTICS=true
EOF
    
    log_success "Frontend configuration updated"
}

# Main function
main() {
    log_info "Converting remaining routes to Vercel functions..."
    
    create_prompts_routes
    create_test_runs_routes
    create_llm_service
    update_frontend_config
    
    log_success "✅ All routes converted successfully!"
}

main