import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock all external dependencies first
jest.mock('../../generated/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    project: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    projectMember: {
      findFirst: jest.fn()
    },
    appIntegration: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    prompt: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn()
    },
    syncOperation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    testPipeline: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    pipelineExecution: {
      create: jest.fn()
    },
    webhookSubscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    webhookDelivery: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    deploymentPlan: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    deploymentExecution: {
      create: jest.fn()
    },
    dependency: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    queueJob: {
      create: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn()
    },
    $connect: jest.fn(),
    $disconnect: jest.fn()
  }))
}));

import { PrismaClient } from '../../generated/client';
import { AppIntegrationService } from '../app-integration.service';
import { PromptSyncService } from '../prompt-sync.service';
import { TestingPipelineService } from '../testing-pipeline.service';
import { SafeDeploymentService } from '../safe-deployment.service';
import { WebhookService } from '../webhook.service';
import { DependencyManagerService } from '../dependency-manager.service';
import { QueueService } from '../queue.service';

const mockPrisma = new PrismaClient() as any;

// Mock external dependencies
jest.mock('node:crypto', () => ({
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-signature')
  }))
}));

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('Integration Services', () => {
  const mockUserId = 'user_test_id';
  const mockProjectId = 'project_test_id';
  const mockAppId = 'app_test_id';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock basic Prisma responses
    mockPrisma.project.findUnique.mockResolvedValue({
      id: mockProjectId,
      name: 'Test Project',
      ownerId: mockUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    mockPrisma.projectMember.findFirst.mockResolvedValue({
      id: 'member_id',
      role: 'OWNER',
      userId: mockUserId,
      projectId: mockProjectId
    } as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('AppIntegrationService', () => {
    const mockIntegrationConfig = {
      name: 'Test Integration',
      type: 'langsmith' as const,
      baseUrl: 'https://api.langsmith.com',
      apiKey: 'test-api-key',
      syncConfig: {
        autoSync: true,
        syncInterval: 60,
        bidirectional: true
      }
    };

    it('should register a new app integration', async () => {
      // Mock validation call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] })
      });

      mockPrisma.appIntegration.create.mockResolvedValue({
        id: mockAppId,
        name: mockIntegrationConfig.name,
        type: mockIntegrationConfig.type,
        baseUrl: mockIntegrationConfig.baseUrl,
        apiKeyHash: 'hashed-key',
        syncConfig: mockIntegrationConfig.syncConfig,
        isActive: true,
        projectId: mockProjectId,
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      const result = await AppIntegrationService.registerApp(
        mockUserId,
        mockProjectId,
        mockIntegrationConfig
      );

      expect(result).toMatchObject({
        id: mockAppId,
        name: mockIntegrationConfig.name,
        type: mockIntegrationConfig.type,
        baseUrl: mockIntegrationConfig.baseUrl,
        isActive: true
      });

      expect(mockPrisma.appIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: mockProjectId,
          name: mockIntegrationConfig.name,
          type: mockIntegrationConfig.type,
          createdBy: mockUserId
        })
      });
    });

    it('should pull prompts from app', async () => {
      const mockRemotePrompts = [
        {
          id: 'remote_prompt_1',
          name: 'Test Prompt',
          content: 'This is a test prompt',
          description: 'Test description',
          tags: ['test'],
          lastModified: new Date().toISOString()
        }
      ];

      // Mock app connection
      mockPrisma.appIntegration.findUnique.mockResolvedValue({
        id: mockAppId,
        type: 'langsmith',
        baseUrl: 'https://api.langsmith.com',
        apiKey: 'test-key',
        projectId: mockProjectId
      } as any);

      // Mock API call to fetch prompts
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRemotePrompts
      });

      // Mock prompt creation
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      mockPrisma.prompt.create.mockResolvedValue({
        id: 'local_prompt_1',
        name: 'Test Prompt',
        content: 'This is a test prompt'
      } as any);

      mockPrisma.appIntegration.update.mockResolvedValue({} as any);

      const result = await AppIntegrationService.pullPromptsFromApp(
        mockUserId,
        mockProjectId,
        mockAppId,
        { forceSync: true }
      );

      expect(result.success).toBe(true);
      expect(result.pulled).toBe(1);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle sync conflicts', async () => {
      const mockExistingPrompt = {
        id: 'existing_prompt',
        content: 'Local content',
        updatedAt: new Date()
      };

      const mockRemotePrompt = {
        id: 'remote_prompt_1',
        name: 'Test Prompt',
        content: 'Remote content',  // Different content
        lastModified: new Date().toISOString()
      };

      mockPrisma.appIntegration.findUnique.mockResolvedValue({
        id: mockAppId,
        type: 'langsmith',
        baseUrl: 'https://api.langsmith.com',
        projectId: mockProjectId
      } as any);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockRemotePrompt]
      });

      mockPrisma.prompt.findFirst.mockResolvedValue(mockExistingPrompt as any);

      const result = await AppIntegrationService.pullPromptsFromApp(
        mockUserId,
        mockProjectId,
        mockAppId
      );

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toMatchObject({
        promptId: expect.any(String),
        reason: expect.stringContaining('conflict')
      });
    });
  });

  describe('PromptSyncService', () => {
    const mockSyncConfig = {
      direction: 'bidirectional' as const,
      strategy: 'safe' as const,
      conflictResolution: 'manual' as const
    };

    it('should start a sync operation', async () => {
      mockPrisma.syncOperation.create.mockResolvedValue({
        id: 'sync_op_1',
        direction: 'bidirectional',
        strategy: 'safe',
        status: 'pending',
        progress: { total: 0, processed: 0, successful: 0, failed: 0, skipped: 0 },
        projectId: mockProjectId,
        connectionId: mockAppId,
        initiatedBy: mockUserId
      } as any);

      // Mock queue service
      jest.spyOn(QueueService, 'addJob').mockResolvedValue({} as any);

      const result = await PromptSyncService.startSync(
        mockUserId,
        mockProjectId,
        mockAppId,
        mockSyncConfig
      );

      expect(result.status).toBe('pending');
      expect(result.direction).toBe('bidirectional');
      expect(QueueService.addJob).toHaveBeenCalledWith({
        type: 'prompt_sync',
        data: expect.objectContaining({
          connectionId: mockAppId,
          projectId: mockProjectId,
          userId: mockUserId
        }),
        priority: 1
      });
    });

    it('should get sync operation status', async () => {
      const mockOperation = {
        id: 'sync_op_1',
        direction: 'pull',
        strategy: 'safe',
        status: 'completed',
        progress: { total: 5, processed: 5, successful: 4, failed: 1, skipped: 0 },
        result: { success: true, pulled: 4, conflicts: [] },
        projectId: mockProjectId
      };

      mockPrisma.syncOperation.findUnique.mockResolvedValue(mockOperation as any);

      const result = await PromptSyncService.getSyncOperationStatus(
        mockUserId,
        'sync_op_1'
      );

      expect(result.status).toBe('completed');
      expect(result.progress.successful).toBe(4);
      expect(result.result?.pulled).toBe(4);
    });

    it('should cancel sync operation', async () => {
      mockPrisma.syncOperation.findUnique.mockResolvedValue({
        id: 'sync_op_1',
        status: 'running',
        projectId: mockProjectId
      } as any);

      mockPrisma.syncOperation.update.mockResolvedValue({} as any);
      jest.spyOn(QueueService, 'cancelJob').mockResolvedValue(1);

      await expect(
        PromptSyncService.cancelSyncOperation(mockUserId, 'sync_op_1')
      ).resolves.not.toThrow();

      expect(QueueService.cancelJob).toHaveBeenCalledWith('prompt_sync', {
        operationId: 'sync_op_1'
      });
    });
  });

  describe('TestingPipelineService', () => {
    const mockPipelineConfig = {
      name: 'Test Pipeline',
      description: 'Testing pipeline',
      stages: [
        {
          id: 'validation_stage',
          name: 'Validation',
          description: 'Validate prompt structure',
          type: 'validation' as const,
          config: {
            models: [{
              provider: 'openai' as const,
              modelName: 'gpt-4',
              temperature: 0.7,
              maxTokens: 1000
            }],
            evaluators: [],
            successCriteria: [],
            parallelExecution: false,
            timeout: 300
          },
          order: 1,
          isRequired: true
        }
      ]
    };

    it('should create a testing pipeline', async () => {
      mockPrisma.testPipeline.create.mockResolvedValue({
        id: 'pipeline_1',
        name: mockPipelineConfig.name,
        config: mockPipelineConfig,
        status: 'DRAFT',
        stages: mockPipelineConfig.stages,
        projectId: mockProjectId,
        createdBy: mockUserId
      } as any);

      const result = await TestingPipelineService.createPipeline(
        mockUserId,
        mockProjectId,
        mockPipelineConfig
      );

      expect(result.name).toBe(mockPipelineConfig.name);
      expect(result.stages).toHaveLength(1);
      expect(mockPrisma.testPipeline.create).toHaveBeenCalled();
    });

    it('should execute pipeline asynchronously', async () => {
      const mockPipeline = {
        id: 'pipeline_1',
        stages: mockPipelineConfig.stages,
        projectId: mockProjectId
      };

      const mockPrompt = {
        id: 'prompt_1',
        name: 'Test Prompt',
        content: 'Test content'
      };

      mockPrisma.testPipeline.findUnique.mockResolvedValue(mockPipeline as any);
      mockPrisma.prompt.findUnique.mockResolvedValue(mockPrompt as any);
      mockPrisma.pipelineExecution.create.mockResolvedValue({
        id: 'execution_1',
        status: 'RUNNING'
      } as any);

      jest.spyOn(QueueService, 'addJob').mockResolvedValue({} as any);

      const result = await TestingPipelineService.executePipeline(
        mockUserId,
        'pipeline_1',
        'prompt_1',
        { runAsync: true }
      );

      expect(result.status).toBe('RUNNING');
      expect(QueueService.addJob).toHaveBeenCalledWith({
        type: 'pipeline_execution',
        data: expect.objectContaining({
          pipelineId: 'pipeline_1',
          promptId: 'prompt_1'
        }),
        priority: 1
      });
    });
  });

  describe('WebhookService', () => {
    const mockWebhookConfig = {
      url: 'https://example.com/webhook',
      events: ['prompt.created', 'prompt.updated'],
      headers: { 'Authorization': 'Bearer test-token' },
      secret: 'webhook-secret',
      enabled: true,
      retryAttempts: 3
    };

    it('should create a webhook subscription', async () => {
      // Mock webhook endpoint test
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      mockPrisma.webhookSubscription.create.mockResolvedValue({
        id: 'webhook_1',
        url: mockWebhookConfig.url,
        events: mockWebhookConfig.events,
        headers: mockWebhookConfig.headers,
        secret: mockWebhookConfig.secret,
        enabled: true,
        retryAttempts: 3,
        projectId: mockProjectId,
        createdBy: mockUserId,
        createdAt: new Date()
      } as any);

      const result = await WebhookService.createWebhook(
        mockUserId,
        mockProjectId,
        mockWebhookConfig
      );

      expect(result.url).toBe(mockWebhookConfig.url);
      expect(result.events).toEqual(mockWebhookConfig.events);
      expect(result.enabled).toBe(true);
    });

    it('should trigger webhook events', async () => {
      const mockEvent = {
        type: 'prompt.created',
        data: { promptId: 'prompt_1', name: 'New Prompt' },
        projectId: mockProjectId,
        timestamp: new Date()
      };

      mockPrisma.webhookSubscription.findMany.mockResolvedValue([
        {
          id: 'webhook_1',
          url: 'https://example.com/webhook',
          events: ['prompt.created'],
          headers: {},
          retryAttempts: 3
        }
      ] as any);

      mockPrisma.webhookDelivery.create.mockResolvedValue({
        id: 'delivery_1'
      } as any);

      jest.spyOn(QueueService, 'addJob').mockResolvedValue({} as any);

      await WebhookService.triggerEvent(mockEvent);

      expect(QueueService.addJob).toHaveBeenCalledWith({
        type: 'webhook_retry',
        data: expect.objectContaining({
          webhookId: 'delivery_1',
          url: 'https://example.com/webhook'
        }),
        retryAttempts: 3,
        timeout: 30000
      });
    });

    it('should test webhook endpoint', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue({
        id: 'webhook_1',
        url: 'https://example.com/webhook',
        headers: {},
        projectId: mockProjectId
      } as any);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'OK'
      });

      const result = await WebhookService.testWebhook(mockUserId, 'webhook_1');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.response).toBe('OK');
      expect(result.latency).toBeGreaterThan(0);
    });
  });

  describe('SafeDeploymentService', () => {
    const mockDeploymentConfig = {
      promptId: 'prompt_1',
      targetEnvironments: ['staging', 'production'],
      strategy: 'canary' as const,
      requireApproval: false,
      requireTestingPass: true,
      preDeploymentTests: ['pipeline_1'],
      monitoringDuration: 30,
      errorRateThreshold: 5,
      automaticRollback: true
    };

    it('should create a deployment plan', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue({
        id: 'prompt_1',
        name: 'Test Prompt',
        projectId: mockProjectId
      } as any);

      mockPrisma.deploymentPlan.create.mockResolvedValue({
        id: 'plan_1',
        promptId: 'prompt_1',
        planData: mockDeploymentConfig,
        status: 'DRAFT',
        projectId: mockProjectId,
        createdBy: mockUserId
      } as any);

      const result = await SafeDeploymentService.createDeploymentPlan(
        mockUserId,
        mockProjectId,
        mockDeploymentConfig
      );

      expect(result.promptId).toBe('prompt_1');
      expect(result.strategy).toBe('canary');
      expect(result.stages).toBeDefined();
    });

    it('should execute deployment plan', async () => {
      const mockPlan = {
        id: 'plan_1',
        planData: {
          ...mockDeploymentConfig,
          stages: [
            {
              id: 'pre_deployment_testing',
              name: 'Pre-deployment Testing',
              type: 'testing',
              order: 1
            }
          ]
        },
        approvals: { required: false }
      };

      mockPrisma.deploymentPlan.findUnique.mockResolvedValue(mockPlan as any);
      mockPrisma.deploymentExecution.create.mockResolvedValue({
        id: 'execution_1',
        status: 'PENDING'
      } as any);

      const result = await SafeDeploymentService.executeDeploymentPlan(
        mockUserId,
        'plan_1',
        { dryRun: true }
      );

      expect(result.status).toBe('PENDING');
      expect(result.id).toBe('execution_1');
    });
  });

  describe('DependencyManagerService', () => {
    const mockDependencyConfig = {
      name: 'OpenAI API',
      type: 'model_provider' as const,
      provider: 'openai',
      apiKey: 'sk-test-key',
      baseUrl: 'https://api.openai.com/v1',
      timeout: 10000,
      retryAttempts: 3
    };

    it('should register a dependency', async () => {
      // Mock health check
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      mockPrisma.dependency.create.mockResolvedValue({
        id: 'dep_1',
        name: mockDependencyConfig.name,
        type: mockDependencyConfig.type,
        provider: mockDependencyConfig.provider,
        status: 'ACTIVE',
        healthScore: 100,
        projectId: mockProjectId,
        createdBy: mockUserId
      } as any);

      const result = await DependencyManagerService.registerDependency(
        mockUserId,
        mockProjectId,
        mockDependencyConfig
      );

      expect(result.name).toBe(mockDependencyConfig.name);
      expect(result.status).toBe('ACTIVE');
      expect(result.healthScore).toBe(100);
    });

    it('should analyze dependencies', async () => {
      mockPrisma.dependency.findMany.mockResolvedValue([
        {
          id: 'dep_1',
          name: 'OpenAI API',
          type: 'model_provider',
          status: 'ACTIVE',
          version: '1.0.0',
          config: mockDependencyConfig
        }
      ] as any);

      // Mock health check
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
        headers: { get: () => '1.0.0' }
      });

      const result = await DependencyManagerService.analyzeDependencies(
        mockUserId,
        mockProjectId
      );

      expect(result.totalDependencies).toBe(1);
      expect(result.healthyDependencies).toBe(1);
      expect(result.criticalIssues).toHaveLength(0);
    });

    it('should monitor dependency health', async () => {
      mockPrisma.dependency.findMany.mockResolvedValue([
        {
          id: 'dep_1',
          name: 'OpenAI API',
          config: mockDependencyConfig
        }
      ] as any);

      // Mock successful health check
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      mockPrisma.dependency.update.mockResolvedValue({} as any);

      const result = await DependencyManagerService.monitorDependencyHealth(
        mockUserId,
        mockProjectId
      );

      expect(result.overallHealth).toBeGreaterThan(0);
      expect(result.dependencies).toHaveLength(1);
    });
  });

  describe('QueueService', () => {
    beforeEach(() => {
      // Reset queue state
      QueueService.stop();
    });

    it('should add job to queue', async () => {
      const jobConfig = {
        type: 'test_job',
        data: { testData: 'value' },
        priority: 1,
        timeout: 30000
      };

      mockPrisma.queueJob.create.mockResolvedValue({
        id: 'job_1',
        type: jobConfig.type,
        data: jobConfig.data,
        priority: jobConfig.priority,
        status: 'pending'
      } as any);

      const result = await QueueService.addJob(jobConfig);

      expect(result.type).toBe(jobConfig.type);
      expect(result.status).toBe('pending');
      expect(mockPrisma.queueJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: jobConfig.type,
          data: jobConfig.data,
          priority: jobConfig.priority
        })
      });
    });

    it('should get queue status', async () => {
      mockPrisma.queueJob.count
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(2)  // active
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(1); // failed

      const status = await QueueService.getQueueStatus();

      expect(status.pending).toBe(5);
      expect(status.active).toBe(2);
      expect(status.completed).toBe(10);
      expect(status.failed).toBe(1);
      expect(status.total).toBe(18);
    });

    it('should cancel jobs by type', async () => {
      mockPrisma.queueJob.updateMany.mockResolvedValue({ count: 3 });

      const result = await QueueService.cancelJob('test_job', { testData: 'value' });

      expect(result).toBe(3);
      expect(mockPrisma.queueJob.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          type: 'test_job',
          status: { in: ['pending', 'active'] }
        }),
        data: {
          status: 'cancelled',
          error: 'Cancelled by user request'
        }
      });
    });
  });
});

describe('Integration API Validation', () => {
  it('should validate app integration config', () => {
    const { integrationSchemas } = require('../../utils/integration-validation');
    
    const validConfig = {
      name: 'Test Integration',
      type: 'langsmith',
      baseUrl: 'https://api.langsmith.com',
      apiKey: 'test-key',
      syncConfig: {
        autoSync: true,
        syncInterval: 60,
        bidirectional: true
      }
    };

    const result = integrationSchemas.appIntegrationConfig.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid webhook config', () => {
    const { integrationSchemas } = require('../../utils/integration-validation');
    
    const invalidConfig = {
      url: 'not-a-url',
      events: [], // Empty events array should be invalid
      retryAttempts: 15 // Too many retry attempts
    };

    const result = integrationSchemas.webhookConfig.safeParse(invalidConfig);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message);
      expect(errors).toContain('Invalid URL format');
      expect(errors).toContain('At least one event is required');
    }
  });

  it('should validate deployment config with canary strategy', () => {
    const { integrationSchemas } = require('../../utils/integration-validation');
    
    const validConfig = {
      promptId: 'c123456789012345678901234',
      targetEnvironments: ['staging', 'production'],
      strategy: 'canary',
      strategyConfig: {
        initialTrafficPercentage: 5,
        trafficSteps: [10, 25, 50, 100],
        monitoringDuration: 15
      },
      requireTestingPass: true,
      monitoringDuration: 30
    };

    const result = integrationSchemas.safeDeploymentConfig.safeParse(validConfig);
    expect(result.success).toBe(true);
  });
});