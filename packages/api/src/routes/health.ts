/**
 * Health check routes
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { PrismaClient } from '../generated/client';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const router: Router = Router();

// Basic health check
router.get('/', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(health);
}));

// Detailed health check with dependencies
router.get('/detailed', asyncHandler(async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    llmProviders: await checkLLMProviders(),
    memory: checkMemory(),
    disk: await checkDisk()
  };

  const isHealthy = Object.values(checks).every(check => check.status === 'healthy');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
}));

// Readiness check for container orchestration
router.get('/ready', asyncHandler(async (req, res) => {
  // Check if the service is ready to accept traffic
  const isReady = await checkReadiness();
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString()
  });
}));

// Liveness check for container orchestration
router.get('/live', asyncHandler(async (req, res) => {
  // Check if the service is still alive
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}));

// Helper functions
async function checkDatabase(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    // Perform a simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

async function checkLLMProviders(): Promise<Record<string, { status: string; latency?: number; error?: string }>> {
  const providers = {
    openai: { status: 'unknown' as string, latency: undefined as number | undefined, error: undefined as string | undefined },
    anthropic: { status: 'unknown' as string, latency: undefined as number | undefined, error: undefined as string | undefined }
  };

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const start = Date.now();
      // Make a simple API call to check OpenAI availability
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        providers.openai = {
          status: 'healthy',
          latency: Date.now() - start,
          error: undefined
        };
      } else {
        providers.openai = {
          status: 'unhealthy',
          latency: Date.now() - start,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      providers.openai = {
        status: 'unhealthy',
        latency: undefined,
        error: error instanceof Error ? error.message : 'OpenAI check failed'
      };
    }
  } else {
    providers.openai = {
      status: 'disabled',
      latency: undefined,
      error: 'API key not configured'
    };
  }

  // Check Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const start = Date.now();
      // Make a simple API call to check Anthropic availability
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }]
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      // Anthropic returns 200 for successful requests
      if (response.ok || response.status === 401) { // 401 means API is reachable but key might be invalid
        providers.anthropic = {
          status: response.ok ? 'healthy' : 'auth_error',
          latency: Date.now() - start,
          error: response.ok ? undefined : 'Invalid API key'
        };
      } else {
        providers.anthropic = {
          status: 'unhealthy',
          latency: Date.now() - start,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      providers.anthropic = {
        status: 'unhealthy',
        latency: undefined,
        error: error instanceof Error ? error.message : 'Anthropic check failed'
      };
    }
  } else {
    providers.anthropic = {
      status: 'disabled',
      latency: undefined,
      error: 'API key not configured'
    };
  }

  return providers;
}

function checkMemory(): { status: string; usage: NodeJS.MemoryUsage; warning?: string } {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;

  let status = 'healthy';
  let warning: string | undefined;

  if (usagePercent > 90) {
    status = 'critical';
    warning = 'Memory usage critically high';
  } else if (usagePercent > 80) {
    status = 'warning';
    warning = 'Memory usage high';
  }

  return {
    status,
    usage,
    warning
  };
}

async function checkDisk(): Promise<{ status: string; available?: string; used?: string; percentage?: number; error?: string }> {
  try {
    // Get disk space information
    if (process.platform === 'win32') {
      // Windows platform - skip for now
      return { 
        status: 'unknown',
        error: 'Disk check not implemented for Windows'
      };
    }
    
    // Unix-like systems (Linux, macOS)
    const { stdout } = await execAsync('df -h /');
    const lines = stdout.trim().split('\n');
    
    if (lines.length < 2) {
      return { 
        status: 'unknown',
        error: 'Unable to parse disk information'
      };
    }
    
    // Parse the output (second line contains the data)
    const parts = lines[1].split(/\s+/);
    const used = parts[2];
    const available = parts[3];
    const percentageStr = parts[4];
    const percentage = parseInt(percentageStr.replace('%', ''));
    
    let status = 'healthy';
    if (percentage > 90) {
      status = 'critical';
    } else if (percentage > 80) {
      status = 'warning';
    }
    
    return { 
      status,
      available,
      used,
      percentage
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Disk check failed'
    };
  }
}

async function checkReadiness(): Promise<boolean> {
  try {
    // Check if all critical dependencies are available
    const dbHealthy = (await checkDatabase()).status === 'healthy';
    const memoryOk = checkMemory().status !== 'critical';
    
    return dbHealthy && memoryOk;
  } catch {
    return false;
  }
}

export default router;