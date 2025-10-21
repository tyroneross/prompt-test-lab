/**
 * TypeScript type definitions for the Prompt Testing Lab
 */

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: ProjectMember[];
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  userId: string;
  user: User;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface ProjectSettings {
  defaultModels: string[];
  costLimits: {
    daily?: number;
    monthly?: number;
  };
  notifications: {
    testComplete: boolean;
    testFailed: boolean;
    costThreshold: boolean;
  };
}

// Prompt Types
export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  description?: string;
  tags: string[];
  variables: PromptVariable[];
  projectId: string;
  createdBy: string;
  version: number;
  parentId?: string; // For versioning
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVariable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
}

// Model and Provider Types
export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  description?: string;
  capabilities: ModelCapability[];
  pricing: {
    input: number; // per 1K tokens
    output: number; // per 1K tokens
  };
  limits: {
    maxTokens: number;
    contextWindow: number;
  };
  parameters: {
    temperature: { min: number; max: number; default: number };
    topP: { min: number; max: number; default: number };
    maxTokens: { min: number; max: number; default: number };
  };
  isAvailable: boolean;
}

export type ModelProvider = 'openai' | 'anthropic' | 'cohere' | 'huggingface' | 'google' | 'meta' | 'custom';

export type ModelCapability = 'text-generation' | 'code-generation' | 'reasoning' | 'multimodal' | 'function-calling';

// Test Configuration Types
export interface TestConfiguration {
  id: string;
  name: string;
  description?: string;
  prompts: string[]; // PromptTemplate IDs
  models: string[]; // ModelConfig IDs
  content: TestContent[];
  parameters: TestParameters;
  projectId: string;
  createdBy: string;
  createdAt: string;
}

export interface TestContent {
  id: string;
  name: string;
  content: string;
  variables?: Record<string, any>;
}

export interface TestParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  seed?: number;
}

// Test Execution Types
export interface TestSession {
  id: string;
  configurationId: string;
  name: string;
  status: TestStatus;
  progress: TestProgress;
  results: TestExecution[];
  metadata: {
    totalTests: number;
    completedTests: number;
    failedTests: number;
    estimatedCost: number;
    actualCost: number;
    startedAt: string;
    completedAt?: string;
    duration?: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TestStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TestProgress {
  current: number;
  total: number;
  percentage: number;
  currentTest?: {
    promptId: string;
    modelId: string;
    contentId: string;
  };
  queue: number;
  errors: number;
}

export interface TestExecution {
  id: string;
  sessionId: string;
  promptId: string;
  modelId: string;
  contentId: string;
  status: ExecutionStatus;
  input: {
    prompt: string;
    content: string;
    parameters: TestParameters;
  };
  output?: {
    text: string;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    cost: number;
    latency: number; // milliseconds
    finishReason: string;
  };
  error?: {
    type: string;
    message: string;
    code?: string;
  };
  metrics?: TestMetrics;
  startedAt: string;
  completedAt?: string;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TestMetrics {
  qualityScore?: number;
  relevanceScore?: number;
  coherenceScore?: number;
  customMetrics?: Record<string, number>;
}

// Analytics Types
export interface AnalyticsData {
  timeRange: {
    start: string;
    end: string;
  };
  summary: {
    totalTests: number;
    successRate: number;
    totalCost: number;
    totalTokens: number;
    averageLatency: number;
  };
  trends: {
    testsOverTime: DataPoint[];
    costOverTime: DataPoint[];
    successRateOverTime: DataPoint[];
    latencyOverTime: DataPoint[];
  };
  modelPerformance: ModelPerformanceData[];
  promptPerformance: PromptPerformanceData[];
  costBreakdown: CostBreakdownData[];
}

export interface DataPoint {
  timestamp: string;
  value: number;
}

export interface ModelPerformanceData {
  modelId: string;
  modelName: string;
  tests: number;
  successRate: number;
  averageLatency: number;
  totalCost: number;
  averageCost: number;
}

export interface PromptPerformanceData {
  promptId: string;
  promptName: string;
  tests: number;
  successRate: number;
  averageQuality: number;
  totalCost: number;
}

export interface CostBreakdownData {
  category: string;
  amount: number;
  percentage: number;
}

// UI State Types
export interface UIState {
  layout: LayoutVariant;
  sidebar: {
    isCollapsed: boolean;
    activeSection: string;
  };
  theme: 'light' | 'dark' | 'system';
  preferences: {
    reducedMotion: boolean;
    highContrast: boolean;
    fontSize: 'sm' | 'md' | 'lg';
  };
}

export type LayoutVariant = 'studio' | 'workflow' | 'dashboard';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface TestProgressUpdate {
  sessionId: string;
  progress: TestProgress;
  currentExecution?: TestExecution;
}

export interface TestCompletionUpdate {
  sessionId: string;
  execution: TestExecution;
}

// Form Types
export interface FormFieldProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
}

export interface FormState<T = any> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Filter and Search Types
export interface FilterOptions {
  status?: TestStatus[];
  models?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  creators?: string[];
  tags?: string[];
}

export interface SearchOptions {
  query: string;
  filters: FilterOptions;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export interface InteractiveComponentProps extends BaseComponentProps {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

// Error Types
export interface AppError {
  type: 'network' | 'validation' | 'authorization' | 'server' | 'unknown';
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
  timestamp: string;
}

// Feature Flag Types
export interface FeatureFlags {
  advancedAnalytics: boolean;
  customModels: boolean;
  teamCollaboration: boolean;
  apiIntegrations: boolean;
  bulkOperations: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  variant: 'primary' | 'secondary';
}