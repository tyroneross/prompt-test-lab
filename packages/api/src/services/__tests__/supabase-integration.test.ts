import { beforeEach, afterEach, describe, it, expect, jest } from '@jest/globals';
import { SupabaseIntegrationService } from '../supabase-integration.service';
import { SupabasePromptSyncService } from '../supabase-prompt-sync.service';
import { SupabaseAuthService } from '../supabase-auth.service';
import { SupabaseRealtimeService } from '../supabase-realtime.service';
import { SupabaseConfigService } from '../supabase-config.service';
import { ValidationError, AuthorizationError, NotFoundError } from '@prompt-lab/shared';

// Mock dependencies
jest.mock('../project.service');
jest.mock('../prompt.service');
jest.mock('../queue.service');
jest.mock('../websocket.service');
jest.mock('../generated/client');
jest.mock('@supabase/supabase-js');

// Mock the Prisma client
const mockPrisma = {
  appIntegration: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  syncOperation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  },
  prompt: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn()
  }
};

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    update: jest.fn(() => Promise.resolve({ data: [], error: null })),
    delete: jest.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: jest.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  channel: jest.fn(() => ({
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    track: jest.fn(),
    send: jest.fn()
  })),
  removeChannel: jest.fn(),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null }))
  },
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null }))
};

const mockCreateClient = jest.fn(() => mockSupabaseClient);

// Mock project service
const mockProjectService = {
  getUserProjectRole: jest.fn(() => Promise.resolve('OWNER')),
  getProjectById: jest.fn(() => Promise.resolve({ id: 'project123', name: 'Test Project' }))
};

// Mock prompt service
const mockPromptService = {
  createPrompt: jest.fn(() => Promise.resolve({ id: 'prompt123', name: 'Test Prompt' })),
  updatePrompt: jest.fn(() => Promise.resolve({})),
  getPromptById: jest.fn(() => Promise.resolve({ id: 'prompt123', name: 'Test Prompt', content: 'test content' }))
};

// Mock queue service
const mockQueueService = {
  addJob: jest.fn(() => Promise.resolve({})),
  addRecurringJob: jest.fn(() => Promise.resolve({})),
  cancelJob: jest.fn(() => Promise.resolve({})),
  cancelRecurringJob: jest.fn(() => Promise.resolve({}))
};

// Mock WebSocket service
const mockWebsocketService = {
  broadcastToProject: jest.fn(() => Promise.resolve({}))
};

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock Supabase
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: mockCreateClient
  }));
  
  // Mock services
  jest.doMock('../project.service', () => ({ ProjectService: mockProjectService }));
  jest.doMock('../prompt.service', () => ({ PromptService: mockPromptService }));
  jest.doMock('../queue.service', () => ({ QueueService: mockQueueService }));
  jest.doMock('../websocket.service', () => ({ WebsocketService: mockWebsocketService }));
  
  // Mock Prisma
  jest.doMock('../generated/client', () => ({
    PrismaClient: jest.fn(() => mockPrisma)
  }));
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('SupabaseIntegrationService', () => {
  const validConfig = {
    name: 'Test Integration',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'anon-key-123',
    supabaseServiceKey: 'service-key-123',
    projectRef: 'test-ref',
    useServiceKey: false,
    enableRealtime: true,
    enableRLS: true,
    syncConfig: {
      autoSync: false,
      syncInterval: 60,
      bidirectional: true,
      conflictResolution: 'manual' as const,
      promptFilters: {},
      realTimeEvents: ['INSERT', 'UPDATE', 'DELETE'] as const
    }
  };

  describe('registerSupabaseIntegration', () => {
    it('should register a new Supabase integration successfully', async () => {
      mockPrisma.appIntegration.create.mockResolvedValue({
        id: 'integration123',
        name: validConfig.name,
        type: 'supabase',
        baseUrl: validConfig.supabaseUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await SupabaseIntegrationService.registerSupabaseIntegration(
        'user123',
        'project123',
        validConfig
      );

      expect(result).toMatchObject({
        id: 'integration123',
        name: validConfig.name,
        supabaseUrl: validConfig.supabaseUrl,
        isActive: true
      });

      expect(mockPrisma.appIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project123',
          name: validConfig.name,
          type: 'supabase',
          baseUrl: validConfig.supabaseUrl,
          isActive: true,
          createdBy: 'user123'
        })
      });
    });

    it('should throw AuthorizationError for insufficient permissions', async () => {
      mockProjectService.getUserProjectRole.mockResolvedValue('VIEWER');

      await expect(
        SupabaseIntegrationService.registerSupabaseIntegration('user123', 'project123', validConfig)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should validate Supabase connection before registration', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: { code: 'PGRST116' } }))
        }))
      });

      mockPrisma.appIntegration.create.mockResolvedValue({
        id: 'integration123',
        name: validConfig.name,
        type: 'supabase'
      });

      const result = await SupabaseIntegrationService.registerSupabaseIntegration(
        'user123',
        'project123',
        validConfig
      );

      expect(result).toBeDefined();
      expect(mockCreateClient).toHaveBeenCalledWith(
        validConfig.supabaseUrl,
        validConfig.supabaseAnonKey,
        expect.any(Object)
      );
    });
  });

  describe('testConnection', () => {
    it('should return healthy status for successful connection', async () => {
      // Mock cached connection
      const mockConnection = {
        client: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: { code: 'PGRST116' } }))
        }))
      });

      const result = await SupabaseIntegrationService.testConnection('connection123');

      expect(result).toMatchObject({
        healthy: true,
        latency: expect.any(Number)
      });
    });

    it('should return unhealthy status for connection error', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'Connection failed', code: 'CONNECTION_ERROR' } 
          }))
        }))
      });

      const result = await SupabaseIntegrationService.testConnection('connection123');

      expect(result).toMatchObject({
        healthy: false,
        error: 'Connection failed'
      });
    });
  });

  describe('listTables', () => {
    it('should list tables with columns successfully', async () => {
      const mockConnection = {
        authClient: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      // Mock tables query
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'information_schema.tables') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({
                  data: [{ table_name: 'prompts' }],
                  error: null
                }))
              }))
            }))
          };
        }
        if (table === 'information_schema.columns') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({
                  data: [
                    { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
                    { column_name: 'name', data_type: 'text', is_nullable: 'YES' }
                  ],
                  error: null
                }))
              }))
            }))
          };
        }
        return mockSupabaseClient.from();
      });

      const result = await SupabaseIntegrationService.listTables('connection123');

      expect(result).toEqual([{
        name: 'prompts',
        schema: 'public',
        columns: [
          { name: 'id', type: 'uuid', nullable: false },
          { name: 'name', type: 'text', nullable: true }
        ]
      }]);
    });

    it('should throw ValidationError when service key is not provided', async () => {
      const mockConnection = {
        authClient: null,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      await expect(
        SupabaseIntegrationService.listTables('connection123')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('executeQuery', () => {
    it('should execute SELECT query successfully', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({
              data: [{ id: '1', name: 'Test Prompt' }],
              error: null,
              count: 1
            }))
          }))
        }))
      });

      const query = {
        table: 'prompts',
        operation: 'select' as const,
        columns: ['id', 'name'],
        filters: { user_id: 'user123' },
        limit: 10
      };

      const result = await SupabaseIntegrationService.executeQuery('connection123', query);

      expect(result).toEqual({
        data: [{ id: '1', name: 'Test Prompt' }],
        count: 1
      });
    });

    it('should execute INSERT query successfully', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn(() => Promise.resolve({
          data: [{ id: '1', name: 'New Prompt' }],
          error: null
        }))
      });

      const query = {
        table: 'prompts',
        operation: 'insert' as const,
        data: { name: 'New Prompt', content: 'Test content' }
      };

      const result = await SupabaseIntegrationService.executeQuery('connection123', query);

      expect(result).toEqual({
        data: [{ id: '1', name: 'New Prompt' }]
      });
    });

    it('should handle query errors gracefully', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Permission denied' }
          }))
        }))
      });

      const query = {
        table: 'prompts',
        operation: 'select' as const
      };

      const result = await SupabaseIntegrationService.executeQuery('connection123', query);

      expect(result).toEqual({
        data: [],
        error: 'Permission denied'
      });
    });
  });
});

describe('SupabasePromptSyncService', () => {
  const validSyncConfig = {
    direction: 'bidirectional' as const,
    strategy: 'safe' as const,
    tableName: 'prompts',
    schema: 'public',
    columnMapping: {
      id: 'id',
      name: 'name',
      content: 'content',
      description: 'description',
      tags: 'tags',
      metadata: 'metadata',
      created_at: 'created_at',
      updated_at: 'updated_at',
      user_id: 'user_id',
      project_id: 'project_id'
    },
    conflictResolution: 'manual' as const,
    realTimeEvents: ['INSERT', 'UPDATE', 'DELETE'] as const,
    batchSize: 100,
    enableRetry: true,
    maxRetries: 3
  };

  describe('startSupabaseSync', () => {
    it('should start sync operation successfully', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        enableRealtime: true,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockPrisma.syncOperation.create.mockResolvedValue({
        id: 'operation123',
        status: 'pending',
        createdAt: new Date()
      });

      const result = await SupabasePromptSyncService.startSupabaseSync(
        'user123',
        'project123',
        'connection123',
        validSyncConfig
      );

      expect(result).toMatchObject({
        operationId: 'operation123'
      });

      expect(mockPrisma.syncOperation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project123',
          connectionId: 'connection123',
          direction: 'bidirectional',
          strategy: 'safe',
          status: 'pending',
          initiatedBy: 'user123'
        })
      });

      expect(mockQueueService.addJob).toHaveBeenCalledWith({
        type: 'supabase_prompt_sync',
        data: expect.objectContaining({
          operationId: 'operation123',
          connectionId: 'connection123',
          projectId: 'project123',
          userId: 'user123',
          config: validSyncConfig
        }),
        priority: 1
      });
    });

    it('should throw AuthorizationError for insufficient permissions', async () => {
      mockProjectService.getUserProjectRole.mockResolvedValue('VIEWER');

      await expect(
        SupabasePromptSyncService.startSupabaseSync(
          'user123',
          'project123',
          'connection123',
          validSyncConfig
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });
});

describe('SupabaseAuthService', () => {
  const validAuthConfig = {
    jwtSecret: 'a-very-long-secret-key-for-testing-purposes-32chars',
    issuer: 'prompt-lab',
    audience: 'authenticated',
    expirationTime: '1h',
    refreshTokenExpiration: '7d'
  };

  describe('configureAuth', () => {
    it('should configure authentication successfully', async () => {
      mockPrisma.appIntegration.findUnique.mockResolvedValue({
        id: 'connection123',
        syncConfig: {}
      });

      mockPrisma.appIntegration.update.mockResolvedValue({});

      await SupabaseAuthService.configureAuth('connection123', validAuthConfig);

      expect(mockPrisma.appIntegration.update).toHaveBeenCalledWith({
        where: { id: 'connection123' },
        data: {
          syncConfig: expect.objectContaining({
            auth: expect.objectContaining({
              configured: true,
              issuer: validAuthConfig.issuer,
              audience: validAuthConfig.audience
            })
          })
        }
      });
    });

    it('should throw ValidationError for missing JWT secret', async () => {
      const invalidConfig = { ...validAuthConfig, jwtSecret: '' };

      await expect(
        SupabaseAuthService.configureAuth('connection123', invalidConfig)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createRLSPolicy', () => {
    const validPolicy = {
      name: 'user_isolation_policy',
      table: 'prompts',
      command: 'SELECT' as const,
      using: 'user_id = auth.uid()',
      enabled: true
    };

    it('should create RLS policy successfully', async () => {
      const mockConnection = {
        authClient: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await SupabaseAuthService.createRLSPolicy('connection123', validPolicy);

      expect(result).toMatchObject({
        success: true,
        policyId: expect.any(String)
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'exec_sql',
        expect.objectContaining({
          sql: expect.stringContaining('CREATE POLICY "user_isolation_policy" ON "prompts"')
        })
      );
    });

    it('should throw ValidationError when service key is not available', async () => {
      const mockConnection = {
        authClient: null,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      await expect(
        SupabaseAuthService.createRLSPolicy('connection123', validPolicy)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createStandardRLSPolicies', () => {
    it('should create standard RLS policies successfully', async () => {
      const mockConnection = {
        authClient: mockSupabaseClient,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const options = {
        enableUserIsolation: true,
        enableProjectIsolation: true,
        enableRoleBasedAccess: false
      };

      const result = await SupabaseAuthService.createStandardRLSPolicies(
        'connection123',
        'prompts',
        options
      );

      expect(result).toMatchObject({
        success: true,
        createdPolicies: expect.any(Array),
        errors: expect.any(Array)
      });

      expect(result.createdPolicies.length).toBeGreaterThan(0);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(
        result.createdPolicies.length + 1 // +1 for enabling RLS
      );
    });
  });
});

describe('SupabaseRealtimeService', () => {
  const validSubscriptionConfig = {
    table: 'prompts',
    schema: 'public',
    events: ['INSERT', 'UPDATE', 'DELETE'] as const,
    bufferSize: 100,
    bufferDelay: 1000,
    retryAttempts: 3,
    retryDelay: 5000,
    autoReconnect: true,
    heartbeatInterval: 30000
  };

  describe('createSubscription', () => {
    it('should create realtime subscription successfully', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        enableRealtime: true,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      const mockChannel = {
        on: jest.fn(),
        subscribe: jest.fn((callback) => {
          callback('SUBSCRIBED', null);
          return Promise.resolve();
        }),
        track: jest.fn(() => Promise.resolve())
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const result = await SupabaseRealtimeService.createSubscription(
        'connection123',
        'project123',
        'user123',
        validSubscriptionConfig
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        connectionId: 'connection123',
        projectId: 'project123',
        userId: 'user123',
        status: 'connected',
        config: validSubscriptionConfig
      });

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        'table:public:prompts',
        expect.any(Object)
      );

      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should throw ValidationError when realtime is not enabled', async () => {
      const mockConnection = {
        client: mockSupabaseClient,
        enableRealtime: false,
        id: 'connection123'
      };
      
      jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
        .mockResolvedValue(mockConnection as any);

      await expect(
        SupabaseRealtimeService.createSubscription(
          'connection123',
          'project123',
          'user123',
          validSubscriptionConfig
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getRealtimeStats', () => {
    it('should return realtime statistics', () => {
      const stats = SupabaseRealtimeService.getRealtimeStats();

      expect(stats).toMatchObject({
        totalSubscriptions: expect.any(Number),
        activeSubscriptions: expect.any(Number),
        totalMessages: expect.any(Number),
        messagesPerSecond: expect.any(Number),
        errorRate: expect.any(Number),
        connectionHealth: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        subscriptionDetails: expect.any(Array)
      });
    });
  });

  describe('healthCheck', () => {
    it('should perform health check and return status', async () => {
      const health = await SupabaseRealtimeService.healthCheck();

      expect(health).toMatchObject({
        healthy: expect.any(Boolean),
        issues: expect.any(Array),
        stats: expect.objectContaining({
          totalSubscriptions: expect.any(Number),
          connectionHealth: expect.stringMatching(/^(healthy|degraded|unhealthy)$/)
        })
      });
    });
  });
});

describe('SupabaseConfigService', () => {
  const validProjectConfig = {
    name: 'Test Configuration',
    description: 'Test configuration for Supabase integration',
    environments: [{
      name: 'development',
      type: 'development' as const,
      supabaseUrl: 'https://dev.supabase.co',
      supabaseAnonKey: 'dev-anon-key',
      supabaseServiceKey: 'dev-service-key',
      projectRef: 'dev-ref',
      isActive: true,
      features: {
        realtime: true,
        auth: true,
        storage: false,
        edgeFunctions: false
      },
      limits: {
        maxConnections: 50,
        maxSubscriptions: 25,
        rateLimitRpm: 500,
        maxPayloadSize: 500000
      },
      monitoring: {
        enabled: true,
        logLevel: 'info' as const,
        metricsEnabled: true,
        alertingEnabled: false
      }
    }],
    connectionPool: {
      minConnections: 5,
      maxConnections: 20,
      idleTimeoutMs: 60000,
      connectionTimeoutMs: 10000,
      retryAttempts: 3,
      retryDelayMs: 5000,
      healthCheckIntervalMs: 60000
    },
    security: {
      encryptApiKeys: true,
      allowInsecureConnections: false,
      tlsMinVersion: '1.2',
      certificateValidation: true,
      apiKeyRotationDays: 90,
      sessionTimeoutMinutes: 60,
      maxFailedAttempts: 5
    }
  };

  describe('createProjectConfig', () => {
    it('should create project configuration successfully', async () => {
      mockPrisma.appIntegration.create.mockResolvedValue({
        id: 'config123',
        name: validProjectConfig.name,
        type: 'supabase_config',
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: 'project123',
        createdBy: 'user123'
      });

      const result = await SupabaseConfigService.createProjectConfig(
        'user123',
        'project123',
        validProjectConfig
      );

      expect(result).toMatchObject({
        id: 'config123',
        name: validProjectConfig.name,
        description: validProjectConfig.description,
        environments: expect.any(Array),
        connectionPool: validProjectConfig.connectionPool,
        security: validProjectConfig.security
      });

      expect(mockPrisma.appIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project123',
          name: validProjectConfig.name,
          type: 'supabase_config',
          isActive: true,
          createdBy: 'user123'
        })
      });
    });

    it('should throw AuthorizationError for insufficient permissions', async () => {
      mockProjectService.getUserProjectRole.mockResolvedValue('VIEWER');

      await expect(
        SupabaseConfigService.createProjectConfig('user123', 'project123', validProjectConfig)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('testEnvironmentConnection', () => {
    it('should test environment connection successfully', async () => {
      const mockConfig = {
        id: 'config123',
        environments: [validProjectConfig.environments[0]]
      };

      jest.spyOn(SupabaseConfigService, 'getProjectConfig')
        .mockResolvedValue(mockConfig as any);

      mockCreateClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: { code: 'PGRST116' } }))
          }))
        })),
        rpc: jest.fn(() => Promise.resolve({ data: 'PostgreSQL 14.0' }))
      });

      const result = await SupabaseConfigService.testEnvironmentConnection(
        'config123',
        'user123',
        'development'
      );

      expect(result).toMatchObject({
        success: true,
        latency: expect.any(Number),
        version: expect.any(String),
        features: expect.objectContaining({
          realtime: true,
          auth: true
        })
      });
    });

    it('should return error for failed connection', async () => {
      const mockConfig = {
        id: 'config123',
        environments: [validProjectConfig.environments[0]]
      };

      jest.spyOn(SupabaseConfigService, 'getProjectConfig')
        .mockResolvedValue(mockConfig as any);

      mockCreateClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ 
              data: null, 
              error: { message: 'Connection failed', code: 'CONNECTION_ERROR' } 
            }))
          }))
        }))
      });

      const result = await SupabaseConfigService.testEnvironmentConnection(
        'config123',
        'user123',
        'development'
      );

      expect(result).toMatchObject({
        success: false,
        error: 'Connection failed'
      });
    });
  });

  describe('rotateEnvironmentKeys', () => {
    it('should rotate API keys successfully', async () => {
      const mockConfig = {
        id: 'config123',
        projectId: 'project123',
        environments: [validProjectConfig.environments[0]]
      };

      jest.spyOn(SupabaseConfigService, 'getProjectConfig')
        .mockResolvedValue(mockConfig as any);

      jest.spyOn(SupabaseConfigService, 'testEnvironmentConnection')
        .mockResolvedValue({ success: true, latency: 100 });

      jest.spyOn(SupabaseConfigService, 'updateProjectConfig')
        .mockResolvedValue(mockConfig as any);

      const newKeys = {
        supabaseAnonKey: 'new-anon-key',
        supabaseServiceKey: 'new-service-key'
      };

      const result = await SupabaseConfigService.rotateEnvironmentKeys(
        'config123',
        'user123',
        'development',
        newKeys
      );

      expect(result).toMatchObject({
        success: true,
        rotatedKeys: ['anon_key', 'service_key']
      });
    });

    it('should fail rotation if new keys are invalid', async () => {
      const mockConfig = {
        id: 'config123',
        projectId: 'project123',
        environments: [validProjectConfig.environments[0]]
      };

      jest.spyOn(SupabaseConfigService, 'getProjectConfig')
        .mockResolvedValue(mockConfig as any);

      jest.spyOn(SupabaseConfigService, 'testEnvironmentConnection')
        .mockResolvedValue({ success: false, error: 'Invalid API key' });

      const newKeys = {
        supabaseAnonKey: 'invalid-key'
      };

      const result = await SupabaseConfigService.rotateEnvironmentKeys(
        'config123',
        'user123',
        'development',
        newKeys
      );

      expect(result).toMatchObject({
        success: false,
        rotatedKeys: [],
        error: expect.stringContaining('Invalid API key')
      });
    });
  });
});

// Integration tests
describe('Supabase Integration E2E Tests', () => {
  it('should complete full integration workflow', async () => {
    // 1. Register Supabase integration
    const config = {
      name: 'E2E Test Integration',
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
      supabaseServiceKey: 'test-service-key',
      projectRef: 'test-ref',
      useServiceKey: false,
      enableRealtime: true,
      enableRLS: true,
      syncConfig: {
        autoSync: false,
        syncInterval: 60,
        bidirectional: true,
        conflictResolution: 'manual' as const,
        promptFilters: {},
        realTimeEvents: ['INSERT', 'UPDATE', 'DELETE'] as const
      }
    };

    mockPrisma.appIntegration.create.mockResolvedValue({
      id: 'integration123',
      name: config.name,
      type: 'supabase'
    });

    const connection = await SupabaseIntegrationService.registerSupabaseIntegration(
      'user123',
      'project123',
      config
    );

    expect(connection).toBeDefined();
    expect(connection.id).toBe('integration123');

    // 2. Test connection health
    jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
      .mockResolvedValue({ client: mockSupabaseClient, id: 'integration123' } as any);

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [], error: { code: 'PGRST116' } }))
      }))
    });

    const health = await SupabaseIntegrationService.testConnection('integration123');
    expect(health.healthy).toBe(true);

    // 3. Configure authentication
    const authConfig = {
      jwtSecret: 'a-very-long-secret-key-for-testing-purposes-32chars',
      issuer: 'prompt-lab',
      audience: 'authenticated'
    };

    mockPrisma.appIntegration.findUnique.mockResolvedValue({
      id: 'integration123',
      syncConfig: {}
    });

    mockPrisma.appIntegration.update.mockResolvedValue({});

    await SupabaseAuthService.configureAuth('integration123', authConfig);

    // 4. Start sync operation
    const syncConfig = {
      direction: 'pull' as const,
      strategy: 'safe' as const,
      tableName: 'prompts',
      schema: 'public',
      columnMapping: {
        id: 'id',
        name: 'name',
        content: 'content',
        created_at: 'created_at',
        updated_at: 'updated_at'
      },
      conflictResolution: 'manual' as const,
      realTimeEvents: ['INSERT', 'UPDATE', 'DELETE'] as const,
      batchSize: 100,
      enableRetry: true,
      maxRetries: 3
    };

    jest.spyOn(SupabaseIntegrationService, 'getSupabaseConnection')
      .mockResolvedValue({ 
        client: mockSupabaseClient, 
        enableRealtime: true, 
        id: 'integration123' 
      } as any);

    mockPrisma.syncOperation.create.mockResolvedValue({
      id: 'sync123',
      status: 'pending'
    });

    const syncResult = await SupabasePromptSyncService.startSupabaseSync(
      'user123',
      'project123',
      'integration123',
      syncConfig
    );

    expect(syncResult).toMatchObject({
      operationId: 'sync123'
    });

    // Verify all services were called
    expect(mockPrisma.appIntegration.create).toHaveBeenCalled();
    expect(mockPrisma.syncOperation.create).toHaveBeenCalled();
    expect(mockQueueService.addJob).toHaveBeenCalled();
  });
});