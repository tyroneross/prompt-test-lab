import { z } from 'zod';

// =============================================================================
// Base Schemas
// =============================================================================

const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid CUID format');
const urlSchema = z.string().url('Invalid URL format');
const emailSchema = z.string().email('Invalid email format');

// =============================================================================
// App Integration Schemas
// =============================================================================

export const appIntegrationConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: z.enum(['langsmith', 'direct_api', 'webhook'], {
    errorMap: () => ({ message: 'Type must be langsmith, direct_api, or webhook' })
  }),
  baseUrl: urlSchema,
  apiKey: z.string().min(1, 'API key is required'),
  syncConfig: z.object({
    autoSync: z.boolean(),
    syncInterval: z.number().int().positive('Sync interval must be positive').max(1440, 'Max interval is 1440 minutes'),
    bidirectional: z.boolean(),
    conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).optional(),
    promptFilters: z.object({
      tags: z.array(z.string()).optional(),
      projects: z.array(cuidSchema).optional(),
      environments: z.array(z.string()).optional(),
      modifiedAfter: z.string().datetime().optional()
    }).optional()
  }),
  webhookUrl: urlSchema.optional()
});

export const promptSyncRequestSchema = z.object({
  direction: z.enum(['pull', 'push', 'bidirectional'], {
    errorMap: () => ({ message: 'Direction must be pull, push, or bidirectional' })
  }),
  strategy: z.enum(['safe', 'aggressive', 'manual']).optional().default('safe'),
  promptIds: z.array(cuidSchema).optional(),
  environment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  forceSync: z.boolean().optional().default(false),
  conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins']).optional().default('manual'),
  autoResolve: z.boolean().optional().default(false),
  modifiedAfter: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(10).optional().default(1)
});

export const conflictResolutionSchema = z.object({
  promptId: cuidSchema,
  resolution: z.enum(['keep_local', 'use_remote', 'merge', 'create_version'], {
    errorMap: () => ({ message: 'Invalid resolution type' })
  }),
  mergeStrategy: z.enum(['content_append', 'metadata_merge', 'manual']).optional(),
  notes: z.string().max(500, 'Notes too long').optional()
});

// =============================================================================
// Testing Pipeline Schemas
// =============================================================================

export const modelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'groq', 'local'], {
    errorMap: () => ({ message: 'Unsupported model provider' })
  }),
  modelName: z.string().min(1, 'Model name is required'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().positive().max(8192).optional().default(1000),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional()
});

export const testScenarioSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Scenario name is required'),
  input: z.string().min(1, 'Input is required'),
  expectedOutput: z.string().optional(),
  tags: z.array(z.string()).optional(),
  weight: z.number().positive().optional().default(1)
});

export const successCriteriaSchema = z.object({
  metric: z.string().min(1, 'Metric name is required'),
  threshold: z.number(),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq'], {
    errorMap: () => ({ message: 'Invalid operator' })
  })
});

export const pipelineStageConfigSchema = z.object({
  models: z.array(modelConfigSchema).min(1, 'At least one model is required'),
  evaluators: z.array(z.string()).optional().default([]),
  testScenarios: z.array(testScenarioSchema).optional(),
  successCriteria: z.array(successCriteriaSchema).optional(),
  parallelExecution: z.boolean().optional().default(false),
  timeout: z.number().int().positive().max(3600).optional().default(300) // 5 minutes default, max 1 hour
});

export const pipelineStageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Stage name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  type: z.enum(['validation', 'performance', 'quality', 'comparison', 'optimization'], {
    errorMap: () => ({ message: 'Invalid stage type' })
  }),
  config: pipelineStageConfigSchema,
  order: z.number().int().nonnegative(),
  isRequired: z.boolean().optional().default(false)
});

export const testPipelineConfigSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  stages: z.array(pipelineStageSchema).min(1, 'At least one stage is required'),
  globalConfig: z.object({
    timeout: z.number().int().positive().max(7200).optional().default(600), // 10 minutes default, max 2 hours
    retryAttempts: z.number().int().nonnegative().max(5).optional().default(1),
    parallelExecution: z.boolean().optional().default(false)
  }).optional()
});

export const pipelineExecutionRequestSchema = z.object({
  promptId: cuidSchema,
  baselinePromptId: cuidSchema.optional(),
  testDataset: z.array(z.string()).optional(),
  runAsync: z.boolean().optional().default(true),
  options: z.object({
    environment: z.string().optional(),
    tags: z.array(z.string()).optional(),
    priority: z.number().int().min(0).max(10).optional().default(1)
  }).optional()
});

// =============================================================================
// Dependency Management Schemas
// =============================================================================

export const dependencyConfigSchema = z.object({
  name: z.string().min(1, 'Dependency name is required').max(100, 'Name too long'),
  type: z.enum(['langsmith', 'model_provider', 'webhook', 'database', 'monitoring'], {
    errorMap: () => ({ message: 'Invalid dependency type' })
  }),
  provider: z.string().min(1, 'Provider is required'),
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: urlSchema,
  timeout: z.number().int().positive().max(60000).optional().default(10000), // 10 seconds default, max 1 minute
  retryAttempts: z.number().int().nonnegative().max(5).optional().default(3),
  healthCheckInterval: z.number().int().positive().optional(), // minutes
  metadata: z.record(z.any()).optional()
});

export const dependencyUpdatePlanSchema = z.object({
  dependencyIds: z.array(cuidSchema).min(1, 'At least one dependency is required'),
  updateStrategy: z.enum(['immediate', 'scheduled', 'approval_required']).optional().default('approval_required'),
  scheduleDate: z.string().datetime().optional(),
  performBackup: z.boolean().optional().default(true),
  autoRollback: z.boolean().optional().default(true),
  notifyUsers: z.array(cuidSchema).optional()
});

export const dependencyUpdateExecutionSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  skipBackup: z.boolean().optional().default(false),
  autoRollback: z.boolean().optional().default(true),
  forceUpdate: z.boolean().optional().default(false)
});

// =============================================================================
// Safe Deployment Schemas
// =============================================================================

export const canaryConfigSchema = z.object({
  initialTrafficPercentage: z.number().min(1).max(50).optional().default(5),
  trafficSteps: z.array(z.number().min(1).max(100)).optional().default([10, 25, 50, 100]),
  monitoringDuration: z.number().int().positive().max(60).optional().default(10), // minutes
  successCriteria: z.object({
    errorRate: z.number().min(0).max(100).optional().default(5), // percentage
    latency: z.number().positive().optional().default(2000), // milliseconds
    qualityScore: z.number().min(0).max(100).optional().default(70)
  }).optional()
});

export const blueGreenConfigSchema = z.object({
  healthCheckEndpoint: z.string().optional(),
  warmupDuration: z.number().int().nonnegative().max(30).optional().default(5), // minutes
  testTrafficPercentage: z.number().min(1).max(50).optional().default(10),
  validationDuration: z.number().int().positive().max(60).optional().default(10), // minutes
  switchStrategy: z.enum(['immediate', 'gradual']).optional().default('immediate')
});

export const safeDeploymentConfigSchema = z.object({
  promptId: cuidSchema,
  targetEnvironments: z.array(z.string()).min(1, 'At least one target environment is required'),
  strategy: z.enum(['blue_green', 'canary', 'rolling', 'immediate'], {
    errorMap: () => ({ message: 'Invalid deployment strategy' })
  }),
  strategyConfig: z.union([canaryConfigSchema, blueGreenConfigSchema, z.object({})]).optional(),
  requireApproval: z.boolean().optional().default(false),
  approvers: z.array(cuidSchema).optional(),
  requireTestingPass: z.boolean().optional().default(true),
  requiredTestMetrics: z.record(z.number()).optional(),
  preDeploymentTests: z.array(cuidSchema).optional(),
  postDeploymentTests: z.array(cuidSchema).optional(),
  rollbackTriggers: z.array(z.string()).optional().default(['error_rate_high', 'latency_high']),
  rollbackStrategy: z.enum(['immediate', 'gradual']).optional().default('immediate'),
  automaticRollback: z.boolean().optional().default(false),
  monitoringDuration: z.number().int().positive().max(120).optional().default(30), // minutes
  errorRateThreshold: z.number().min(0).max(100).optional().default(5), // percentage
  responseTimeThreshold: z.number().positive().optional().default(2000), // milliseconds
  qualityThreshold: z.number().min(0).max(100).optional().default(70), // percentage
  automaticApproval: z.object({
    conditions: z.array(z.string()),
    thresholds: z.record(z.number())
  }).optional()
});

export const deploymentExecutionRequestSchema = z.object({
  skipApproval: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
  pauseOnFailure: z.boolean().optional().default(true),
  notifyOnCompletion: z.boolean().optional().default(true)
});

export const rollbackRequestSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
  immediate: z.boolean().optional().default(true),
  notifyUsers: z.array(cuidSchema).optional()
});

// =============================================================================
// Webhook Schemas
// =============================================================================

const webhookEvents = [
  'prompt.created', 'prompt.updated', 'prompt.deleted',
  'test_run.started', 'test_run.completed', 'test_run.failed',
  'sync.started', 'sync.completed', 'sync.failed',
  'deployment.started', 'deployment.completed', 'deployment.failed',
  'dependency.health_check', 'pipeline.executed',
  'approval.requested', 'approval.approved', 'approval.rejected'
] as const;

export const webhookConfigSchema = z.object({
  url: urlSchema,
  events: z.array(z.enum(webhookEvents)).min(1, 'At least one event is required'),
  headers: z.record(z.string()).optional(),
  secret: z.string().min(8, 'Secret must be at least 8 characters').optional(),
  enabled: z.boolean().optional().default(true),
  retryAttempts: z.number().int().min(0).max(10).optional().default(3)
});

export const webhookUpdateSchema = webhookConfigSchema.partial();

export const webhookTestRequestSchema = z.object({
  includeSecret: z.boolean().optional().default(true),
  customPayload: z.record(z.any()).optional()
});

// =============================================================================
// Impact Analysis Schemas
// =============================================================================

export const impactAnalysisRequestSchema = z.object({
  promptId: cuidSchema,
  baselinePromptId: cuidSchema,
  modelConfig: modelConfigSchema,
  testInputs: z.array(z.string()).optional(),
  maxSamples: z.number().int().positive().max(100).optional().default(20),
  analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).optional().default('basic')
});

// =============================================================================
// Queue and Job Schemas
// =============================================================================

export const jobConfigSchema = z.object({
  type: z.string().min(1, 'Job type is required'),
  data: z.record(z.any()),
  priority: z.number().int().min(-10).max(10).optional().default(0),
  delay: z.number().int().nonnegative().optional(), // milliseconds
  retryAttempts: z.number().int().min(0).max(10).optional().default(3),
  timeout: z.number().int().positive().max(3600000).optional().default(300000) // 5 minutes default, max 1 hour
});

export const recurringJobConfigSchema = z.object({
  type: z.string().min(1, 'Job type is required'),
  data: z.record(z.any()),
  interval: z.number().int().positive().min(60000), // minimum 1 minute
  priority: z.number().int().min(-10).max(10).optional().default(0),
  enabled: z.boolean().optional().default(true)
});

// =============================================================================
// Query Parameter Schemas
// =============================================================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0)
});

export const statusFilterSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional()
});

export const syncStatusQuerySchema = z.object({
  connectionId: cuidSchema.optional(),
  direction: z.enum(['pull', 'push', 'bidirectional']).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional()
});

// =============================================================================
// Supabase Integration Schemas
// =============================================================================

export const supabaseConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  supabaseUrl: urlSchema,
  supabaseAnonKey: z.string().min(1, 'Anon key is required'),
  supabaseServiceKey: z.string().min(1, 'Service key is required').optional(),
  projectRef: z.string().min(1, 'Project reference is required'),
  useServiceKey: z.boolean().default(false),
  enableRealtime: z.boolean().default(true),
  enableRLS: z.boolean().default(true),
  syncConfig: z.object({
    autoSync: z.boolean().default(false),
    syncInterval: z.number().int().positive().max(1440).default(60), // minutes
    bidirectional: z.boolean().default(true),
    conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).default('manual'),
    promptFilters: z.object({
      tables: z.array(z.string()).optional(),
      schemas: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      modifiedAfter: z.string().datetime().optional()
    }).optional(),
    realTimeEvents: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])).default(['INSERT', 'UPDATE', 'DELETE'])
  })
});

export const supabaseEnvironmentConfigSchema = z.object({
  name: z.string().min(1, 'Environment name is required').max(50, 'Name too long'),
  type: z.enum(['development', 'staging', 'production', 'preview'], {
    errorMap: () => ({ message: 'Environment type must be development, staging, production, or preview' })
  }),
  supabaseUrl: urlSchema,
  supabaseAnonKey: z.string().min(1, 'Anon key is required'),
  supabaseServiceKey: z.string().min(1, 'Service key is required').optional(),
  projectRef: z.string().min(1, 'Project reference is required'),
  region: z.string().optional(),
  databaseUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  features: z.object({
    realtime: z.boolean().default(true),
    auth: z.boolean().default(true),
    storage: z.boolean().default(false),
    edgeFunctions: z.boolean().default(false)
  }).default({}),
  limits: z.object({
    maxConnections: z.number().int().min(1).max(1000).default(100),
    maxSubscriptions: z.number().int().min(1).max(100).default(50),
    rateLimitRpm: z.number().int().min(1).max(10000).default(1000), // requests per minute
    maxPayloadSize: z.number().int().min(1000).max(10000000).default(1000000) // bytes
  }).default({}),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    metricsEnabled: z.boolean().default(true),
    alertingEnabled: z.boolean().default(false),
    webhookUrl: urlSchema.optional()
  }).default({})
});

export const supabaseProjectConfigSchema = z.object({
  name: z.string().min(1, 'Configuration name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  environments: z.array(supabaseEnvironmentConfigSchema).min(1, 'At least one environment is required'),
  connectionPool: z.object({
    minConnections: z.number().int().min(1).max(50).default(5),
    maxConnections: z.number().int().min(1).max(100).default(20),
    idleTimeoutMs: z.number().int().min(10000).max(300000).default(60000), // 1 minute
    connectionTimeoutMs: z.number().int().min(1000).max(30000).default(10000), // 10 seconds
    retryAttempts: z.number().int().min(0).max(10).default(3),
    retryDelayMs: z.number().int().min(1000).max(30000).default(5000),
    healthCheckIntervalMs: z.number().int().min(30000).max(300000).default(60000) // 1 minute
  }).optional(),
  security: z.object({
    encryptApiKeys: z.boolean().default(true),
    allowInsecureConnections: z.boolean().default(false),
    tlsMinVersion: z.string().default('1.2'),
    certificateValidation: z.boolean().default(true),
    ipWhitelist: z.array(z.string()).optional(),
    apiKeyRotationDays: z.number().int().min(1).max(365).default(90),
    sessionTimeoutMinutes: z.number().int().min(1).max(1440).default(60), // 1 hour
    maxFailedAttempts: z.number().int().min(1).max(20).default(5)
  }).optional(),
  backup: z.object({
    enabled: z.boolean().default(false),
    schedule: z.string().default('0 2 * * *'), // Daily at 2 AM
    retention: z.object({
      daily: z.number().int().min(1).max(365).default(7),
      weekly: z.number().int().min(1).max(52).default(4),
      monthly: z.number().int().min(1).max(12).default(3)
    }).default({}),
    compression: z.boolean().default(true),
    encryption: z.boolean().default(true),
    storageLocation: z.string().optional()
  }).optional()
});

export const supabaseSyncConfigSchema = z.object({
  direction: z.enum(['pull', 'push', 'bidirectional'], {
    errorMap: () => ({ message: 'Direction must be pull, push, or bidirectional' })
  }).default('bidirectional'),
  strategy: z.enum(['safe', 'aggressive', 'manual']).default('safe'),
  tableName: z.string().min(1, 'Table name is required'),
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
    modifiedAfter: z.string().datetime().optional()
  }).optional(),
  conflictResolution: z.enum(['manual', 'local_wins', 'remote_wins', 'newest_wins']).default('manual'),
  realTimeEvents: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])).default(['INSERT', 'UPDATE', 'DELETE']),
  batchSize: z.number().int().min(1).max(1000).default(100),
  enableRetry: z.boolean().default(true),
  maxRetries: z.number().int().min(1).max(10).default(3)
});

export const supabaseAuthConfigSchema = z.object({
  jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  issuer: z.string().optional(),
  audience: z.string().optional(),
  expirationTime: z.string().regex(/^\d+[smhd]$/, 'Invalid expiration time format (e.g., 1h, 30m)').optional(),
  refreshTokenExpiration: z.string().regex(/^\d+[smhd]$/, 'Invalid refresh token expiration format').optional()
});

export const rlsPolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required').max(63, 'Policy name too long'), // PostgreSQL identifier limit
  table: z.string().min(1, 'Table name is required'),
  command: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'], {
    errorMap: () => ({ message: 'Invalid command type' })
  }),
  role: z.string().optional(),
  using: z.string().min(1, 'USING expression is required').optional(),
  withCheck: z.string().min(1, 'WITH CHECK expression is required').optional(),
  enabled: z.boolean().default(true)
});

export const supabaseRealtimeSubscriptionConfigSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  schema: z.string().default('public'),
  events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE', '*'])).min(1, 'At least one event is required').default(['*']),
  filter: z.string().optional(), // e.g., "user_id=eq.123"
  enablePresence: z.boolean().default(false),
  enableBroadcast: z.boolean().default(false),
  bufferSize: z.number().int().min(1).max(1000).default(100),
  bufferDelay: z.number().int().min(100).max(10000).default(1000), // ms
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(1000).max(30000).default(5000), // ms
  autoReconnect: z.boolean().default(true),
  heartbeatInterval: z.number().int().min(10000).max(60000).default(30000) // ms
});

export const supabaseQuerySchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  operation: z.enum(['select', 'insert', 'update', 'delete'], {
    errorMap: () => ({ message: 'Operation must be select, insert, update, or delete' })
  }),
  columns: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.any()).optional(),
  data: z.record(z.string(), z.any()).optional(),
  limit: z.number().int().positive().max(1000).optional()
});

export const supabaseTokenVerificationSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

export const supabaseBroadcastSchema = z.object({
  event: z.string().min(1, 'Event name is required'),
  payload: z.any()
});

export const supabaseKeyRotationSchema = z.object({
  supabaseAnonKey: z.string().min(1, 'Anon key is required').optional(),
  supabaseServiceKey: z.string().min(1, 'Service key is required').optional()
}).refine(data => data.supabaseAnonKey || data.supabaseServiceKey, {
  message: 'At least one key must be provided for rotation'
});

export const standardRlsPoliciesConfigSchema = z.object({
  enableUserIsolation: z.boolean().default(true),
  enableProjectIsolation: z.boolean().default(true),
  enableRoleBasedAccess: z.boolean().default(false),
  customPolicies: z.array(rlsPolicySchema).optional()
});

// =============================================================================
// Supabase Response Schemas
// =============================================================================

export const supabaseConnectionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  supabaseUrl: z.string(),
  projectRef: z.string(),
  useServiceKey: z.boolean(),
  enableRealtime: z.boolean(),
  enableRLS: z.boolean(),
  isActive: z.boolean(),
  lastSync: z.string().datetime().optional(),
  syncConfig: z.object({
    autoSync: z.boolean(),
    syncInterval: z.number(),
    bidirectional: z.boolean(),
    conflictResolution: z.string(),
    promptFilters: z.object({}).optional(),
    realTimeEvents: z.array(z.string())
  })
});

export const supabaseHealthCheckResponseSchema = z.object({
  healthy: z.boolean(),
  latency: z.number().optional(),
  version: z.string().optional(),
  error: z.string().optional()
});

export const supabaseTableInfoSchema = z.object({
  name: z.string(),
  schema: z.string(),
  columns: z.array(z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean()
  }))
});

export const supabaseQueryResultSchema = z.object({
  data: z.array(z.any()),
  count: z.number().optional(),
  error: z.string().optional()
});

export const supabaseAuthVerificationResponseSchema = z.object({
  valid: z.boolean(),
  payload: z.object({
    sub: z.string(),
    email: z.string().optional(),
    role: z.string().optional(),
    aud: z.string(),
    exp: z.number(),
    iat: z.number()
  }).optional(),
  user: z.object({
    id: z.string(),
    email: z.string().optional(),
    role: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }).optional(),
  error: z.string().optional()
});

export const supabaseRlsPolicyResponseSchema = z.object({
  success: z.boolean(),
  policyId: z.string().optional(),
  error: z.string().optional()
});

export const supabaseRlsPolicyListResponseSchema = z.object({
  success: z.boolean(),
  policies: z.array(z.object({
    name: z.string(),
    table: z.string(),
    command: z.string(),
    role: z.string().optional(),
    definition: z.string(),
    enabled: z.boolean()
  })).optional(),
  error: z.string().optional()
});

export const supabaseRealtimeStatsSchema = z.object({
  totalSubscriptions: z.number(),
  activeSubscriptions: z.number(),
  totalMessages: z.number(),
  messagesPerSecond: z.number(),
  errorRate: z.number(),
  connectionHealth: z.enum(['healthy', 'degraded', 'unhealthy']),
  subscriptionDetails: z.array(z.object({
    id: z.string(),
    table: z.string(),
    status: z.string(),
    messageCount: z.number(),
    errorCount: z.number(),
    uptime: z.number()
  }))
});

export const supabaseSyncResultSchema = z.object({
  success: z.boolean(),
  pulled: z.number(),
  pushed: z.number(),
  updated: z.number(),
  conflicts: z.array(z.object({
    type: z.string(),
    promptId: z.string(),
    localPrompt: z.any().optional(),
    remotePrompt: z.any(),
    reason: z.string(),
    resolution: z.string()
  })),
  errors: z.array(z.object({
    type: z.string(),
    promptId: z.string().optional(),
    error: z.string(),
    retryable: z.boolean(),
    attemptCount: z.number()
  })),
  syncedAt: z.string().datetime(),
  batchInfo: z.object({
    totalBatches: z.number(),
    processedBatches: z.number(),
    currentBatch: z.number()
  }).optional()
});

export const supabaseEnvironmentMetricsSchema = z.object({
  environmentName: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'down']),
  activeConnections: z.number(),
  totalRequests: z.number(),
  errorRate: z.number(),
  averageResponseTime: z.number(),
  lastHealthCheck: z.string().datetime(),
  uptime: z.number(),
  memory: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number()
  }),
  errors: z.array(z.object({
    timestamp: z.string().datetime(),
    error: z.string(),
    type: z.string()
  }))
});

export const supabaseKeyRotationResponseSchema = z.object({
  success: z.boolean(),
  rotatedKeys: z.array(z.string()),
  error: z.string().optional()
});

// =============================================================================
// Response Schemas (for validation of API responses)
// =============================================================================

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.date(),
    version: z.string()
  })
});

export const syncResultSchema = z.object({
  success: z.boolean(),
  pulled: z.number().int().nonnegative(),
  pushed: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  conflicts: z.array(z.object({
    type: z.string(),
    promptId: z.string(),
    reason: z.string(),
    resolution: z.string()
  })),
  syncedAt: z.date()
});

export const deploymentResultSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'ROLLING_BACK']),
  currentStage: z.number().int().nonnegative(),
  stages: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'])
  })),
  metrics: z.record(z.number()),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  executedBy: z.string()
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a schema for validating request parameters
 */
export const createRequestSchema = (schema: {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}) => z.object({
  params: schema.params || z.object({}),
  query: schema.query || z.object({}),
  body: schema.body || z.object({})
});

/**
 * Validate CUID format
 */
export const validateCuid = (value: string): boolean => {
  return cuidSchema.safeParse(value).success;
};

/**
 * Validate URL format
 */
export const validateUrl = (value: string): boolean => {
  return urlSchema.safeParse(value).success;
};

/**
 * Create validation middleware
 */
export const validateSchema = <T extends z.ZodType>(schema: T) => {
  return (data: unknown): z.infer<T> => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.errors.map(e => e.message).join(', ')}`);
    }
    return result.data;
  };
};

// Export all schemas as a collection for easy access
export const integrationSchemas = {
  // App Integration
  appIntegrationConfig: appIntegrationConfigSchema,
  promptSyncRequest: promptSyncRequestSchema,
  conflictResolution: conflictResolutionSchema,
  
  // Testing Pipeline
  testPipelineConfig: testPipelineConfigSchema,
  pipelineExecutionRequest: pipelineExecutionRequestSchema,
  modelConfig: modelConfigSchema,
  
  // Dependency Management
  dependencyConfig: dependencyConfigSchema,
  dependencyUpdatePlan: dependencyUpdatePlanSchema,
  dependencyUpdateExecution: dependencyUpdateExecutionSchema,
  
  // Safe Deployment
  safeDeploymentConfig: safeDeploymentConfigSchema,
  deploymentExecutionRequest: deploymentExecutionRequestSchema,
  rollbackRequest: rollbackRequestSchema,
  
  // Webhooks
  webhookConfig: webhookConfigSchema,
  webhookUpdate: webhookUpdateSchema,
  webhookTestRequest: webhookTestRequestSchema,
  
  // Impact Analysis
  impactAnalysisRequest: impactAnalysisRequestSchema,
  
  // Queue
  jobConfig: jobConfigSchema,
  recurringJobConfig: recurringJobConfigSchema,
  
  // Supabase Integration
  supabaseConfig: supabaseConfigSchema,
  supabaseEnvironmentConfig: supabaseEnvironmentConfigSchema,
  supabaseProjectConfig: supabaseProjectConfigSchema,
  supabaseSyncConfig: supabaseSyncConfigSchema,
  supabaseAuthConfig: supabaseAuthConfigSchema,
  rlsPolicy: rlsPolicySchema,
  supabaseRealtimeSubscriptionConfig: supabaseRealtimeSubscriptionConfigSchema,
  supabaseQuery: supabaseQuerySchema,
  supabaseTokenVerification: supabaseTokenVerificationSchema,
  supabaseBroadcast: supabaseBroadcastSchema,
  supabaseKeyRotation: supabaseKeyRotationSchema,
  standardRlsPoliciesConfig: standardRlsPoliciesConfigSchema,
  
  // Supabase Responses
  supabaseConnectionResponse: supabaseConnectionResponseSchema,
  supabaseHealthCheckResponse: supabaseHealthCheckResponseSchema,
  supabaseTableInfo: supabaseTableInfoSchema,
  supabaseQueryResult: supabaseQueryResultSchema,
  supabaseAuthVerificationResponse: supabaseAuthVerificationResponseSchema,
  supabaseRlsPolicyResponse: supabaseRlsPolicyResponseSchema,
  supabaseRlsPolicyListResponse: supabaseRlsPolicyListResponseSchema,
  supabaseRealtimeStats: supabaseRealtimeStatsSchema,
  supabaseSyncResult: supabaseSyncResultSchema,
  supabaseEnvironmentMetrics: supabaseEnvironmentMetricsSchema,
  supabaseKeyRotationResponse: supabaseKeyRotationResponseSchema,
  
  // Common
  pagination: paginationSchema,
  statusFilter: statusFilterSchema,
  syncStatusQuery: syncStatusQuerySchema,
  
  // Responses
  apiResponse: apiResponseSchema,
  syncResult: syncResultSchema,
  deploymentResult: deploymentResultSchema
};