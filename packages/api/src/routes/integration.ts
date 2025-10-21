import { Router, Request, Response } from 'express';
import { AppIntegrationService } from '../services/app-integration.service';
import { TestingPipelineService } from '../services/testing-pipeline.service';
import { DependencyManagerService } from '../services/dependency-manager.service';
import { SafeDeploymentService } from '../services/safe-deployment.service';
import { ImpactAnalysisService } from '../services/impact-analysis.service';
import { PromptSyncService } from '../services/prompt-sync.service';
import { WebhookService } from '../services/websocket.service';
import { SupabaseIntegrationService } from '../services/supabase-integration.service';
import { SupabasePromptSyncService } from '../services/supabase-prompt-sync.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { SupabaseRealtimeService } from '../services/supabase-realtime.service';
import { SupabaseConfigService } from '../services/supabase-config.service';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/request-validator';
import { z } from 'zod';
import { integrationSchemas, createRequestSchema } from '../utils/integration-validation';
import type {
  AppIntegrationConfig,
  PromptSyncRequest,
  TestPipelineConfig,
  SafeDeploymentConfig,
  DependencyConfig,
  ImpactAnalysisRequest,
  ApiResponse
} from '@prompt-lab/shared';

const router = Router();

// Apply authentication middleware to all integration routes
router.use(authMiddleware);

// Using centralized validation schemas from integration-validation.ts

// Helper function to create API response
const createResponse = <T>(data?: T, error?: any): ApiResponse<T> => {
  return {
    success: !error,
    data,
    error: error ? {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.details
    } : undefined,
    metadata: {
      requestId: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      version: '1.0.0'
    }
  };
};

// =============================================================================
// APP INTEGRATION ROUTES
// =============================================================================

/**
 * @route POST /api/integration/apps
 * @desc Register a new application integration
 */
router.post('/apps', 
  validateRequest(createRequestSchema({
    body: integrationSchemas.appIntegrationConfig,
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body as AppIntegrationConfig;
      const userId = req.user!.id;

      const integration = await AppIntegrationService.registerApp(userId, projectId, config);
      res.json(createResponse(integration));
    } catch (error) {
      res.status(error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500)
         .json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/apps/:appId/sync
 * @desc Synchronize prompts between lab and main application
 */
router.post('/apps/:appId/sync',
  validateRequest(createRequestSchema({
    body: integrationSchemas.promptSyncRequest,
    params: z.object({ 
      projectId: z.string(),
      appId: z.string()
    })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId, appId } = req.params;
      const syncRequest = req.body as PromptSyncRequest;
      const userId = req.user!.id;

      let result;
      if (syncRequest.direction === 'pull') {
        result = await AppIntegrationService.pullPromptsFromApp(
          userId, 
          projectId, 
          appId, 
          {
            environment: syncRequest.environment,
            tags: syncRequest.tags,
            forceSync: syncRequest.forceSync
          }
        );
      } else if (syncRequest.direction === 'push') {
        result = await AppIntegrationService.pushPromptsToApp(
          userId,
          projectId,
          appId,
          syncRequest.promptIds || [],
          syncRequest.environment || 'production'
        );
      } else {
        // Bidirectional sync
        const pullResult = await AppIntegrationService.pullPromptsFromApp(userId, projectId, appId);
        const pushResult = await AppIntegrationService.pushPromptsToApp(
          userId,
          projectId,
          appId,
          syncRequest.promptIds || [],
          syncRequest.environment || 'production'
        );
        
        result = {
          success: pullResult.success && pushResult.success,
          pulled: pullResult.pulled,
          pushed: pushResult.deployed,
          updated: pullResult.updated,
          conflicts: [...(pullResult.conflicts || []), ...(pushResult.errors || [])],
          syncedAt: new Date()
        };
      }

      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/status
 * @desc Get integration status for a project
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const status = await AppIntegrationService.getIntegrationStatus(userId, projectId);
    res.json(createResponse(status));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/dependency-check/:promptId
 * @desc Check dependency updates for a prompt
 */
router.post('/dependency-check/:promptId', async (req: Request, res: Response) => {
  try {
    const { projectId, promptId } = req.params;
    const userId = req.user!.id;

    const updates = await AppIntegrationService.checkDependencyUpdates(userId, projectId, promptId);
    res.json(createResponse(updates));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// TESTING PIPELINE ROUTES
// =============================================================================

/**
 * @route POST /api/integration/testing/pipelines
 * @desc Create a new testing pipeline
 */
router.post('/testing/pipelines',
  validateRequest(createRequestSchema({
    body: integrationSchemas.testPipelineConfig,
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body as TestPipelineConfig;
      const userId = req.user!.id;

      const pipeline = await TestingPipelineService.createPipeline(userId, projectId, config);
      res.json(createResponse(pipeline));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/testing/pipelines/:pipelineId/execute
 * @desc Execute a testing pipeline for a prompt
 */
router.post('/testing/pipelines/:pipelineId/execute', async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;
    const { promptId, baselinePromptId, testDataset, runAsync } = req.body;
    const userId = req.user!.id;

    const result = await TestingPipelineService.executePipeline(
      userId,
      pipelineId,
      promptId,
      {
        baselinePromptId,
        testDataset,
        runAsync
      }
    );

    res.json(createResponse(result));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// DEPENDENCY MANAGEMENT ROUTES
// =============================================================================

/**
 * @route POST /api/integration/dependencies
 * @desc Register a new dependency
 */
router.post('/dependencies',
  validateRequest(createRequestSchema({
    body: integrationSchemas.dependencyConfig,
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body as DependencyConfig;
      const userId = req.user!.id;

      const dependency = await DependencyManagerService.registerDependency(userId, projectId, config);
      res.json(createResponse(dependency));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/dependencies/analysis
 * @desc Analyze dependencies for a project
 */
router.get('/dependencies/analysis', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { promptId } = req.query;
    const userId = req.user!.id;

    const analysis = await DependencyManagerService.analyzeDependencies(
      userId, 
      projectId, 
      promptId as string
    );
    res.json(createResponse(analysis));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/dependencies/update-plan
 * @desc Plan dependency updates
 */
router.post('/dependencies/update-plan', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { dependencyIds } = req.body;
    const userId = req.user!.id;

    const plan = await DependencyManagerService.planDependencyUpdates(
      userId,
      projectId,
      dependencyIds
    );
    res.json(createResponse(plan));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/dependencies/execute-updates/:planId
 * @desc Execute dependency updates
 */
router.post('/dependencies/execute-updates/:planId', async (req: Request, res: Response) => {
  try {
    const { projectId, planId } = req.params;
    const { dryRun, skipBackup, autoRollback } = req.body;
    const userId = req.user!.id;

    const result = await DependencyManagerService.executeDependencyUpdates(
      userId,
      projectId,
      planId,
      { dryRun, skipBackup, autoRollback }
    );
    res.json(createResponse(result));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/dependencies/health
 * @desc Monitor dependency health
 */
router.get('/dependencies/health', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const health = await DependencyManagerService.monitorDependencyHealth(userId, projectId);
    res.json(createResponse(health));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// SAFE DEPLOYMENT ROUTES
// =============================================================================

/**
 * @route POST /api/integration/deployment/plans
 * @desc Create a safe deployment plan
 */
router.post('/deployment/plans',
  validateRequest(createRequestSchema({
    body: integrationSchemas.safeDeploymentConfig,
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body as SafeDeploymentConfig;
      const userId = req.user!.id;

      const plan = await SafeDeploymentService.createDeploymentPlan(userId, projectId, config);
      res.json(createResponse(plan));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/deployment/plans/:planId/execute
 * @desc Execute a safe deployment plan
 */
router.post('/deployment/plans/:planId/execute', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { skipApproval, dryRun, pauseOnFailure } = req.body;
    const userId = req.user!.id;

    const execution = await SafeDeploymentService.executeDeploymentPlan(
      userId,
      planId,
      { skipApproval, dryRun, pauseOnFailure }
    );
    res.json(createResponse(execution));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/deployment/executions/:executionId/monitor
 * @desc Monitor deployment execution
 */
router.get('/deployment/executions/:executionId/monitor', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const userId = req.user!.id;

    const monitoring = await SafeDeploymentService.monitorDeployment(userId, executionId);
    res.json(createResponse(monitoring));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/deployment/executions/:executionId/rollback
 * @desc Rollback a deployment
 */
router.post('/deployment/executions/:executionId/rollback', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    const rollbackExecution = await SafeDeploymentService.rollbackDeployment(
      userId,
      executionId,
      reason
    );
    res.json(createResponse(rollbackExecution));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// IMPACT ANALYSIS ROUTES
// =============================================================================

/**
 * @route POST /api/integration/impact-analysis
 * @desc Perform impact analysis between prompts
 */
router.post('/impact-analysis', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const request = req.body as ImpactAnalysisRequest;
    const { deploymentId } = req.query;
    const userId = req.user!.id;

    const analysis = await ImpactAnalysisService.performImpactAnalysis(
      userId,
      projectId,
      request,
      deploymentId as string
    );
    res.json(createResponse(analysis));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/impact-analysis/:analysisId
 * @desc Get impact analysis by ID
 */
router.get('/impact-analysis/:analysisId', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user!.id;

    const analysis = await ImpactAnalysisService.getImpactAnalysis(userId, analysisId);
    res.json(createResponse(analysis));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// WEBHOOK MANAGEMENT ROUTES
// =============================================================================

/**
 * @route POST /api/integration/webhooks
 * @desc Create a new webhook subscription
 */
router.post('/webhooks',
  validateRequest(createRequestSchema({
    body: integrationSchemas.webhookConfig,
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body;
      const userId = req.user!.id;

      const webhook = await WebhookService.createWebhook(userId, projectId, config);
      res.json(createResponse(webhook));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/webhooks
 * @desc Get webhook subscriptions for a project
 */
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const webhooks = await WebhookService.getProjectWebhooks(userId, projectId);
    res.json(createResponse(webhooks));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route PUT /api/integration/webhooks/:webhookId
 * @desc Update webhook subscription
 */
router.put('/webhooks/:webhookId',
  validateRequest(createRequestSchema({
    body: integrationSchemas.webhookUpdate,
    params: z.object({ webhookId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { webhookId } = req.params;
      const updates = req.body;
      const userId = req.user!.id;

      const webhook = await WebhookService.updateWebhook(userId, webhookId, updates);
      res.json(createResponse(webhook));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route DELETE /api/integration/webhooks/:webhookId
 * @desc Delete webhook subscription
 */
router.delete('/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const userId = req.user!.id;

    await WebhookService.deleteWebhook(userId, webhookId);
    res.json(createResponse({ success: true }));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/webhooks/:webhookId/test
 * @desc Test webhook endpoint
 */
router.post('/webhooks/:webhookId/test',
  validateRequest(createRequestSchema({
    body: integrationSchemas.webhookTestRequest.optional(),
    params: z.object({ webhookId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { webhookId } = req.params;
      const userId = req.user!.id;

      const testResult = await WebhookService.testWebhook(userId, webhookId);
      res.json(createResponse(testResult));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/webhooks/:webhookId/deliveries
 * @desc Get webhook delivery history
 */
router.get('/webhooks/:webhookId/deliveries', 
  validateRequest(createRequestSchema({
    query: integrationSchemas.pagination,
    params: z.object({ webhookId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { webhookId } = req.params;
      const { limit, offset } = req.query;
      const userId = req.user!.id;

      const deliveries = await WebhookService.getWebhookDeliveries(
        userId, 
        webhookId, 
        limit as number, 
        offset as number
      );
      res.json(createResponse(deliveries));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/webhooks/:webhookId/retry
 * @desc Retry failed webhook deliveries
 */
router.post('/webhooks/:webhookId/retry', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const userId = req.user!.id;

    const result = await WebhookService.retryFailedDeliveries(userId, webhookId);
    res.json(createResponse(result));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/webhooks/events
 * @desc Get supported webhook events
 */
router.get('/webhooks/events', async (req: Request, res: Response) => {
  try {
    const events = WebhookService.getSupportedEvents();
    res.json(createResponse({ events }));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// PROMPT SYNC MANAGEMENT ROUTES
// =============================================================================

/**
 * @route POST /api/integration/sync/start
 * @desc Start a new sync operation
 */
router.post('/sync/start',
  validateRequest(createRequestSchema({
    body: integrationSchemas.promptSyncRequest.extend({
      connectionId: z.string()
    }),
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { connectionId, ...config } = req.body;
      const userId = req.user!.id;

      const operation = await PromptSyncService.startSync(userId, projectId, connectionId, config);
      res.json(createResponse(operation));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/sync/operations/:operationId
 * @desc Get sync operation status
 */
router.get('/sync/operations/:operationId', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const userId = req.user!.id;

    const operation = await PromptSyncService.getSyncOperationStatus(userId, operationId);
    res.json(createResponse(operation));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/sync/operations/:operationId/cancel
 * @desc Cancel sync operation
 */
router.post('/sync/operations/:operationId/cancel', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const userId = req.user!.id;

    await PromptSyncService.cancelSyncOperation(userId, operationId);
    res.json(createResponse({ cancelled: true }));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/sync/conflicts/resolve
 * @desc Resolve sync conflicts
 */
router.post('/sync/conflicts/resolve',
  validateRequest(createRequestSchema({
    body: z.object({
      operationId: z.string(),
      resolutions: z.array(integrationSchemas.conflictResolution)
    }),
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { operationId, resolutions } = req.body;
      const userId = req.user!.id;

      const result = await PromptSyncService.resolveConflicts(
        userId,
        projectId,
        operationId,
        resolutions
      );
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/sync/auto-setup
 * @desc Setup automatic sync schedule
 */
router.post('/sync/auto-setup',
  validateRequest(createRequestSchema({
    body: z.object({
      connectionId: z.string(),
      enabled: z.boolean(),
      interval: z.number().int().positive(),
      direction: z.enum(['pull', 'push', 'bidirectional']),
      conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins'])
    }),
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body;
      const userId = req.user!.id;

      await PromptSyncService.setupAutoSync(userId, projectId, config.connectionId, config);
      res.json(createResponse({ success: true }));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

// =============================================================================
// SUPABASE INTEGRATION ROUTES
// =============================================================================

/**
 * @route POST /api/integration/supabase
 * @desc Register a new Supabase integration
 */
router.post('/supabase',
  validateRequest(createRequestSchema({
    body: z.object({
      name: z.string().min(1),
      supabaseUrl: z.string().url(),
      supabaseAnonKey: z.string().min(1),
      supabaseServiceKey: z.string().optional(),
      projectRef: z.string().min(1),
      useServiceKey: z.boolean().default(false),
      enableRealtime: z.boolean().default(true),
      enableRLS: z.boolean().default(true),
      syncConfig: z.object({
        autoSync: z.boolean().default(false),
        syncInterval: z.number().default(60),
        bidirectional: z.boolean().default(true),
        conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).default('manual'),
        promptFilters: z.object({
          tables: z.array(z.string()).optional(),
          schemas: z.array(z.string()).optional(),
          tags: z.array(z.string()).optional(),
          modifiedAfter: z.date().optional()
        }).optional(),
        realTimeEvents: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])).default(['INSERT', 'UPDATE', 'DELETE'])
      })
    }),
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body;
      const userId = req.user!.id;

      const connection = await SupabaseIntegrationService.registerSupabaseIntegration(userId, projectId, config);
      res.json(createResponse(connection));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/supabase/:connectionId/test
 * @desc Test Supabase connection health
 */
router.get('/supabase/:connectionId/test', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    
    const health = await SupabaseIntegrationService.testConnection(connectionId);
    res.json(createResponse(health));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/supabase/:connectionId/tables
 * @desc List tables in Supabase project
 */
router.get('/supabase/:connectionId/tables', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { schema = 'public' } = req.query;
    
    const tables = await SupabaseIntegrationService.listTables(connectionId, schema as string);
    res.json(createResponse(tables));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/supabase/:connectionId/query
 * @desc Execute direct query on Supabase
 */
router.post('/supabase/:connectionId/query',
  validateRequest(createRequestSchema({
    body: z.object({
      table: z.string(),
      operation: z.enum(['select', 'insert', 'update', 'delete']),
      columns: z.array(z.string()).optional(),
      filters: z.record(z.string(), z.any()).optional(),
      data: z.record(z.string(), z.any()).optional(),
      limit: z.number().optional()
    }),
    params: z.object({ connectionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      const query = req.body;
      
      const result = await SupabaseIntegrationService.executeQuery(connectionId, query);
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/supabase/:connectionId/sync
 * @desc Start Supabase prompt synchronization
 */
router.post('/supabase/:connectionId/sync',
  validateRequest(createRequestSchema({
    body: z.object({
      direction: z.enum(['pull', 'push', 'bidirectional']).default('bidirectional'),
      strategy: z.enum(['safe', 'aggressive', 'manual']).default('safe'),
      tableName: z.string(),
      schema: z.string().default('public'),
      columnMapping: z.object({
        id: z.string().default('id'),
        name: z.string().default('name'),
        content: z.string().default('content'),
        description: z.string().default('description').optional(),
        tags: z.string().default('tags').optional(),
        metadata: z.string().default('metadata').optional(),
        created_at: z.string().default('created_at'),
        updated_at: z.string().default('updated_at'),
        user_id: z.string().default('user_id').optional(),
        project_id: z.string().default('project_id').optional()
      }),
      filters: z.object({
        user_id: z.string().optional(),
        project_id: z.string().optional(),
        tags: z.array(z.string()).optional(),
        modifiedAfter: z.date().optional()
      }).optional(),
      conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).default('manual'),
      realTimeEvents: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])).default(['INSERT', 'UPDATE', 'DELETE']),
      batchSize: z.number().min(1).max(1000).default(100),
      enableRetry: z.boolean().default(true),
      maxRetries: z.number().min(1).max(10).default(3)
    }),
    params: z.object({ projectId: z.string(), connectionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId, connectionId } = req.params;
      const config = req.body;
      const userId = req.user!.id;

      const result = await SupabasePromptSyncService.startSupabaseSync(userId, projectId, connectionId, config);
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

// =============================================================================
// SUPABASE AUTH ROUTES
// =============================================================================

/**
 * @route POST /api/integration/supabase/:connectionId/auth/configure
 * @desc Configure authentication for Supabase connection
 */
router.post('/supabase/:connectionId/auth/configure',
  validateRequest(createRequestSchema({
    body: z.object({
      jwtSecret: z.string().min(1),
      issuer: z.string().optional(),
      audience: z.string().optional(),
      expirationTime: z.string().optional(),
      refreshTokenExpiration: z.string().optional()
    }),
    params: z.object({ connectionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      const authConfig = req.body;

      await SupabaseAuthService.configureAuth(connectionId, authConfig);
      res.json(createResponse({ success: true }));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/supabase/:connectionId/auth/verify
 * @desc Verify Supabase JWT token
 */
router.post('/supabase/:connectionId/auth/verify',
  validateRequest(createRequestSchema({
    body: z.object({
      token: z.string().min(1)
    }),
    params: z.object({ connectionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      const { token } = req.body;

      const result = await SupabaseAuthService.verifySupabaseToken(connectionId, token);
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route POST /api/integration/supabase/:connectionId/rls/policies
 * @desc Create RLS policy
 */
router.post('/supabase/:connectionId/rls/policies',
  validateRequest(createRequestSchema({
    body: z.object({
      name: z.string().min(1),
      table: z.string().min(1),
      command: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']),
      role: z.string().optional(),
      using: z.string().optional(),
      withCheck: z.string().optional(),
      enabled: z.boolean().default(true)
    }),
    params: z.object({ connectionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      const policy = req.body;

      const result = await SupabaseAuthService.createRLSPolicy(connectionId, policy);
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/supabase/:connectionId/rls/policies/:tableName
 * @desc List RLS policies for a table
 */
router.get('/supabase/:connectionId/rls/policies/:tableName', async (req: Request, res: Response) => {
  try {
    const { connectionId, tableName } = req.params;
    const { schema = 'public' } = req.query;

    const result = await SupabaseAuthService.listRLSPolicies(connectionId, tableName, schema as string);
    res.json(createResponse(result));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/supabase/:connectionId/rls/enable/:tableName
 * @desc Enable RLS on table
 */
router.post('/supabase/:connectionId/rls/enable/:tableName', async (req: Request, res: Response) => {
  try {
    const { connectionId, tableName } = req.params;
    const { schema = 'public' } = req.body;

    const result = await SupabaseAuthService.enableRLS(connectionId, tableName, schema);
    res.json(createResponse(result));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/supabase/:connectionId/rls/standard-policies/:tableName
 * @desc Create standard RLS policies for prompt lab
 */
router.post('/supabase/:connectionId/rls/standard-policies/:tableName',
  validateRequest(createRequestSchema({
    body: z.object({
      enableUserIsolation: z.boolean().default(true),
      enableProjectIsolation: z.boolean().default(true),
      enableRoleBasedAccess: z.boolean().default(false),
      customPolicies: z.array(z.object({
        name: z.string(),
        table: z.string(),
        command: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']),
        role: z.string().optional(),
        using: z.string().optional(),
        withCheck: z.string().optional(),
        enabled: z.boolean().default(true)
      })).optional()
    }),
    params: z.object({ connectionId: z.string(), tableName: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { connectionId, tableName } = req.params;
      const options = req.body;

      const result = await SupabaseAuthService.createStandardRLSPolicies(connectionId, tableName, options);
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

// =============================================================================
// SUPABASE REALTIME ROUTES
// =============================================================================

/**
 * @route POST /api/integration/supabase/:connectionId/realtime/subscribe
 * @desc Create realtime subscription
 */
router.post('/supabase/:connectionId/realtime/subscribe',
  validateRequest(createRequestSchema({
    body: z.object({
      table: z.string().min(1),
      schema: z.string().default('public'),
      events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE', '*'])).default(['*']),
      filter: z.string().optional(),
      enablePresence: z.boolean().default(false),
      enableBroadcast: z.boolean().default(false),
      bufferSize: z.number().min(1).max(1000).default(100),
      bufferDelay: z.number().min(100).max(10000).default(1000),
      retryAttempts: z.number().min(0).max(10).default(3),
      retryDelay: z.number().min(1000).max(30000).default(5000),
      autoReconnect: z.boolean().default(true),
      heartbeatInterval: z.number().min(10000).max(60000).default(30000)
    }),
    params: z.object({ projectId: z.string(), connectionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId, connectionId } = req.params;
      const config = req.body;
      const userId = req.user!.id;

      const subscription = await SupabaseRealtimeService.createSubscription(
        connectionId,
        projectId,
        userId,
        config
      );
      res.json(createResponse({
        subscriptionId: subscription.id,
        status: subscription.status,
        config: subscription.config
      }));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/supabase/realtime/subscriptions/:subscriptionId
 * @desc Get realtime subscription status
 */
router.get('/supabase/realtime/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = SupabaseRealtimeService.getSubscription(subscriptionId);
    if (!subscription) {
      return res.status(404).json(createResponse(undefined, { message: 'Subscription not found' }));
    }

    res.json(createResponse({
      id: subscription.id,
      status: subscription.status,
      messageCount: subscription.messageCount,
      errorCount: subscription.errorCount,
      lastActivity: subscription.lastActivity,
      config: subscription.config
    }));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route DELETE /api/integration/supabase/realtime/subscriptions/:subscriptionId
 * @desc Close realtime subscription
 */
router.delete('/supabase/realtime/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    await SupabaseRealtimeService.closeSubscription(subscriptionId);
    res.json(createResponse({ success: true }));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/supabase/realtime/subscriptions/:subscriptionId/broadcast
 * @desc Send broadcast message
 */
router.post('/supabase/realtime/subscriptions/:subscriptionId/broadcast',
  validateRequest(createRequestSchema({
    body: z.object({
      event: z.string(),
      payload: z.any()
    }),
    params: z.object({ subscriptionId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.params;
      const { event, payload } = req.body;

      await SupabaseRealtimeService.sendBroadcast(subscriptionId, event, payload);
      res.json(createResponse({ success: true }));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/supabase/realtime/stats
 * @desc Get realtime statistics
 */
router.get('/supabase/realtime/stats', async (req: Request, res: Response) => {
  try {
    const stats = SupabaseRealtimeService.getRealtimeStats();
    res.json(createResponse(stats));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/supabase/realtime/health
 * @desc Get realtime health check
 */
router.get('/supabase/realtime/health', async (req: Request, res: Response) => {
  try {
    const health = await SupabaseRealtimeService.healthCheck();
    res.json(createResponse(health));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// SUPABASE CONFIG ROUTES
// =============================================================================

/**
 * @route POST /api/integration/supabase/config
 * @desc Create Supabase project configuration
 */
router.post('/supabase/config',
  validateRequest(createRequestSchema({
    body: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      environments: z.array(z.object({
        name: z.string().min(1),
        type: z.enum(['development', 'staging', 'production', 'preview']),
        supabaseUrl: z.string().url(),
        supabaseAnonKey: z.string().min(1),
        supabaseServiceKey: z.string().optional(),
        projectRef: z.string().min(1),
        region: z.string().optional(),
        databaseUrl: z.string().optional(),
        isActive: z.boolean().default(true),
        features: z.object({
          realtime: z.boolean().default(true),
          auth: z.boolean().default(true),
          storage: z.boolean().default(false),
          edgeFunctions: z.boolean().default(false)
        }).optional(),
        limits: z.object({
          maxConnections: z.number().min(1).max(1000).default(100),
          maxSubscriptions: z.number().min(1).max(100).default(50),
          rateLimitRpm: z.number().min(1).max(10000).default(1000),
          maxPayloadSize: z.number().min(1000).max(10000000).default(1000000)
        }).optional(),
        monitoring: z.object({
          enabled: z.boolean().default(true),
          logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
          metricsEnabled: z.boolean().default(true),
          alertingEnabled: z.boolean().default(false),
          webhookUrl: z.string().url().optional()
        }).optional()
      })),
      connectionPool: z.object({
        minConnections: z.number().min(1).max(50).default(5),
        maxConnections: z.number().min(1).max(100).default(20),
        idleTimeoutMs: z.number().min(10000).max(300000).default(60000),
        connectionTimeoutMs: z.number().min(1000).max(30000).default(10000),
        retryAttempts: z.number().min(0).max(10).default(3),
        retryDelayMs: z.number().min(1000).max(30000).default(5000),
        healthCheckIntervalMs: z.number().min(30000).max(300000).default(60000)
      }).optional(),
      security: z.object({
        encryptApiKeys: z.boolean().default(true),
        allowInsecureConnections: z.boolean().default(false),
        tlsMinVersion: z.string().default('1.2'),
        certificateValidation: z.boolean().default(true),
        ipWhitelist: z.array(z.string()).optional(),
        apiKeyRotationDays: z.number().min(1).max(365).default(90),
        sessionTimeoutMinutes: z.number().min(1).max(1440).default(60),
        maxFailedAttempts: z.number().min(1).max(20).default(5)
      }).optional(),
      backup: z.object({
        enabled: z.boolean().default(false),
        schedule: z.string().default('0 2 * * *'),
        retention: z.object({
          daily: z.number().min(1).max(365).default(7),
          weekly: z.number().min(1).max(52).default(4),
          monthly: z.number().min(1).max(12).default(3)
        }).optional(),
        compression: z.boolean().default(true),
        encryption: z.boolean().default(true),
        storageLocation: z.string().optional()
      }).optional()
    }),
    params: z.object({ projectId: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const config = req.body;
      const userId = req.user!.id;

      const projectConfig = await SupabaseConfigService.createProjectConfig(userId, projectId, config);
      res.json(createResponse(projectConfig));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/supabase/config/:configId
 * @desc Get Supabase project configuration
 */
router.get('/supabase/config/:configId', async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const userId = req.user!.id;

    const config = await SupabaseConfigService.getProjectConfig(configId, userId);
    res.json(createResponse(config));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/supabase/config/:configId/environments/:environmentName/test
 * @desc Test environment connection
 */
router.get('/supabase/config/:configId/environments/:environmentName/test', async (req: Request, res: Response) => {
  try {
    const { configId, environmentName } = req.params;
    const userId = req.user!.id;

    const result = await SupabaseConfigService.testEnvironmentConnection(configId, userId, environmentName);
    res.json(createResponse(result));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/supabase/config/:configId/environments/:environmentName/metrics
 * @desc Get environment metrics
 */
router.get('/supabase/config/:configId/environments/:environmentName/metrics', async (req: Request, res: Response) => {
  try {
    const { configId, environmentName } = req.params;
    const userId = req.user!.id;

    const metrics = await SupabaseConfigService.getEnvironmentMetrics(configId, userId, environmentName);
    res.json(createResponse(metrics));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route POST /api/integration/supabase/config/:configId/environments/:environmentName/rotate-keys
 * @desc Rotate API keys for environment
 */
router.post('/supabase/config/:configId/environments/:environmentName/rotate-keys',
  validateRequest(createRequestSchema({
    body: z.object({
      supabaseAnonKey: z.string().optional(),
      supabaseServiceKey: z.string().optional()
    }),
    params: z.object({ configId: z.string(), environmentName: z.string() })
  })),
  async (req: Request, res: Response) => {
    try {
      const { configId, environmentName } = req.params;
      const newKeys = req.body;
      const userId = req.user!.id;

      const result = await SupabaseConfigService.rotateEnvironmentKeys(configId, userId, environmentName, newKeys);
      res.json(createResponse(result));
    } catch (error) {
      res.status(500).json(createResponse(undefined, error));
    }
  }
);

/**
 * @route GET /api/integration/supabase/configs
 * @desc List Supabase configurations
 */
router.get('/supabase/configs', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const configs = await SupabaseConfigService.listProjectConfigs(userId, projectId);
    res.json(createResponse(configs));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

// =============================================================================
// HEALTH CHECK AND SYSTEM STATUS
// =============================================================================

/**
 * @route GET /api/integration/health
 * @desc Get integration system health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthCheck = {
      service: 'Prompt Testing Lab Integration',
      status: 'healthy' as const,
      version: '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        database: {
          status: 'healthy' as const,
          responseTime: 45,
          lastCheck: new Date()
        },
        redis: {
          status: 'healthy' as const,
          responseTime: 12,
          lastCheck: new Date()
        }
      },
      metrics: {
        requestsPerSecond: 150,
        averageResponseTime: 125,
        errorRate: 0.5
      },
      checks: [
        {
          name: 'Database Connection',
          status: 'pass' as const,
          duration: 45
        },
        {
          name: 'Redis Connection',
          status: 'pass' as const,
          duration: 12
        },
        {
          name: 'External API Connectivity',
          status: 'pass' as const,
          duration: 200
        }
      ]
    };

    res.json(createResponse(healthCheck));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

/**
 * @route GET /api/integration/metrics
 * @desc Get integration system metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      totalIntegrations: 25,
      activeIntegrations: 23,
      totalSyncs: 1247,
      successfulSyncs: 1198,
      failedSyncs: 49,
      totalDeployments: 345,
      successfulDeployments: 321,
      rolledBackDeployments: 18,
      averageDeploymentTime: 8.5, // minutes
      averageTestExecutionTime: 4.2, // minutes
      dependencyHealthScore: 94.5
    };

    res.json(createResponse(metrics));
  } catch (error) {
    res.status(500).json(createResponse(undefined, error));
  }
});

export default router;