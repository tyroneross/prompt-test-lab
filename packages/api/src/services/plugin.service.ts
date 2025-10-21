import {
  AnyPlugin,
  EvaluatorPlugin,
  DiffPlugin,
  PluginRegistry,
  PluginContext,
  PluginResult,
  EvaluationResult,
  DiffResult,
  BuiltInEvaluators,
  BuiltInDiffAlgorithms,
} from '../interfaces/plugin.interfaces';
import { PrismaClient } from '../generated/client';
import { ValidationError } from '@prompt-lab/shared';

const prisma = new PrismaClient();

export class PluginService implements PluginRegistry {
  private plugins: Map<string, AnyPlugin> = new Map();

  constructor() {
    this.initializeBuiltInPlugins();
  }

  /**
   * Initialize built-in plugins
   */
  private initializeBuiltInPlugins(): void {
    // Register built-in evaluators
    this.register(new SimilarityEvaluator());
    this.register(new SentimentEvaluator());
    this.register(new ToxicityEvaluator());
    this.register(new RelevanceEvaluator());
    
    // Register built-in diff algorithms
    this.register(new LevenshteinDiff());
    this.register(new SemanticDiff());
    this.register(new WordDiff());
  }

  /**
   * Register a plugin
   */
  register(plugin: AnyPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): AnyPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get plugins by type
   */
  getByType<T extends AnyPlugin>(type: T['type']): T[] {
    return Array.from(this.plugins.values()).filter(p => p.type === type) as T[];
  }

  /**
   * List all plugins
   */
  list(): AnyPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Enable a plugin
   */
  enable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
    }
  }

  /**
   * Disable a plugin
   */
  disable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
    }
  }

  /**
   * Evaluate a response using specified criteria
   */
  async evaluateResponse(
    context: PluginContext,
    criteriaList: Array<{
      name: string;
      pluginId: string;
      config: any;
      weight: number;
    }>
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const criteria of criteriaList) {
      const plugin = this.get(criteria.pluginId);
      
      if (!plugin || plugin.type !== 'evaluator' || !plugin.enabled) {
        results.push({
          criteriaName: criteria.name,
          score: 0,
          maxScore: 1,
          passed: false,
          error: `Plugin ${criteria.pluginId} not found or disabled`,
        });
        continue;
      }

      try {
        const evaluator = plugin as EvaluatorPlugin;
        const result = await evaluator.evaluate(context);
        
        if (result.success) {
          results.push({
            criteriaName: criteria.name,
            score: result.data?.score || 0,
            maxScore: result.data?.maxScore || 1,
            passed: result.data?.passed || false,
            details: result.data?.details,
          });
        } else {
          results.push({
            criteriaName: criteria.name,
            score: 0,
            maxScore: 1,
            passed: false,
            error: result.error,
          });
        }
      } catch (error) {
        results.push({
          criteriaName: criteria.name,
          score: 0,
          maxScore: 1,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Compare two responses using a diff algorithm
   */
  async compareResponses(
    baseline: string,
    candidate: string,
    diffAlgorithm: string = BuiltInDiffAlgorithms.SEMANTIC,
    options?: Record<string, any>
  ): Promise<DiffResult> {
    const plugin = this.get(diffAlgorithm);
    
    if (!plugin || plugin.type !== 'diff' || !plugin.enabled) {
      throw new ValidationError(`Diff algorithm ${diffAlgorithm} not found or disabled`);
    }

    const diffPlugin = plugin as DiffPlugin;
    const result = await diffPlugin.compare(baseline, candidate, options);
    
    if (!result.success) {
      throw new Error(result.error || 'Diff comparison failed');
    }

    return result.data as DiffResult;
  }

  /**
   * Get available evaluators
   */
  getAvailableEvaluators(): EvaluatorPlugin[] {
    return this.getByType<EvaluatorPlugin>('evaluator').filter(p => p.enabled);
  }

  /**
   * Get available diff algorithms
   */
  getAvailableDiffAlgorithms(): DiffPlugin[] {
    return this.getByType<DiffPlugin>('diff').filter(p => p.enabled);
  }

  /**
   * Save plugin configuration to database
   */
  async savePluginConfig(projectId: string, pluginId: string, config: any): Promise<void> {
    await prisma.evaluationPlugin.upsert({
      where: { name: pluginId },
      update: { config, isActive: true },
      create: {
        name: pluginId,
        version: '1.0.0',
        description: `Configuration for ${pluginId}`,
        config,
        isActive: true,
      },
    });
  }

  /**
   * Load plugin configuration from database
   */
  async loadPluginConfig(pluginId: string): Promise<any> {
    const config = await prisma.evaluationPlugin.findUnique({
      where: { name: pluginId },
    });

    return config?.config || {};
  }
}

// Built-in Evaluator Implementations

class SimilarityEvaluator implements EvaluatorPlugin {
  id = BuiltInEvaluators.SIMILARITY;
  name = 'Similarity Evaluator';
  version = '1.0.0';
  description = 'Measures text similarity using various algorithms';
  type = 'evaluator' as const;
  enabled = true;
  config = {};

  async evaluate(context: PluginContext): Promise<PluginResult> {
    try {
      // Simple word-based similarity for demo
      const prompt = context.promptContent.toLowerCase();
      const response = context.modelResponse.toLowerCase();
      
      const promptWords = new Set(prompt.split(/\s+/));
      const responseWords = new Set(response.split(/\s+/));
      
      const intersection = new Set([...promptWords].filter(x => responseWords.has(x)));
      const union = new Set([...promptWords, ...responseWords]);
      
      const similarity = intersection.size / union.size;
      const score = Math.min(similarity * 2, 1); // Scale to 0-1
      
      return {
        success: true,
        data: {
          score,
          maxScore: 1,
          passed: score > 0.5,
          details: {
            similarity,
            sharedWords: intersection.size,
            totalWords: union.size,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Similarity evaluation failed',
      };
    }
  }

  getConfigSchema() {
    return require('zod').z.object({
      threshold: require('zod').z.number().min(0).max(1).default(0.5),
    });
  }
}

class SentimentEvaluator implements EvaluatorPlugin {
  id = BuiltInEvaluators.SENTIMENT;
  name = 'Sentiment Evaluator';
  version = '1.0.0';
  description = 'Analyzes sentiment of the response';
  type = 'evaluator' as const;
  enabled = true;
  config = {};

  async evaluate(context: PluginContext): Promise<PluginResult> {
    try {
      // Simple keyword-based sentiment analysis for demo
      const response = context.modelResponse.toLowerCase();
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'positive'];
      const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'negative', 'poor'];
      
      const positiveCount = positiveWords.filter(word => response.includes(word)).length;
      const negativeCount = negativeWords.filter(word => response.includes(word)).length;
      
      const sentiment = positiveCount - negativeCount;
      const score = Math.max(0, Math.min(1, (sentiment + 5) / 10)); // Normalize to 0-1
      
      return {
        success: true,
        data: {
          score,
          maxScore: 1,
          passed: sentiment >= 0,
          details: {
            sentiment: sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral',
            positiveWords: positiveCount,
            negativeWords: negativeCount,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sentiment evaluation failed',
      };
    }
  }

  getConfigSchema() {
    return require('zod').z.object({
      requiredSentiment: require('zod').z.enum(['positive', 'negative', 'neutral']).default('positive'),
    });
  }
}

class ToxicityEvaluator implements EvaluatorPlugin {
  id = BuiltInEvaluators.TOXICITY;
  name = 'Toxicity Evaluator';
  version = '1.0.0';
  description = 'Detects toxic content in responses';
  type = 'evaluator' as const;
  enabled = true;
  config = {};

  async evaluate(context: PluginContext): Promise<PluginResult> {
    try {
      // Simple keyword-based toxicity detection for demo
      const response = context.modelResponse.toLowerCase();
      const toxicWords = ['hate', 'kill', 'die', 'stupid', 'idiot', 'shut up'];
      
      const toxicCount = toxicWords.filter(word => response.includes(word)).length;
      const toxicityScore = Math.min(1, toxicCount / 3); // Normalize
      const score = 1 - toxicityScore; // Higher score = less toxic
      
      return {
        success: true,
        data: {
          score,
          maxScore: 1,
          passed: toxicityScore < 0.3,
          details: {
            toxicityLevel: toxicityScore < 0.1 ? 'low' : toxicityScore < 0.5 ? 'medium' : 'high',
            toxicWords: toxicCount,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Toxicity evaluation failed',
      };
    }
  }

  getConfigSchema() {
    return require('zod').z.object({
      threshold: require('zod').z.number().min(0).max(1).default(0.3),
    });
  }
}

class RelevanceEvaluator implements EvaluatorPlugin {
  id = BuiltInEvaluators.RELEVANCE;
  name = 'Relevance Evaluator';
  version = '1.0.0';
  description = 'Evaluates response relevance to the prompt';
  type = 'evaluator' as const;
  enabled = true;
  config = {};

  async evaluate(context: PluginContext): Promise<PluginResult> {
    try {
      // Simple keyword overlap for relevance
      const promptWords = context.promptContent.toLowerCase().split(/\s+/);
      const responseWords = context.modelResponse.toLowerCase().split(/\s+/);
      
      const overlap = promptWords.filter(word => responseWords.includes(word)).length;
      const relevanceScore = Math.min(1, overlap / Math.max(1, promptWords.length * 0.3));
      
      return {
        success: true,
        data: {
          score: relevanceScore,
          maxScore: 1,
          passed: relevanceScore > 0.4,
          details: {
            overlappingWords: overlap,
            promptWords: promptWords.length,
            relevanceRatio: overlap / promptWords.length,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Relevance evaluation failed',
      };
    }
  }

  getConfigSchema() {
    return require('zod').z.object({
      threshold: require('zod').z.number().min(0).max(1).default(0.4),
    });
  }
}

// Built-in Diff Algorithm Implementations

class LevenshteinDiff implements DiffPlugin {
  id = BuiltInDiffAlgorithms.LEVENSHTEIN;
  name = 'Levenshtein Distance';
  version = '1.0.0';
  description = 'Character-level edit distance comparison';
  type = 'diff' as const;
  enabled = true;
  config = {};

  async compare(baseline: string, candidate: string): Promise<PluginResult> {
    try {
      const distance = this.levenshteinDistance(baseline, candidate);
      const maxLength = Math.max(baseline.length, candidate.length);
      const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);
      
      return {
        success: true,
        data: {
          similarity,
          differences: [], // Simplified for demo
          summary: {
            added: 0,
            removed: 0,
            modified: distance,
            unchanged: maxLength - distance,
          },
        } as DiffResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Levenshtein comparison failed',
      };
    }
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  getConfigSchema() {
    return require('zod').z.object({});
  }
}

class SemanticDiff implements DiffPlugin {
  id = BuiltInDiffAlgorithms.SEMANTIC;
  name = 'Semantic Similarity';
  version = '1.0.0';
  description = 'Meaning-based comparison using embeddings';
  type = 'diff' as const;
  enabled = true;
  config = {};

  async compare(baseline: string, candidate: string): Promise<PluginResult> {
    try {
      // Simplified semantic comparison using word overlap
      const baselineWords = new Set(baseline.toLowerCase().split(/\s+/));
      const candidateWords = new Set(candidate.toLowerCase().split(/\s+/));
      
      const intersection = new Set([...baselineWords].filter(x => candidateWords.has(x)));
      const union = new Set([...baselineWords, ...candidateWords]);
      
      const similarity = intersection.size / union.size;
      
      return {
        success: true,
        data: {
          similarity,
          differences: [],
          summary: {
            added: candidateWords.size - intersection.size,
            removed: baselineWords.size - intersection.size,
            modified: 0,
            unchanged: intersection.size,
          },
        } as DiffResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Semantic comparison failed',
      };
    }
  }

  getConfigSchema() {
    return require('zod').z.object({
      threshold: require('zod').z.number().min(0).max(1).default(0.7),
    });
  }
}

class WordDiff implements DiffPlugin {
  id = BuiltInDiffAlgorithms.WORD_DIFF;
  name = 'Word-level Diff';
  version = '1.0.0';
  description = 'Word-by-word comparison';
  type = 'diff' as const;
  enabled = true;
  config = {};

  async compare(baseline: string, candidate: string): Promise<PluginResult> {
    try {
      const baselineWords = baseline.split(/\s+/);
      const candidateWords = candidate.split(/\s+/);
      
      // Simple word-level comparison
      const maxLength = Math.max(baselineWords.length, candidateWords.length);
      let unchanged = 0;
      
      for (let i = 0; i < Math.min(baselineWords.length, candidateWords.length); i++) {
        if (baselineWords[i] === candidateWords[i]) {
          unchanged++;
        }
      }
      
      const similarity = maxLength === 0 ? 1 : unchanged / maxLength;
      
      return {
        success: true,
        data: {
          similarity,
          differences: [],
          summary: {
            added: Math.max(0, candidateWords.length - baselineWords.length),
            removed: Math.max(0, baselineWords.length - candidateWords.length),
            modified: Math.min(baselineWords.length, candidateWords.length) - unchanged,
            unchanged,
          },
        } as DiffResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Word diff comparison failed',
      };
    }
  }

  getConfigSchema() {
    return require('zod').z.object({});
  }
}

// Export singleton instance
export const pluginService = new PluginService();