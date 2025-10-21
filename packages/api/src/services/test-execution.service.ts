import { PrismaClient, TestRun, TestResponse } from '../generated/client';
import { TestRunStatus } from '../types/enums';
import { LLMService, LLMConfig } from './llm.service';
import { QueueService } from './queue.service';
import { ProjectService } from './project.service';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const testRunConfigSchema = z.object({
  models: z.array(z.object({
    provider: z.enum(['openai', 'groq', 'anthropic', 'local']),
    modelName: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().positive().optional(),
  })).min(1),
  testInputs: z.array(z.string()).min(1),
  systemPrompt: z.string().optional(),
  evaluationCriteria: z.array(z.object({
    name: z.string(),
    description: z.string(),
    weight: z.number().min(0).max(1).default(1),
  })).optional(),
  iterations: z.number().min(1).max(10).default(1),
  concurrency: z.number().min(1).max(5).default(3),
});

const createTestRunSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  promptId: z.string(),
  config: testRunConfigSchema,
});

export interface TestRunConfig {
  models: {
    provider: 'openai' | 'groq' | 'anthropic' | 'local';
    modelName: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
  }[];
  testInputs: string[];
  systemPrompt?: string;
  evaluationCriteria?: {
    name: string;
    description: string;
    weight: number;
  }[];
  iterations?: number;
  concurrency?: number;
}

export interface CreateTestRunRequest {
  name: string;
  description?: string;
  promptId: string;
  config: TestRunConfig;
}

export interface TestExecutionProgress {
  testRunId: string;
  status: TestRunStatus;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  currentTask?: string;
  estimatedTimeRemaining?: number;
}

export class TestExecutionService {
  /**
   * Create and queue a new test run
   */
  static async createTestRun(
    projectId: string,
    userId: string,
    data: CreateTestRunRequest
  ): Promise<TestRun> {
    const validated = createTestRunSchema.parse(data);

    // Check project access
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create test runs');
    }

    // Verify prompt belongs to project
    const prompt = await prisma.prompt.findFirst({
      where: {
        id: validated.promptId,
        projectId,
      },
    });

    if (!prompt) {
      throw new NotFoundError('Prompt not found in this project');
    }

    // Calculate total test count
    const totalTests = validated.config.models.length * 
                      validated.config.testInputs.length * 
                      (validated.config.iterations || 1);

    // Create test run
    const testRun = await prisma.testRun.create({
      data: {
        name: validated.name,
        description: validated.description,
        projectId,
        userId,
        promptId: validated.promptId,
        config: validated.config,
        metadata: {
          totalTests,
          estimatedDuration: totalTests * 2000, // 2 seconds per test estimate
        },
      },
    });

    // Queue the test execution
    await QueueService.addJob('test_execution', {
      testRunId: testRun.id,
      promptContent: prompt.content,
      outputSchema: prompt.outputSchema,
      outputFormat: prompt.outputFormat,
      config: validated.config,
    });

    return testRun;
  }

  /**
   * Execute a test run (called by queue worker)
   */
  static async executeTestRun(testRunId: string): Promise<void> {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: { prompt: true },
    });

    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    try {
      // Update status to in progress
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status: TestRunStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      const config = testRun.config as unknown as TestRunConfig;
      const prompt = testRun.prompt;

      let completedTests = 0;
      const totalTests = config.models.length * config.testInputs.length * (config.iterations || 1);

      // Execute tests for each model
      for (const modelConfig of config.models) {
        for (let iteration = 0; iteration < (config.iterations || 1); iteration++) {
          // Process test inputs in batches
          const responses = await LLMService.batchGenerate(
            config.testInputs,
            modelConfig as LLMConfig,
            config.systemPrompt,
            config.concurrency || 3
          );

          // Save responses
          for (let i = 0; i < config.testInputs.length; i++) {
            const response = responses[i];
            
            // Parse output if schema is provided
            let parsedOutput = null;
            let outputStructure = null;
            
            if (prompt.outputSchema && !response.error) {
              try {
                parsedOutput = this.parseOutput(response.output, prompt.outputFormat, prompt.outputSchema);
                outputStructure = this.analyzeOutputStructure(response.output, prompt.outputFormat);
              } catch (error) {
                // Parsing failed, keep original output
              }
            }

            await prisma.testResponse.create({
              data: {
                testRunId,
                modelProvider: modelConfig.provider,
                modelName: modelConfig.modelName,
                input: config.testInputs[i],
                output: response.output,
                parsedOutput,
                outputStructure,
                tokenUsage: response.tokenUsage,
                latencyMs: response.latencyMs,
                cost: response.cost,
                error: response.error,
                rawResponse: response.rawResponse,
              },
            });

            completedTests++;
            
            // Update progress periodically
            if (completedTests % 5 === 0) {
              await this.updateProgress(testRunId, completedTests, totalTests);
            }
          }
        }
      }

      // Calculate final metrics
      await this.calculateTestMetrics(testRunId);

      // Mark as completed
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status: TestRunStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

    } catch (error) {
      // Mark as failed
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status: TestRunStatus.FAILED,
          completedAt: new Date(),
          metadata: {
            ...(testRun.metadata as any || {}),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });
      throw error;
    }
  }

  /**
   * Parse output based on expected format and schema
   */
  private static parseOutput(
    output: string,
    outputFormat?: string | null,
    outputSchema?: any
  ): any {
    if (!outputFormat) return null;

    switch (outputFormat) {
      case 'json':
        try {
          return JSON.parse(output);
        } catch {
          // Try to extract JSON from text
          const jsonMatch = output.match(/\{.*\}/s);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          return null;
        }
      
      case 'structured':
        // Parse structured text based on schema
        return this.parseStructuredText(output, outputSchema);
      
      case 'markdown':
        return this.parseMarkdown(output);
      
      default:
        return output;
    }
  }

  /**
   * Analyze output structure for display purposes
   */
  private static analyzeOutputStructure(output: string, outputFormat?: string | null): any {
    const structure = {
      type: outputFormat || 'text',
      length: output.length,
      wordCount: output.split(/\s+/).length,
      lineCount: output.split('\n').length,
    };

    if (outputFormat === 'json') {
      try {
        const parsed = JSON.parse(output);
        return {
          ...structure,
          isValidJson: true,
          keys: Object.keys(parsed),
          structure: this.getJsonStructure(parsed),
        };
      } catch {
        return { ...structure, isValidJson: false };
      }
    }

    if (outputFormat === 'markdown') {
      const headings = (output.match(/^#+\s+.*/gm) || []).length;
      const codeBlocks = (output.match(/```[\s\S]*?```/g) || []).length;
      const links = (output.match(/\[.*?\]\(.*?\)/g) || []).length;
      
      return {
        ...structure,
        headings,
        codeBlocks,
        links,
      };
    }

    return structure;
  }

  /**
   * Parse structured text based on schema
   */
  private static parseStructuredText(text: string, schema: any): any {
    // This would implement custom parsing logic based on the schema
    // For now, return a simple line-based structure
    const lines = text.split('\n').filter(line => line.trim());
    return {
      lines,
      sections: lines.filter(line => line.match(/^[A-Z][^:]*:/)),
    };
  }

  /**
   * Parse markdown content
   */
  private static parseMarkdown(text: string): any {
    const headings = text.match(/^#+\s+(.*)$/gm) || [];
    const codeBlocks = text.match(/```([\s\S]*?)```/g) || [];
    const links = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    
    return {
      headings: headings.map(h => h.trim()),
      codeBlocks: codeBlocks.map(cb => cb.replace(/```/g, '').trim()),
      links: links.map(link => {
        const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
        return match ? { text: match[1], url: match[2] } : null;
      }).filter(Boolean),
    };
  }

  /**
   * Get JSON structure for analysis
   */
  private static getJsonStructure(obj: any, depth = 0): any {
    if (depth > 3) return 'deep_object';
    
    if (Array.isArray(obj)) {
      return {
        type: 'array',
        length: obj.length,
        itemType: obj.length > 0 ? this.getJsonStructure(obj[0], depth + 1) : 'unknown',
      };
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const structure: any = { type: 'object', keys: {} };
      for (const [key, value] of Object.entries(obj)) {
        structure.keys[key] = this.getJsonStructure(value, depth + 1);
      }
      return structure;
    }
    
    return typeof obj;
  }

  /**
   * Update test progress
   */
  private static async updateProgress(
    testRunId: string,
    completed: number,
    total: number
  ): Promise<void> {
    const percentage = Math.round((completed / total) * 100);
    
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        metadata: {
          progress: {
            completed,
            total,
            percentage,
          },
        },
      },
    });
  }

  /**
   * Calculate test metrics
   */
  private static async calculateTestMetrics(testRunId: string): Promise<void> {
    const responses = await prisma.testResponse.findMany({
      where: { testRunId },
    });

    if (responses.length === 0) return;

    // Calculate aggregate metrics
    const totalCost = responses.reduce((sum, r) => sum + (r.cost || 0), 0);
    const avgLatency = responses.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / responses.length;
    const totalTokens = responses.reduce((sum, r) => {
      const usage = r.tokenUsage as any;
      return sum + (usage?.totalTokens || 0);
    }, 0);
    const errorRate = responses.filter(r => r.error).length / responses.length;

    // Group by model for comparison
    const byModel = responses.reduce((acc, response) => {
      const key = `${response.modelProvider}/${response.modelName}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(response);
      return acc;
    }, {} as Record<string, TestResponse[]>);

    const metrics = [
      { name: 'total_cost', value: totalCost, unit: 'dollars' },
      { name: 'avg_latency', value: avgLatency, unit: 'milliseconds' },
      { name: 'total_tokens', value: totalTokens, unit: 'tokens' },
      { name: 'error_rate', value: errorRate, unit: 'percentage' },
      { name: 'total_responses', value: responses.length, unit: 'count' },
    ];

    // Add per-model metrics
    for (const [modelKey, modelResponses] of Object.entries(byModel)) {
      const modelCost = modelResponses.reduce((sum, r) => sum + (r.cost || 0), 0);
      const modelLatency = modelResponses.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / modelResponses.length;
      const modelErrors = modelResponses.filter(r => r.error).length;

      metrics.push(
        { name: `${modelKey}_cost`, value: modelCost, unit: 'dollars' },
        { name: `${modelKey}_avg_latency`, value: modelLatency, unit: 'milliseconds' },
        { name: `${modelKey}_error_count`, value: modelErrors, unit: 'count' }
      );
    }

    // Save metrics
    await prisma.testMetric.createMany({
      data: metrics.map(metric => ({
        testRunId,
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
      })),
    });
  }

  /**
   * Get test run with results
   */
  static async getTestRunResults(testRunId: string, userId: string) {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        prompt: true,
        responses: {
          orderBy: { createdAt: 'asc' },
        },
        metrics: true,
      },
    });

    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    // Check project access
    const userRole = await ProjectService.getUserProjectRole(testRun.projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to test run');
    }

    return testRun;
  }

  /**
   * Cancel a test run
   */
  static async cancelTestRun(testRunId: string, userId: string): Promise<void> {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    // Check project access
    const userRole = await ProjectService.getUserProjectRole(testRun.projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to cancel test run');
    }

    // Only allow canceling pending or in-progress tests
    if (!['PENDING', 'IN_PROGRESS'].includes(testRun.status)) {
      throw new ValidationError('Cannot cancel completed or failed test run');
    }

    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: TestRunStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    // Remove from queue if pending
    if (testRun.status === 'PENDING') {
      await QueueService.removeJob(testRunId);
    }
  }

  /**
   * Get test run progress
   */
  static async getTestProgress(testRunId: string, userId: string): Promise<TestExecutionProgress> {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    // Check project access
    const userRole = await ProjectService.getUserProjectRole(testRun.projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to test run');
    }

    const metadata = testRun.metadata as any;
    const progress = metadata?.progress || { completed: 0, total: 1, percentage: 0 };

    return {
      testRunId,
      status: testRun.status,
      progress,
      currentTask: metadata?.currentTask,
      estimatedTimeRemaining: metadata?.estimatedTimeRemaining,
    };
  }
}