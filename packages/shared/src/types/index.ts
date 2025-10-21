/**
 * Core types for the Prompt Testing Lab
 */

// Generic content structure (not news-specific)
export interface ContentData {
  id: string;
  title: string;
  content: string;
  contentType: 'text' | 'html' | 'markdown' | 'url' | 'json';
  sourceUrl?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Prompt management
export interface PromptTemplate {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  template: string;
  formatInstructions?: string;
  modelConfig: ModelConfig;
  tags: string[];
  version: number;
  parentPromptId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Model configuration
export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemMessage?: string;
  customEndpoint?: string;
  customHeaders?: Record<string, string>;
}

// Test execution
export interface TestExecution {
  id: string;
  promptId: string;
  contentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  rawOutput?: string;
  structuredOutput?: any;
  tokenUsage?: TokenUsage;
  executionTimeMs?: number;
  errorMessage?: string;
  modelUsed: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// Test sessions (batch testing)
export interface TestSession {
  id: string;
  projectId: string;
  name?: string;
  promptIds: string[];
  contentIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    completed: number;
    total: number;
    failed?: number;
  };
  resultsSummary?: TestSessionResults;
  createdAt: Date;
  completedAt?: Date;
}

export interface TestSessionResults {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  averageExecutionTime: number;
  totalTokensUsed: number;
  estimatedCost: number;
  topPerformingPrompts: Array<{
    promptId: string;
    name: string;
    successRate: number;
    avgExecutionTime: number;
  }>;
}

// Project management (multi-tenant)
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  defaultModelConfig: ModelConfig;
  allowedModelProviders: string[];
  maxConcurrentTests: number;
  retentionDays: number;
  customInstructions?: string;
  webhookUrl?: string;
  notifications: {
    email?: string;
    slack?: string;
    discord?: string;
  };
}

// API request/response types
export interface TestPromptRequest {
  promptId: string;
  contentIds: string[];
  modelOverride?: Partial<ModelConfig>;
  options?: {
    async?: boolean;
    includeRawOutput?: boolean;
    timeout?: number;
  };
}

export interface TestPromptResponse {
  sessionId?: string; // For async requests
  results?: TestExecution[]; // For sync requests
  status: 'queued' | 'completed' | 'failed';
  message?: string;
}

export interface BatchTestRequest {
  projectId: string;
  name?: string;
  promptIds: string[];
  contentIds: string[];
  options?: {
    concurrency?: number;
    timeout?: number;
    stopOnError?: boolean;
  };
}

// Generic parsed output interface (extensible)
export interface ParsedOutput {
  [key: string]: any;
}

// Parser configuration
export interface ParserConfig {
  outputFormat: 'json' | 'markdown' | 'auto';
  strictMode: boolean;
  fallbackStrategy: 'error' | 'partial' | 'raw';
  customFields?: Record<string, {
    type: 'string' | 'array' | 'object';
    required: boolean;
    fallback?: any;
  }>;
}

// Context types for different use cases
export type ContextType = 'generic' | 'news-summary' | 'document-analysis' | 'conversation' | 'custom';

export interface ContextConfig {
  type: ContextType;
  name: string;
  description: string;
  defaultParser: ParserConfig;
  samplePrompts: string[];
  expectedOutputSchema: any;
}

// Error types
export interface PromptLabError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: Date;
}

// Authentication & Authorization
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: Permission[];
  projects: string[]; // Project IDs user has access to
}

export type Permission = 'read' | 'write' | 'admin' | 'deploy';

export interface AuthToken {
  sub: string; // User ID
  iat: number;
  exp: number;
  scope: Permission[];
  tenant: string;
}

// Deployment
export interface Deployment {
  id: string;
  promptId: string;
  projectId: string;
  environment: 'staging' | 'production';
  deploymentUrl?: string;
  deploymentConfig: Record<string, any>;
  status: 'pending' | 'active' | 'inactive' | 'failed';
  deployedAt: Date;
  rolledBackAt?: Date;
}

// Analytics & Metrics
export interface AnalyticsData {
  promptId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    totalTokensUsed: number;
    estimatedCost: number;
    errorRate: number;
    commonErrors: Array<{
      error: string;
      count: number;
    }>;
  };
  performance: {
    p50ExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
  };
}

// Deployment Management Types
export interface Environment {
  id: string;
  name: string;
  type: 'STAGING' | 'PRODUCTION' | 'DEVELOPMENT' | 'PREVIEW';
  description?: string;
  config?: Record<string, any>;
  isActive: boolean;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentCreate {
  promptId: string;
  environmentId: string;
  version: string;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DeploymentUpdate {
  status?: 'PENDING' | 'DEPLOYING' | 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'ROLLED_BACK';
  deployedUrl?: string;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DeploymentResponse {
  id: string;
  version: string;
  status: 'PENDING' | 'DEPLOYING' | 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'ROLLED_BACK';
  deployedUrl?: string;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
  deployedAt?: Date;
  rollbackAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  promptId: string;
  environmentId: string;
  deployedBy: string;
  environment: Environment;
  deployedByUser: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DeploymentHistory {
  id: string;
  action: 'deploy' | 'rollback' | 'update' | 'deactivate';
  status: 'PENDING' | 'DEPLOYING' | 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'ROLLED_BACK';
  metadata?: Record<string, any>;
  timestamp: Date;
  deploymentId: string;
  performedBy: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// Impact Analysis Types
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

export interface ImpactAnalysisRequest {
  promptId: string;
  baselinePromptId: string;
  sampleInputs?: string[];
  modelConfig?: ModelConfig;
}

// Cost Tracking Types
export interface CostData {
  thisMonth: number;
  limit: number;
  lastTest: number;
  breakdown: {
    byModel: Record<string, number>;
    byUser: Record<string, number>;
    byProject: Record<string, number>;
  };
}

export interface CostTracking {
  id: string;
  period: string;
  totalCost: number;
  tokenUsage: number;
  requestCount: number;
  breakdown: Record<string, any>;
  projectId: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBilling {
  id: string;
  billingEmail?: string;
  plan: 'free' | 'pro' | 'enterprise';
  monthlyLimit: number;
  currentUsage: number;
  isActive: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced User Types for Deployment
export interface UserWithPermissions extends User {
  canDeploy: boolean;
  billing?: UserBilling;
  deploymentHistory: DeploymentHistory[];
}

// App/Project Management for Multi-App Support
export interface App {
  id: string;
  name: string;
  version: string;
  projectId: string;
  environments: Environment[];
  activeDeployments: DeploymentResponse[];
}

// Deployment Review Data (matching the component interface)
export interface DeployVariant {
  id: number;
  label: string;
  prompt: string;
  score: number;
}

export interface OutputComparison {
  current: string;
  new: string;
}

export interface DeployReviewData {
  selectedVariant: DeployVariant;
  currentPrompt: string;
  outputs: OutputComparison;
  userData: {
    name: string;
    canDeploy: boolean;
    email: string;
  };
  apps: App[];
  costData: CostData;
  impactPercentage: number;
}

// API Response Types for Deployment Endpoints
export interface DeploymentListResponse {
  success: boolean;
  data: DeploymentResponse[];
  message: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeploymentCreateResponse {
  success: boolean;
  data: DeploymentResponse;
  message: string;
}

export interface ImpactAnalysisResponse {
  success: boolean;
  data: ImpactAnalysisResult;
  message: string;
}

export interface EnvironmentListResponse {
  success: boolean;
  data: Environment[];
  message: string;
}

export interface CostDataResponse {
  success: boolean;
  data: CostData;
  message: string;
}

// Extended Permission Types
export type ExtendedPermission = Permission | 'deploy' | 'manage_environments' | 'view_costs' | 'manage_billing';

// Export all types
export * from './smart-brevity';