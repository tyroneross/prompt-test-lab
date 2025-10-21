import { z } from 'zod';

// Base plugin interface
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  enabled: boolean;
  config: PluginConfig;
}

// Plugin configuration schema
export interface PluginConfig {
  [key: string]: any;
}

// Plugin execution context
export interface PluginContext {
  testRunId: string;
  promptId: string;
  promptContent: string;
  testInput: string;
  modelResponse: string;
  modelProvider: string;
  modelName: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
  metadata?: Record<string, any>;
}

// Plugin execution result
export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  metrics?: Record<string, number>;
  metadata?: Record<string, any>;
}

// Base evaluator plugin interface
export interface EvaluatorPlugin extends Plugin {
  type: 'evaluator';
  evaluate(context: PluginContext): Promise<PluginResult>;
  getConfigSchema(): z.ZodSchema;
}

// Base diff algorithm plugin interface
export interface DiffPlugin extends Plugin {
  type: 'diff';
  compare(
    baseline: string,
    candidate: string,
    options?: Record<string, any>
  ): Promise<PluginResult>;
  getConfigSchema(): z.ZodSchema;
}

// Base preprocessor plugin interface
export interface PreprocessorPlugin extends Plugin {
  type: 'preprocessor';
  preprocess(input: string, context: PluginContext): Promise<PluginResult>;
  getConfigSchema(): z.ZodSchema;
}

// Base postprocessor plugin interface
export interface PostprocessorPlugin extends Plugin {
  type: 'postprocessor';
  postprocess(output: string, context: PluginContext): Promise<PluginResult>;
  getConfigSchema(): z.ZodSchema;
}

// Union type for all plugin types
export type AnyPlugin = EvaluatorPlugin | DiffPlugin | PreprocessorPlugin | PostprocessorPlugin;

// Plugin registry interface
export interface PluginRegistry {
  register(plugin: AnyPlugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): AnyPlugin | undefined;
  getByType<T extends AnyPlugin>(type: T['type']): T[];
  list(): AnyPlugin[];
  enable(pluginId: string): void;
  disable(pluginId: string): void;
}

// Evaluation criteria for test runs
export interface EvaluationCriteria {
  name: string;
  description: string;
  weight: number;
  pluginId: string;
  config: PluginConfig;
}

// Evaluation result
export interface EvaluationResult {
  criteriaName: string;
  score: number;
  maxScore: number;
  passed: boolean;
  details?: any;
  error?: string;
}

// Diff comparison result
export interface DiffResult {
  similarity: number;
  differences: DiffChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

// Individual diff change
export interface DiffChange {
  type: 'add' | 'remove' | 'modify';
  position: number;
  oldValue?: string;
  newValue?: string;
  context?: string;
}

// Plugin validation schemas
export const pluginConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string().optional(),
  enabled: z.boolean().default(true),
  config: z.record(z.any()),
});

export const evaluationCriteriaSchema = z.object({
  name: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1),
  pluginId: z.string(),
  config: z.record(z.any()),
});

// Built-in evaluator types
export enum BuiltInEvaluators {
  SIMILARITY = 'similarity',
  SENTIMENT = 'sentiment',
  TOXICITY = 'toxicity',
  FACTUALITY = 'factuality',
  COHERENCE = 'coherence',
  RELEVANCE = 'relevance',
  FLUENCY = 'fluency',
  CUSTOM = 'custom',
}

// Built-in diff algorithms
export enum BuiltInDiffAlgorithms {
  LEVENSHTEIN = 'levenshtein',
  SEMANTIC = 'semantic',
  WORD_DIFF = 'word_diff',
  LINE_DIFF = 'line_diff',
  JSON_DIFF = 'json_diff',
  CUSTOM = 'custom',
}