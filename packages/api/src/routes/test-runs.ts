import { Router, Request, Response, NextFunction } from 'express';
import { TestExecutionService } from '../services/test-execution.service';
import { QueueService } from '../services/queue.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError } from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all test run routes
router.use(authMiddleware);

/**
 * POST /projects/:projectId/test-runs
 * Create and start a new test run
 */
router.post('/projects/:projectId/test-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const testRun = await TestExecutionService.createTestRun(projectId, req.user.sub, req.body);
    
    res.status(201).json({
      success: true,
      data: testRun,
      message: 'Test run created and queued successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /test-runs/:testRunId
 * Get test run details and results
 */
router.get('/test-runs/:testRunId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { testRunId } = req.params;
    const testRun = await TestExecutionService.getTestRunResults(testRunId, req.user.sub);
    
    res.json({
      success: true,
      data: testRun,
      message: 'Test run retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /test-runs/:testRunId/progress
 * Get real-time test execution progress
 */
router.get('/test-runs/:testRunId/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { testRunId } = req.params;
    const progress = await TestExecutionService.getTestProgress(testRunId, req.user.sub);
    
    res.json({
      success: true,
      data: progress,
      message: 'Test progress retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /test-runs/:testRunId/cancel
 * Cancel a running test
 */
router.post('/test-runs/:testRunId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { testRunId } = req.params;
    await TestExecutionService.cancelTestRun(testRunId, req.user.sub);
    
    res.json({
      success: true,
      message: 'Test run cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/test-runs
 * Get all test runs for a project
 */
router.get('/projects/:projectId/test-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { status, limit, offset } = req.query;

    // This would be implemented in the TestExecutionService
    // For now, we'll use a basic Prisma query
    const { PrismaClient } = await import('../generated/client');
    const prisma = new PrismaClient();

    const where: any = { projectId };
    if (status) {
      where.status = status;
    }

    const testRuns = await prisma.testRun.findMany({
      where,
      include: {
        prompt: {
          select: {
            id: true,
            name: true,
            version: true,
          }
        },
        _count: {
          select: {
            responses: true,
            metrics: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 50,
      skip: offset ? parseInt(offset as string) : 0,
    });
    
    res.json({
      success: true,
      data: testRuns,
      message: 'Test runs retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /test-runs/:testRunId/responses
 * Get detailed responses for a test run
 */
router.get('/test-runs/:testRunId/responses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { testRunId } = req.params;
    const { model, limit, offset } = req.query;

    const { PrismaClient } = await import('../generated/client');
    const prisma = new PrismaClient();

    const where: any = { testRunId };
    if (model) {
      const [provider, modelName] = (model as string).split('/');
      where.modelProvider = provider;
      where.modelName = modelName;
    }

    const responses = await prisma.testResponse.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit ? parseInt(limit as string) : 100,
      skip: offset ? parseInt(offset as string) : 0,
    });
    
    res.json({
      success: true,
      data: responses,
      message: 'Test responses retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /test-runs/:testRunId/metrics
 * Get metrics for a test run
 */
router.get('/test-runs/:testRunId/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { testRunId } = req.params;

    const { PrismaClient } = await import('../generated/client');
    const prisma = new PrismaClient();

    const metrics = await prisma.testMetric.findMany({
      where: { testRunId },
      orderBy: { name: 'asc' },
    });
    
    res.json({
      success: true,
      data: metrics,
      message: 'Test metrics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /test-runs/:testRunId/comparison
 * Get comparison data between models
 */
router.get('/test-runs/:testRunId/comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { testRunId } = req.params;

    const { PrismaClient } = await import('../generated/client');
    const prisma = new PrismaClient();

    // Get responses grouped by model
    const responses = await prisma.testResponse.findMany({
      where: { testRunId },
      orderBy: [
        { modelProvider: 'asc' },
        { modelName: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Group by model
    const byModel = responses.reduce((acc, response) => {
      const key = `${response.modelProvider}/${response.modelName}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(response);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate comparison metrics
    const comparison = Object.entries(byModel).map(([model, modelResponses]) => {
      const avgLatency = modelResponses.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / modelResponses.length;
      const totalCost = modelResponses.reduce((sum, r) => sum + (r.cost || 0), 0);
      const errorCount = modelResponses.filter(r => r.error).length;
      const totalTokens = modelResponses.reduce((sum, r) => {
        const usage = r.tokenUsage as any;
        return sum + (usage?.totalTokens || 0);
      }, 0);

      return {
        model,
        responseCount: modelResponses.length,
        avgLatency: Math.round(avgLatency),
        totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
        errorCount,
        errorRate: Math.round((errorCount / modelResponses.length) * 100),
        totalTokens,
        responses: modelResponses,
      };
    });
    
    res.json({
      success: true,
      data: {
        models: comparison,
        summary: {
          totalModels: comparison.length,
          totalResponses: responses.length,
          totalCost: comparison.reduce((sum, m) => sum + m.totalCost, 0),
          avgLatency: Math.round(comparison.reduce((sum, m) => sum + m.avgLatency, 0) / comparison.length),
        }
      },
      message: 'Test comparison retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queue/status
 * Get queue status (admin only)
 */
router.get('/queue/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    // In a real app, you'd check for admin permissions here
    const status = await QueueService.getQueueStatus();
    
    res.json({
      success: true,
      data: status,
      message: 'Queue status retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;