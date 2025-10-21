import { OpenAI } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

// Provider configurations
const providerSchema = z.object({
  provider: z.enum(['openai', 'groq', 'anthropic', 'local']),
  modelName: z.string(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

export interface LLMConfig {
  provider: 'openai' | 'groq' | 'anthropic' | 'local';
  modelName: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMResponse {
  output: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  cost?: number;
  error?: string;
  rawResponse?: any;
}

export interface ModelInfo {
  provider: string;
  name: string;
  displayName: string;
  description?: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  supportsSystemPrompt: boolean;
  supportsFunctionCalling: boolean;
}

// Model registry with pricing information
export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  'openai/gpt-4': {
    provider: 'openai',
    name: 'gpt-4',
    displayName: 'GPT-4',
    description: 'Most capable GPT-4 model',
    inputCostPer1k: 0.03,
    outputCostPer1k: 0.06,
    maxTokens: 8192,
    supportsSystemPrompt: true,
    supportsFunctionCalling: true,
  },
  'openai/gpt-4-turbo': {
    provider: 'openai',
    name: 'gpt-4-turbo-preview',
    displayName: 'GPT-4 Turbo',
    description: 'Faster and cheaper GPT-4',
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    maxTokens: 128000,
    supportsSystemPrompt: true,
    supportsFunctionCalling: true,
  },
  'openai/gpt-3.5-turbo': {
    provider: 'openai',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    description: 'Fast and cost-effective',
    inputCostPer1k: 0.0015,
    outputCostPer1k: 0.002,
    maxTokens: 4096,
    supportsSystemPrompt: true,
    supportsFunctionCalling: true,
  },
  'groq/llama2-70b-4096': {
    provider: 'groq',
    name: 'llama2-70b-4096',
    displayName: 'Llama 2 70B',
    description: 'High-performance open source model',
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.0008,
    maxTokens: 4096,
    supportsSystemPrompt: true,
    supportsFunctionCalling: false,
  },
  'groq/mixtral-8x7b-32768': {
    provider: 'groq',
    name: 'mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B',
    description: 'Efficient mixture of experts model',
    inputCostPer1k: 0.0006,
    outputCostPer1k: 0.0006,
    maxTokens: 32768,
    supportsSystemPrompt: true,
    supportsFunctionCalling: false,
  },
  'anthropic/claude-3-opus': {
    provider: 'anthropic',
    name: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    description: 'Most capable Claude model',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    maxTokens: 4096,
    supportsSystemPrompt: true,
    supportsFunctionCalling: true,
  },
  'anthropic/claude-3-sonnet': {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
    displayName: 'Claude 3 Sonnet',
    description: 'Balanced performance and speed',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    maxTokens: 4096,
    supportsSystemPrompt: true,
    supportsFunctionCalling: true,
  },
};

export class LLMService {
  /**
   * Send a prompt to an LLM and get response
   */
  static async generateResponse(
    prompt: string,
    config: LLMConfig,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const validated = providerSchema.parse(config);

    try {
      let response: LLMResponse;

      switch (validated.provider) {
        case 'openai':
          response = await this.callOpenAI(prompt, validated as LLMConfig, systemPrompt);
          break;
        case 'groq':
          response = await this.callGroq(prompt, validated as LLMConfig, systemPrompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(prompt, validated as LLMConfig, systemPrompt);
          break;
        case 'local':
          response = await this.callLocalModel(prompt, validated as LLMConfig, systemPrompt);
          break;
        default:
          throw new Error(`Unsupported provider: ${validated.provider}`);
      }

      response.latencyMs = Date.now() - startTime;
      response.cost = this.calculateCost(
        `${validated.provider}/${validated.modelName}`,
        response.tokenUsage
      );

      return response;
    } catch (error) {
      return {
        output: '',
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(
    prompt: string,
    config: LLMConfig,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const model = new ChatOpenAI({
      modelName: config.modelName,
      openAIApiKey: config.apiKey || process.env.OPENAI_API_KEY,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
    });

    const messages = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(new HumanMessage(prompt));

    const response = await model.invoke(messages);

    return {
      output: response.content as string,
      tokenUsage: (response as any).usage_metadata ? {
        promptTokens: (response as any).usage_metadata.input_tokens,
        completionTokens: (response as any).usage_metadata.output_tokens,
        totalTokens: (response as any).usage_metadata.total_tokens,
      } : undefined,
      latencyMs: 0, // Will be set by caller
      rawResponse: response,
    };
  }

  /**
   * Call Groq API
   */
  private static async callGroq(
    prompt: string,
    config: LLMConfig,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const model = new ChatOpenAI({
      modelName: config.modelName,
      openAIApiKey: config.apiKey || process.env.GROQ_API_KEY,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    const messages = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(new HumanMessage(prompt));

    const response = await model.invoke(messages);

    return {
      output: response.content as string,
      tokenUsage: (response as any).usage_metadata ? {
        promptTokens: (response as any).usage_metadata.input_tokens,
        completionTokens: (response as any).usage_metadata.output_tokens,
        totalTokens: (response as any).usage_metadata.total_tokens,
      } : undefined,
      latencyMs: 0,
      rawResponse: response,
    };
  }

  /**
   * Call Anthropic API
   */
  private static async callAnthropic(
    prompt: string,
    config: LLMConfig,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    // For now, we'll implement a basic HTTP call to Anthropic
    // In production, use the official Anthropic SDK
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.modelName,
        max_tokens: config.maxTokens || 1024,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      output: data.content?.[0]?.text || '',
      tokenUsage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      latencyMs: 0,
      rawResponse: data,
    };
  }

  /**
   * Call local model (placeholder)
   */
  private static async callLocalModel(
    prompt: string,
    config: LLMConfig,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    // This would integrate with local models like Ollama
    // For now, return a mock response
    const mockResponse = `Local model (${config.modelName}) response to: ${prompt.substring(0, 50)}...`;
    
    return {
      output: mockResponse,
      tokenUsage: {
        promptTokens: Math.floor(prompt.length / 4),
        completionTokens: Math.floor(mockResponse.length / 4),
        totalTokens: Math.floor((prompt.length + mockResponse.length) / 4),
      },
      latencyMs: 0,
      cost: 0, // Local models are free
    };
  }

  /**
   * Calculate cost based on token usage
   */
  private static calculateCost(
    modelKey: string,
    tokenUsage?: { promptTokens: number; completionTokens: number }
  ): number {
    if (!tokenUsage) return 0;

    const modelInfo = MODEL_REGISTRY[modelKey];
    if (!modelInfo) return 0;

    const inputCost = (tokenUsage.promptTokens / 1000) * modelInfo.inputCostPer1k;
    const outputCost = (tokenUsage.completionTokens / 1000) * modelInfo.outputCostPer1k;

    return inputCost + outputCost;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): ModelInfo[] {
    return Object.values(MODEL_REGISTRY);
  }

  /**
   * Get model info by key
   */
  static getModelInfo(modelKey: string): ModelInfo | undefined {
    return MODEL_REGISTRY[modelKey];
  }

  /**
   * Test model connectivity
   */
  static async testModel(config: LLMConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.generateResponse(
        'Hello, this is a test prompt. Please respond with "Test successful".',
        config
      );

      if (response.error) {
        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch process multiple prompts
   */
  static async batchGenerate(
    prompts: string[],
    config: LLMConfig,
    systemPrompt?: string,
    concurrency: number = 3
  ): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < prompts.length; i += concurrency) {
      const batch = prompts.slice(i, i + concurrency);
      const batchPromises = batch.map(prompt =>
        this.generateResponse(prompt, config, systemPrompt)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + concurrency < prompts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}