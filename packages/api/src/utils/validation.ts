import { z } from 'zod';

// Deployment Validation Schemas
export const DeploymentCreateSchema = z.object({
  promptId: z.string().cuid('Invalid prompt ID format'),
  environmentId: z.string().cuid('Invalid environment ID format'),
  version: z.string().min(1, 'Version is required').regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/,
    'Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta)'
  ),
  config: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

export const DeploymentUpdateSchema = z.object({
  status: z.enum(['PENDING', 'DEPLOYING', 'ACTIVE', 'INACTIVE', 'FAILED', 'ROLLED_BACK']).optional(),
  deployedUrl: z.string().url('Invalid URL format').optional(),
  config: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

// Environment Validation Schemas
export const EnvironmentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  type: z.enum(['STAGING', 'PRODUCTION', 'DEVELOPMENT', 'PREVIEW']),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  config: z.record(z.any()).optional(),
  isActive: z.boolean().default(true)
});

export const EnvironmentUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less').optional(),
  type: z.enum(['STAGING', 'PRODUCTION', 'DEVELOPMENT', 'PREVIEW']).optional(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  config: z.record(z.any()).optional(),
  isActive: z.boolean().optional()
});

// Impact Analysis Validation Schema
export const ImpactAnalysisRequestSchema = z.object({
  promptId: z.string().cuid('Invalid prompt ID format'),
  baselinePromptId: z.string().cuid('Invalid baseline prompt ID format'),
  sampleInputs: z.array(z.string()).max(10, 'Maximum 10 sample inputs allowed').optional(),
  modelConfig: z.object({
    provider: z.enum(['openai', 'anthropic', 'local', 'custom']),
    modelName: z.string().min(1, 'Model name is required'),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(100000).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    systemMessage: z.string().optional(),
    customEndpoint: z.string().url().optional(),
    customHeaders: z.record(z.string()).optional()
  }).optional()
});

// Cost Tracking Validation Schemas
export const CostTrackingUpdateSchema = z.object({
  cost: z.number().min(0, 'Cost must be non-negative'),
  tokenUsage: z.number().int().min(0, 'Token usage must be a non-negative integer'),
  metadata: z.object({
    modelProvider: z.string().optional(),
    modelName: z.string().optional(),
    testRunId: z.string().cuid().optional(),
    promptId: z.string().cuid().optional()
  }).optional()
});

export const UserBillingUpdateSchema = z.object({
  billingEmail: z.string().email('Invalid email format').optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  monthlyLimit: z.number().min(0, 'Monthly limit must be non-negative').optional()
});

// Query parameter validation schemas
export const PaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a positive integer').transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/, 'Limit must be a positive integer').transform(Number).default('10')
}).refine(data => data.page >= 1, { message: 'Page must be at least 1' })
  .refine(data => data.limit >= 1 && data.limit <= 100, { message: 'Limit must be between 1 and 100' });

export const DeploymentFilterSchema = z.object({
  environmentId: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'DEPLOYING', 'ACTIVE', 'INACTIVE', 'FAILED', 'ROLLED_BACK']).optional()
});

export const EnvironmentFilterSchema = z.object({
  type: z.enum(['STAGING', 'PRODUCTION', 'DEVELOPMENT', 'PREVIEW']).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional()
});

export const CostHistoryQuerySchema = z.object({
  periods: z.string().regex(/^\d+$/, 'Periods must be a positive integer').transform(Number).optional(),
  userId: z.string().cuid().optional()
});

// Validation utility functions
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      const message = formattedErrors.map(err => 
        err.field ? `${err.field}: ${err.message}` : err.message
      ).join(', ');
      
      throw new Error(`Validation error: ${message}`);
    }
    throw error;
  }
}

export function validateQueryParams<T>(schema: z.ZodSchema<T>, query: unknown): T {
  return validateRequest(schema, query);
}

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return validateRequest(schema, body);
}

// Middleware factory for validation
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>, 
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: any, res: any, next: any) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'query' ? req.query : 
                   req.params;
      
      const validated = validateRequest(schema, data);
      
      // Attach validated data to request object
      if (source === 'body') {
        req.validatedBody = validated;
      } else if (source === 'query') {
        req.validatedQuery = validated;
      } else {
        req.validatedParams = validated;
      }
      
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Validation failed',
        error: 'VALIDATION_ERROR'
      });
    }
  };
}

// Response validation schemas for API documentation and testing
export const DeploymentResponseSchema = z.object({
  id: z.string().cuid(),
  version: z.string(),
  status: z.enum(['PENDING', 'DEPLOYING', 'ACTIVE', 'INACTIVE', 'FAILED', 'ROLLED_BACK']),
  deployedUrl: z.string().url().optional(),
  config: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  deployedAt: z.date().optional(),
  rollbackAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  promptId: z.string().cuid(),
  environmentId: z.string().cuid(),
  deployedBy: z.string().cuid(),
  environment: z.object({
    id: z.string().cuid(),
    name: z.string(),
    type: z.enum(['STAGING', 'PRODUCTION', 'DEVELOPMENT', 'PREVIEW']),
    description: z.string().optional(),
    config: z.record(z.any()).optional(),
    isActive: z.boolean(),
    projectId: z.string().cuid(),
    createdAt: z.date(),
    updatedAt: z.date()
  }),
  deployedByUser: z.object({
    id: z.string().cuid(),
    name: z.string(),
    email: z.string().email()
  })
});

export const ImpactAnalysisResponseSchema = z.object({
  id: z.string().cuid(),
  impactPercentage: z.number().min(0).max(100),
  diffAnalysis: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    modified: z.array(z.object({
      field: z.string(),
      oldValue: z.string(),
      newValue: z.string()
    }))
  }),
  sampleComparisons: z.array(z.object({
    input: z.string(),
    currentOutput: z.string(),
    newOutput: z.string(),
    score: z.number().min(0).max(1)
  })),
  createdAt: z.date(),
  deploymentId: z.string(),
  baselinePromptId: z.string().optional()
});

export const CostDataResponseSchema = z.object({
  thisMonth: z.number().min(0),
  limit: z.number().min(0),
  lastTest: z.number().min(0),
  breakdown: z.object({
    byModel: z.record(z.number()),
    byUser: z.record(z.number()),
    byProject: z.record(z.number())
  })
});