// API Contracts and Interfaces for Prompt Testing Lab Integration

export type DependencyType = 'langsmith' | 'model_provider' | 'webhook' | 'database' | 'monitoring';
export type ModelProvider = 'openai' | 'anthropic' | 'groq' | 'local' | 'huggingface';
export type DependencyStatus = 'ACTIVE' | 'INACTIVE' | 'UNHEALTHY' | 'DEPRECATED';
export type DeploymentStrategy = 'blue_green' | 'canary' | 'rolling' | 'immediate';

// Base Configuration Interfaces
export interface BaseConfig {
  name: string;
  type: DependencyType;
  provider: ModelProvider;
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface LangSmithConfig extends BaseConfig {
  type: 'langsmith';
  provider: 'langsmith';
  projectId?: string;
  datasetId?: string;
  tracingEnabled?: boolean;
  evaluationRuns?: string[];
}

export interface OpenAIConfig extends BaseConfig {
  type: 'model_provider';
  provider: 'openai';
  apiVersion?: string;
  organization?: string;
  models?: string[];
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface WebhookConfig extends BaseConfig {
  type: 'webhook';
  provider: 'webhook';
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api_key';
    credentials: Record<string, string>;
  };
}

export type DependencyConfig = LangSmithConfig | OpenAIConfig | WebhookConfig;

// App Integration Interfaces
export interface AppIntegrationConfig {
  name: string;
  type: 'langsmith' | 'direct_api' | 'webhook';
  baseUrl: string;
  apiKey: string;
  syncConfig: {
    autoSync: boolean;
    syncInterval: number; // minutes
    bidirectional: boolean;
    promptFilters?: {
      tags?: string[];
      projects?: string[];
      environments?: string[];
    };
  };
}

export interface PromptSyncRequest {
  sourceAppId: string;
  targetAppId?: string;
  promptIds?: string[];
  environment?: string;
  tags?: string[];
  forceSync?: boolean;
  direction: 'pull' | 'push' | 'bidirectional';
}

export interface PromptSyncResponse {
  success: boolean;
  pulled?: number;
  pushed?: number;
  updated?: number;
  conflicts?: Array<{
    promptId: string;
    name: string;
    reason: string;
  }>;
  deployed?: number;
  failed?: number;
  pending?: number;
  errors?: Array<{
    promptId: string;
    name: string;
    error: string;
  }>;
  syncedAt: Date;
}

// Testing Pipeline Interfaces
export interface TestScenario {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string;
  metadata?: Record<string, any>;
}

export interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface EvaluationMetric {
  name: string;
  type: 'accuracy' | 'relevance' | 'coherence' | 'completeness' | 'latency' | 'cost';
  weight: number;
  threshold?: number;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
}

export interface TestPipelineConfig {
  name: string;
  description?: string;
  stages: TestPipelineStage[];
  globalConfig?: {
    timeout: number;
    retryAttempts: number;
    parallelExecution: boolean;
  };
}

export interface TestPipelineStage {
  id: string;
  name: string;
  description: string;
  type: 'validation' | 'performance' | 'quality' | 'comparison' | 'optimization';
  config: {
    models: ModelConfig[];
    evaluators: string[];
    testScenarios: TestScenario[];
    successCriteria: {
      metric: string;
      threshold: number;
      operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    }[];
    parallelExecution: boolean;
    timeout: number; // seconds
  };
  order: number;
  isRequired: boolean;
}

export interface TestPipelineExecution {
  id: string;
  name: string;
  description?: string;
  config: TestPipelineConfig;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stages: {
    id: string;
    name: string;
    type: string;
    config: any;
    order: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPipelineResult {
  id: string;
  status: 'COMPLETED' | 'FAILED' | 'RUNNING';
  startedAt: Date;
  completedAt?: Date;
  stages: {
    stageId: string;
    stageName: string;
    stageType: string;
    startedAt: Date;
    completedAt?: Date;
    metrics: Record<string, any>;
    passed: boolean;
    score: number;
    error?: string;
  }[];
  overallScore: number;
  passedStages: number;
  totalStages: number;
  optimizationSuggestions: OptimizationSuggestion[];
}

export interface OptimizationSuggestion {
  type: 'length_reduction' | 'clarity_improvement' | 'specificity_enhancement' | 'format_standardization' | 'cost_optimization';
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  implementation: string;
  example?: string;
}

// Deployment Pipeline Interfaces
export interface SafeDeploymentConfig {
  promptId: string;
  targetEnvironments: string[];
  strategy: DeploymentStrategy;
  requireApproval?: boolean;
  approvers?: string[];
  requireTestingPass?: boolean;
  requiredTestMetrics?: Record<string, number>;
  preDeploymentTests?: string[];
  postDeploymentTests?: string[];
  rollbackTriggers?: string[];
  rollbackStrategy?: 'immediate' | 'gradual';
  automaticRollback?: boolean;
  monitoringDuration?: number; // minutes
  errorRateThreshold?: number;
  responseTimeThreshold?: number;
  qualityThreshold?: number;
  strategyConfig?: BlueGreenConfig | CanaryConfig | RollingConfig;
  automaticApproval?: {
    conditions: string[];
    thresholds: Record<string, number>;
  };
}

export interface BlueGreenConfig {
  healthCheckEndpoint: string;
  warmupDuration?: number; // minutes
  testTrafficPercentage?: number;
  validationDuration?: number; // minutes
  switchStrategy?: 'immediate' | 'gradual';
}

export interface CanaryConfig {
  initialTrafficPercentage?: number;
  trafficSteps?: number[];
  monitoringDuration?: number; // minutes per step
  successCriteria?: Record<string, number>;
  maxFailureRate?: number;
}

export interface RollingConfig {
  batchSize?: number;
  waitBetweenBatches?: number; // minutes
  maxFailures?: number;
}

export interface DeploymentStage {
  id: string;
  name: string;
  type: 'testing' | 'deployment' | 'validation' | 'traffic_switch' | 'traffic_increase';
  order: number;
  config: Record<string, any>;
  rollbackOnFailure: boolean;
}

export interface RollbackPlan {
  strategy: 'immediate' | 'gradual';
  triggers: string[];
  automaticRollback: boolean;
  steps: {
    id: string;
    name: string;
    type: 'control' | 'traffic_revert' | 'version_restore' | 'verification';
    order: number;
  }[];
}

// Dependency Management Interfaces
export interface DependencyUpdate {
  type: 'langsmith' | 'model_provider' | 'webhook' | 'security' | 'configuration';
  service: string;
  description: string;
  affectedItems: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  metadata?: Record<string, any>;
}

export interface DependencyAnalysis {
  totalDependencies: number;
  healthyDependencies: number;
  criticalIssues: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    affectedItems: string[];
    resolution: string;
  }[];
  warnings: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    affectedItems: string[];
    resolution: string;
  }[];
  recommendations: {
    type: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
  }[];
}

export interface IntegrationStatus {
  connected: boolean;
  applications: {
    id: string;
    name: string;
    type: string;
    status: 'active' | 'inactive' | 'error';
    lastSync?: Date;
    health: 'healthy' | 'unhealthy' | 'unknown';
  }[];
  lastSync?: Date | null;
  pendingActions: {
    type: string;
    id: string;
    promptId?: string;
    promptName?: string;
    createdAt: Date;
    metadata?: Record<string, any>;
  }[];
}

// Impact Analysis Interfaces
export interface ImpactAnalysisRequest {
  promptId: string;
  baselinePromptId: string;
  modelConfig?: ModelConfig;
  sampleInputs?: string[];
  customEvaluators?: string[];
}

export interface ImpactAnalysisResult {
  id: string;
  impactPercentage: number;
  diffAnalysis: {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }>;
  };
  sampleComparisons: Array<{
    input: string;
    currentOutput: string;
    newOutput: string;
    score: number;
  }>;
  createdAt: Date;
  deploymentId: string;
  baselinePromptId?: string;
}

// API Response Wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    requestId: string;
    timestamp: Date;
    version: string;
  };
}

export interface PaginatedResponse<T = any> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  projectId?: string;
}

export interface TestExecutionEvent extends WebSocketEvent {
  type: 'test_execution_started' | 'test_execution_completed' | 'test_execution_failed' | 'test_stage_completed';
  data: {
    executionId: string;
    promptId: string;
    stage?: string;
    progress?: number;
    result?: any;
    error?: string;
  };
}

export interface DeploymentEvent extends WebSocketEvent {
  type: 'deployment_started' | 'deployment_completed' | 'deployment_failed' | 'deployment_rolled_back';
  data: {
    deploymentId: string;
    promptId: string;
    environment: string;
    status: string;
    progress?: number;
    metrics?: Record<string, number>;
  };
}

export interface SyncEvent extends WebSocketEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'conflict_detected';
  data: {
    appId: string;
    direction: 'pull' | 'push';
    promptIds: string[];
    conflicts?: Array<{
      promptId: string;
      reason: string;
    }>;
  };
}

// Integration Health Check
export interface HealthCheckResponse {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  version?: string;
  uptime?: number;
  dependencies?: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      lastCheck: Date;
    };
  };
  metrics?: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }[];
}

// Plugin System Interfaces
export interface PluginInterface {
  id: string;
  name: string;
  version: string;
  type: 'evaluator' | 'transformer' | 'integration' | 'monitor';
  config: Record<string, any>;
  methods: {
    initialize?(config: Record<string, any>): Promise<void>;
    execute(input: any, config: Record<string, any>): Promise<any>;
    cleanup?(): Promise<void>;
  };
}

export interface EvaluatorPlugin extends PluginInterface {
  type: 'evaluator';
  methods: {
    initialize?(config: Record<string, any>): Promise<void>;
    evaluate(input: string, output: string, expectedOutput?: string, config?: Record<string, any>): Promise<{
      score: number;
      metrics: Record<string, number>;
      feedback?: string;
    }>;
    cleanup?(): Promise<void>;
  };
}

export interface TransformerPlugin extends PluginInterface {
  type: 'transformer';
  methods: {
    initialize?(config: Record<string, any>): Promise<void>;
    transform(prompt: string, config?: Record<string, any>): Promise<string>;
    cleanup?(): Promise<void>;
  };
}

// Error Types
export class IntegrationError extends Error {
  constructor(
    message: string,
    public code: string = 'INTEGRATION_ERROR',
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class SyncError extends IntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SYNC_ERROR', 409, details);
    this.name = 'SyncError';
  }
}

export class DeploymentError extends IntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DEPLOYMENT_ERROR', 500, details);
    this.name = 'DeploymentError';
  }
}

export class DependencyError extends IntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DEPENDENCY_ERROR', 503, details);
    this.name = 'DependencyError';
  }
}