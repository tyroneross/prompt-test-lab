import { PrismaClient } from '../generated/client';
import { TestRunStatus } from '../types/enums';
import { ValidationError, NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import { ProjectService } from './project.service';
import { PromptService } from './prompt.service';
import { LLMService } from './llm.service';
import { QueueService } from './queue.service';
import type { 
  TestPipelineConfig,
  TestPipelineExecution,
  TestPipelineResult,
  OptimizationSuggestion,
  TestScenario,
  EvaluationMetric,
  ModelConfig
} from '@prompt-lab/shared';

const prisma = new PrismaClient();

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

export interface PromptOptimizationConfig {
  iterationLimit: number;
  convergenceThreshold: number;
  optimizationStrategies: ('length_reduction' | 'clarity_improvement' | 'specificity_enhancement' | 'format_standardization')[];
  targetMetrics: {
    accuracy?: number;
    latency?: number;
    cost?: number;
    consistency?: number;
  };
}

/**
 * Service for managing comprehensive prompt testing pipelines
 */
export class TestingPipelineService {
  /**
   * Create a new testing pipeline
   */
  static async createPipeline(
    userId: string,
    projectId: string,
    config: TestPipelineConfig
  ): Promise<TestPipelineExecution> {
    // Check permissions
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new AuthorizationError('Insufficient permissions to create test pipelines');
    }

    // Validate pipeline configuration
    await this.validatePipelineConfig(config);

    // Create pipeline execution record
    const pipeline = await prisma.testPipeline.create({
      data: {
        projectId,
        name: config.name,
        description: config.description,
        config: config as any,
        status: 'PENDING',
        createdBy: userId,
        stages: {
          create: config.stages.map(stage => ({
            name: stage.name,
            type: stage.type,
            config: stage.config as any,
            order: stage.order,
            status: 'PENDING'
          }))
        }
      },
      include: {
        stages: true
      }
    });

    return this.formatPipelineExecution(pipeline);
  }

  /**
   * Execute testing pipeline for a prompt
   */
  static async executePipeline(
    userId: string,
    pipelineId: string,
    promptId: string,
    options: {
      baselinePromptId?: string;
      testDataset?: string[];
      runAsync?: boolean;
    } = {}
  ): Promise<TestPipelineResult> {
    const pipeline = await this.getPipelineById(pipelineId, userId);
    const prompt = await PromptService.getPromptById(promptId, userId);

    // Create execution record
    const execution = await prisma.pipelineExecution.create({
      data: {
        pipelineId,
        promptId,
        baselinePromptId: options.baselinePromptId,
        status: 'RUNNING',
        startedAt: new Date(),
        executedBy: userId,
        metadata: {
          testDataset: options.testDataset,
          options
        }
      }
    });

    if (options.runAsync) {
      // Queue the execution for background processing
      await QueueService.addJob({
        type: 'pipeline_execution',
        data: {
          executionId: execution.id,
          pipelineId,
          promptId,
          userId,
          options
        },
        priority: 1
      });

      return {
        id: execution.id,
        status: 'RUNNING',
        startedAt: execution.startedAt,
        stages: [],
        overallScore: 0,
        passedStages: 0,
        totalStages: pipeline.stages.length,
        optimizationSuggestions: []
      };
    }

    // Execute synchronously
    return this.runPipelineExecution(execution.id, pipeline, prompt, options);
  }

  /**
   * Run pipeline execution (can be called sync or async)
   */
  static async runPipelineExecution(
    executionId: string,
    pipeline: any,
    prompt: any,
    options: any
  ): Promise<TestPipelineResult> {
    const stages = pipeline.stages.sort((a: any, b: any) => a.order - b.order);
    const stageResults: any[] = [];
    let passedStages = 0;
    let overallScore = 0;

    try {
      for (const stage of stages) {
        console.log(`Executing stage: ${stage.name}`);
        
        const stageResult = await this.executeStage(
          stage,
          prompt,
          options,
          stageResults // Previous stage results for context
        );

        stageResults.push(stageResult);

        if (stageResult.passed) {
          passedStages++;
        }

        overallScore += stageResult.score || 0;

        // Update stage status
        await prisma.pipelineStage.update({
          where: { id: stage.id },
          data: {
            status: stageResult.passed ? 'COMPLETED' : 'FAILED',
            result: stageResult as any
          }
        });

        // Check if stage is required and failed
        if (stage.isRequired && !stageResult.passed) {
          console.log(`Required stage ${stage.name} failed, stopping pipeline`);
          break;
        }
      }

      const finalScore = stages.length > 0 ? overallScore / stages.length : 0;
      const success = passedStages === stages.length || 
                     (passedStages > 0 && stages.filter((s: any) => s.isRequired).every(
                       (s: any) => stageResults.find(r => r.stageId === s.id)?.passed
                     ));

      // Generate optimization suggestions
      const optimizationSuggestions = await this.generateOptimizationSuggestions(
        prompt,
        stageResults
      );

      // Update execution record
      await prisma.pipelineExecution.update({
        where: { id: executionId },
        data: {
          status: success ? 'COMPLETED' : 'FAILED',
          completedAt: new Date(),
          result: {
            overallScore: finalScore,
            passedStages,
            totalStages: stages.length,
            stages: stageResults,
            optimizationSuggestions
          } as any
        }
      });

      return {
        id: executionId,
        status: success ? 'COMPLETED' : 'FAILED',
        startedAt: new Date(),
        completedAt: new Date(),
        stages: stageResults,
        overallScore: finalScore,
        passedStages,
        totalStages: stages.length,
        optimizationSuggestions
      };

    } catch (error) {
      // Update execution as failed
      await prisma.pipelineExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Execute a single pipeline stage
   */
  private static async executeStage(
    stage: any,
    prompt: any,
    options: any,
    previousResults: any[]
  ): Promise<any> {
    const stageConfig = stage.config;
    const results: any = {
      stageId: stage.id,
      stageName: stage.name,
      stageType: stage.type,
      startedAt: new Date(),
      metrics: {},
      passed: false,
      score: 0
    };

    try {
      switch (stage.type) {
        case 'validation':
          Object.assign(results, await this.executeValidationStage(stage, prompt, stageConfig));
          break;
        case 'performance':
          Object.assign(results, await this.executePerformanceStage(stage, prompt, stageConfig));
          break;
        case 'quality':
          Object.assign(results, await this.executeQualityStage(stage, prompt, stageConfig));
          break;
        case 'comparison':
          Object.assign(results, await this.executeComparisonStage(stage, prompt, stageConfig, options));
          break;
        case 'optimization':
          Object.assign(results, await this.executeOptimizationStage(stage, prompt, stageConfig, previousResults));
          break;
        default:
          throw new ValidationError(`Unknown stage type: ${stage.type}`);
      }

      results.completedAt = new Date();
      results.passed = this.evaluateStageSuccess(results, stageConfig.successCriteria);
      
    } catch (error) {
      results.error = error instanceof Error ? error.message : 'Unknown error';
      results.completedAt = new Date();
      results.passed = false;
    }

    return results;
  }

  /**
   * Execute validation stage
   */
  private static async executeValidationStage(
    stage: any,
    prompt: any,
    config: any
  ): Promise<any> {
    const results = {
      metrics: {},
      details: {}
    };

    // Validate prompt structure
    results.metrics.hasContent = prompt.content && prompt.content.trim().length > 0;
    results.metrics.contentLength = prompt.content ? prompt.content.length : 0;
    results.metrics.hasInstructions = /instruction|task|goal|objective/i.test(prompt.content || '');
    results.metrics.hasExamples = /example|for instance|such as/i.test(prompt.content || '');

    // Validate output schema if provided
    if (prompt.outputSchema) {
      results.metrics.hasOutputSchema = true;
      results.metrics.outputSchemaValid = this.validateOutputSchema(prompt.outputSchema);
    }

    // Calculate validation score
    const validationChecks = Object.values(results.metrics).filter(v => typeof v === 'boolean');
    results.score = validationChecks.filter(Boolean).length / validationChecks.length * 100;

    return results;
  }

  /**
   * Execute performance stage
   */
  private static async executePerformanceStage(
    stage: any,
    prompt: any,
    config: any
  ): Promise<any> {
    const results = {
      metrics: {},
      details: { responses: [] }
    };

    const testInputs = config.testScenarios || this.generateDefaultTestInputs();
    let totalLatency = 0;
    let totalCost = 0;
    let successfulRequests = 0;

    for (const model of config.models) {
      for (const input of testInputs) {
        try {
          const startTime = Date.now();
          
          const response = await LLMService.generateResponse(
            `${prompt.content}\n\nInput: ${input}`,
            model
          );

          const latency = Date.now() - startTime;
          totalLatency += latency;
          totalCost += response.cost || 0;
          successfulRequests++;

          results.details.responses.push({
            model: `${model.provider}/${model.modelName}`,
            input,
            output: response.output,
            latency,
            cost: response.cost,
            tokenUsage: response.tokenUsage
          });

        } catch (error) {
          results.details.responses.push({
            model: `${model.provider}/${model.modelName}`,
            input,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    results.metrics.averageLatency = successfulRequests > 0 ? totalLatency / successfulRequests : 0;
    results.metrics.totalCost = totalCost;
    results.metrics.successRate = successfulRequests / (config.models.length * testInputs.length) * 100;
    results.score = results.metrics.successRate;

    return results;
  }

  /**
   * Execute quality stage
   */
  private static async executeQualityStage(
    stage: any,
    prompt: any,
    config: any
  ): Promise<any> {
    const results = {
      metrics: {},
      details: { evaluations: [] }
    };

    const testInputs = config.testScenarios || this.generateDefaultTestInputs();
    const qualityScores: number[] = [];

    for (const model of config.models) {
      for (const input of testInputs) {
        try {
          const response = await LLMService.generateResponse(
            `${prompt.content}\n\nInput: ${input}`,
            model
          );

          // Evaluate response quality using various metrics
          const qualityMetrics = await this.evaluateResponseQuality(
            input,
            response.output,
            prompt.outputSchema
          );

          results.details.evaluations.push({
            model: `${model.provider}/${model.modelName}`,
            input,
            output: response.output,
            qualityMetrics
          });

          qualityScores.push(qualityMetrics.overallScore);

        } catch (error) {
          results.details.evaluations.push({
            model: `${model.provider}/${model.modelName}`,
            input,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    results.metrics.averageQuality = qualityScores.length > 0 
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length 
      : 0;
    
    results.metrics.consistencyScore = this.calculateConsistency(qualityScores);
    results.score = results.metrics.averageQuality;

    return results;
  }

  /**
   * Execute comparison stage
   */
  private static async executeComparisonStage(
    stage: any,
    prompt: any,
    config: any,
    options: any
  ): Promise<any> {
    const results = {
      metrics: {},
      details: { comparisons: [] }
    };

    if (!options.baselinePromptId) {
      throw new ValidationError('Comparison stage requires a baseline prompt ID');
    }

    const baselinePrompt = await prisma.prompt.findUnique({
      where: { id: options.baselinePromptId }
    });

    if (!baselinePrompt) {
      throw new NotFoundError('Baseline prompt not found');
    }

    const testInputs = config.testScenarios || this.generateDefaultTestInputs();
    const improvementScores: number[] = [];

    for (const model of config.models) {
      for (const input of testInputs) {
        try {
          // Get responses from both prompts
          const [currentResponse, baselineResponse] = await Promise.all([
            LLMService.generateResponse(`${prompt.content}\n\nInput: ${input}`, model),
            LLMService.generateResponse(`${baselinePrompt.content}\n\nInput: ${input}`, model)
          ]);

          // Evaluate both responses
          const [currentQuality, baselineQuality] = await Promise.all([
            this.evaluateResponseQuality(input, currentResponse.output, prompt.outputSchema),
            this.evaluateResponseQuality(input, baselineResponse.output, baselinePrompt.outputSchema)
          ]);

          const improvementScore = currentQuality.overallScore - baselineQuality.overallScore;
          improvementScores.push(improvementScore);

          results.details.comparisons.push({
            model: `${model.provider}/${model.modelName}`,
            input,
            currentOutput: currentResponse.output,
            baselineOutput: baselineResponse.output,
            currentQuality: currentQuality.overallScore,
            baselineQuality: baselineQuality.overallScore,
            improvement: improvementScore
          });

        } catch (error) {
          results.details.comparisons.push({
            model: `${model.provider}/${model.modelName}`,
            input,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    results.metrics.averageImprovement = improvementScores.length > 0
      ? improvementScores.reduce((a, b) => a + b, 0) / improvementScores.length
      : 0;
    
    results.metrics.improvementConsistency = this.calculateConsistency(improvementScores);
    results.score = Math.max(0, results.metrics.averageImprovement + 50); // Normalize to 0-100

    return results;
  }

  /**
   * Execute optimization stage
   */
  private static async executeOptimizationStage(
    stage: any,
    prompt: any,
    config: any,
    previousResults: any[]
  ): Promise<any> {
    const results = {
      metrics: {},
      details: { optimizations: [] }
    };

    // Analyze previous stage results to identify optimization opportunities
    const optimizationSuggestions = await this.generateOptimizationSuggestions(
      prompt,
      previousResults
    );

    // Apply automatic optimizations if configured
    const optimizedVersions = await this.generateOptimizedVersions(
      prompt,
      optimizationSuggestions,
      config
    );

    results.details.optimizations = optimizedVersions;
    results.metrics.optimizationCount = optimizedVersions.length;
    results.metrics.potentialImprovement = optimizationSuggestions.reduce(
      (max, suggestion) => Math.max(max, suggestion.confidence),
      0
    );

    results.score = results.metrics.potentialImprovement;

    return results;
  }

  /**
   * Generate optimization suggestions based on test results
   */
  static async generateOptimizationSuggestions(
    prompt: any,
    stageResults: any[]
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze validation results
    const validationResult = stageResults.find(r => r.stageType === 'validation');
    if (validationResult) {
      if (!validationResult.metrics.hasInstructions) {
        suggestions.push({
          type: 'clarity_improvement',
          title: 'Add Clear Instructions',
          description: 'The prompt lacks clear instructions. Consider adding explicit task descriptions.',
          confidence: 0.8,
          impact: 'high',
          implementation: 'Add a clear instruction section at the beginning of the prompt.',
          example: 'Start with: "Your task is to..." or "Please provide..."'
        });
      }

      if (!validationResult.metrics.hasExamples) {
        suggestions.push({
          type: 'specificity_enhancement',
          title: 'Add Examples',
          description: 'Adding examples can improve output consistency and quality.',
          confidence: 0.7,
          impact: 'medium',
          implementation: 'Include 1-2 examples of desired input-output pairs.',
          example: 'Add: "For example: Input: X, Output: Y"'
        });
      }
    }

    // Analyze performance results
    const performanceResult = stageResults.find(r => r.stageType === 'performance');
    if (performanceResult) {
      if (performanceResult.metrics.averageLatency > 5000) {
        suggestions.push({
          type: 'length_reduction',
          title: 'Reduce Prompt Length',
          description: 'Long prompts increase latency. Consider making the prompt more concise.',
          confidence: 0.6,
          impact: 'medium',
          implementation: 'Remove redundant instructions and consolidate similar points.',
          example: 'Combine multiple similar instructions into one clear statement.'
        });
      }

      if (performanceResult.metrics.totalCost > 0.1) {
        suggestions.push({
          type: 'cost_optimization',
          title: 'Optimize for Cost',
          description: 'High token usage increases costs. Consider shorter, more direct prompts.',
          confidence: 0.7,
          impact: 'medium',
          implementation: 'Use more concise language and remove unnecessary details.',
          example: 'Replace verbose phrases with direct, actionable instructions.'
        });
      }
    }

    // Analyze quality results
    const qualityResult = stageResults.find(r => r.stageType === 'quality');
    if (qualityResult) {
      if (qualityResult.metrics.consistencyScore < 70) {
        suggestions.push({
          type: 'format_standardization',
          title: 'Standardize Output Format',
          description: 'Inconsistent outputs detected. Define a clear output format.',
          confidence: 0.8,
          impact: 'high',
          implementation: 'Specify exact output format requirements and constraints.',
          example: 'Add: "Respond in the following format: {field1: value1, field2: value2}"'
        });
      }
    }

    return suggestions;
  }

  // Helper methods

  private static async validatePipelineConfig(config: TestPipelineConfig): Promise<void> {
    if (!config.name || config.name.trim().length === 0) {
      throw new ValidationError('Pipeline name is required');
    }

    if (!config.stages || config.stages.length === 0) {
      throw new ValidationError('Pipeline must have at least one stage');
    }

    // Validate stage order
    const orders = config.stages.map(s => s.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new ValidationError('Stage orders must be unique');
    }
  }

  private static async getPipelineById(pipelineId: string, userId: string): Promise<any> {
    const pipeline = await prisma.testPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { order: 'asc' }
        },
        project: true
      }
    });

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Check user access to project
    await ProjectService.getProjectById(pipeline.projectId, userId);

    return pipeline;
  }

  private static formatPipelineExecution(pipeline: any): TestPipelineExecution {
    return {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      config: pipeline.config,
      status: pipeline.status,
      stages: pipeline.stages.map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        type: stage.type,
        config: stage.config,
        order: stage.order,
        status: stage.status
      })),
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt
    };
  }

  private static generateDefaultTestInputs(): string[] {
    return [
      "Analyze the quarterly sales performance for our software products.",
      "Explain the benefits of cloud computing to a non-technical audience.",
      "Create a project timeline for launching a new mobile application.",
      "Summarize the key findings from the customer satisfaction survey.",
      "Provide recommendations for improving team productivity."
    ];
  }

  private static async evaluateResponseQuality(
    input: string,
    output: string,
    outputSchema?: any
  ): Promise<any> {
    const metrics: any = {};

    // Basic quality metrics
    metrics.relevance = this.calculateRelevanceScore(input, output);
    metrics.completeness = this.calculateCompletenessScore(input, output);
    metrics.coherence = this.calculateCoherenceScore(output);
    metrics.accuracy = 0.75; // Placeholder - would need domain-specific evaluators

    // Schema compliance if provided
    if (outputSchema) {
      metrics.schemaCompliance = this.validateAgainstSchema(output, outputSchema);
    }

    // Calculate overall score
    const scores = Object.values(metrics).filter(v => typeof v === 'number') as number[];
    metrics.overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return metrics;
  }

  private static calculateRelevanceScore(input: string, output: string): number {
    // Simple keyword overlap approach - in production, use semantic similarity
    const inputWords = new Set(input.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const outputWords = new Set(output.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set([...inputWords].filter(x => outputWords.has(x)));
    return intersection.size / Math.max(inputWords.size, 1) * 100;
  }

  private static calculateCompletenessScore(input: string, output: string): number {
    // Heuristic based on output length and structure
    const hasStructure = /[\n\-\*\d\.]/.test(output);
    const lengthScore = Math.min(output.length / 200, 1) * 50;
    const structureScore = hasStructure ? 30 : 10;
    const detailScore = output.split(/[.!?]/).length > 2 ? 20 : 10;
    
    return lengthScore + structureScore + detailScore;
  }

  private static calculateCoherenceScore(output: string): number {
    // Simple coherence measures
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(' ').length, 0) / sentences.length;
    const lengthVariability = this.calculateVariability(sentences.map(s => s.trim().split(' ').length));
    
    // Optimal sentence length around 15-20 words
    const lengthScore = Math.max(0, 100 - Math.abs(avgSentenceLength - 17.5) * 2);
    const variabilityScore = Math.max(0, 100 - lengthVariability * 5);
    
    return (lengthScore + variabilityScore) / 2;
  }

  private static calculateVariability(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  private static calculateConsistency(scores: number[]): number {
    if (scores.length === 0) return 0;
    const variability = this.calculateVariability(scores);
    return Math.max(0, 100 - variability);
  }

  private static validateOutputSchema(schema: any): boolean {
    try {
      // Basic JSON schema validation
      return typeof schema === 'object' && schema !== null;
    } catch {
      return false;
    }
  }

  private static validateAgainstSchema(output: string, schema: any): number {
    try {
      const parsed = JSON.parse(output);
      // Simplified schema validation - in production, use a proper JSON schema validator
      const requiredFields = Object.keys(schema.properties || {});
      const presentFields = Object.keys(parsed);
      const matchedFields = requiredFields.filter(field => presentFields.includes(field));
      
      return matchedFields.length / Math.max(requiredFields.length, 1) * 100;
    } catch {
      return 0; // Not valid JSON
    }
  }

  private static evaluateStageSuccess(results: any, successCriteria: any[]): boolean {
    if (!successCriteria || successCriteria.length === 0) {
      return results.score >= 50; // Default threshold
    }

    return successCriteria.every(criteria => {
      const value = results.metrics[criteria.metric];
      if (value === undefined) return false;

      switch (criteria.operator) {
        case 'gt': return value > criteria.threshold;
        case 'gte': return value >= criteria.threshold;
        case 'lt': return value < criteria.threshold;
        case 'lte': return value <= criteria.threshold;
        case 'eq': return value === criteria.threshold;
        default: return false;
      }
    });
  }

  private static async generateOptimizedVersions(
    prompt: any,
    suggestions: OptimizationSuggestion[],
    config: any
  ): Promise<any[]> {
    const optimizations: any[] = [];

    // Apply high-confidence suggestions automatically
    const highConfidenceSuggestions = suggestions.filter(s => s.confidence >= 0.7);

    for (const suggestion of highConfidenceSuggestions) {
      const optimizedContent = await this.applyOptimization(prompt.content, suggestion);
      
      optimizations.push({
        type: suggestion.type,
        title: suggestion.title,
        originalContent: prompt.content,
        optimizedContent,
        confidence: suggestion.confidence,
        expectedImprovement: suggestion.impact
      });
    }

    return optimizations;
  }

  private static async applyOptimization(
    content: string,
    suggestion: OptimizationSuggestion
  ): Promise<string> {
    // Simple rule-based optimizations - in production, use LLM-based optimization
    switch (suggestion.type) {
      case 'length_reduction':
        return content.replace(/\s+/g, ' ').trim();
      
      case 'clarity_improvement':
        return `Task: ${content}\n\nPlease provide a clear, structured response.`;
      
      case 'format_standardization':
        return `${content}\n\nOutput format: Provide your response in a structured format with clear sections.`;
      
      case 'specificity_enhancement':
        return `${content}\n\nFor example: [Provide specific examples relevant to the task]`;
      
      default:
        return content;
    }
  }
}