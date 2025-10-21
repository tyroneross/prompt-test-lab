/**
 * LLM Service Unit Tests
 * 
 * Tests LLM integration functionality including provider communication,
 * response processing, error handling, and cost tracking.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { LLMService } from '../llm.service';
import { llmResponseFactory } from '../../tests/fixtures';

// Mock the LLM SDK modules
const mockOpenAIResponse = {
  content: 'OpenAI response',
  usage: { 
    prompt_tokens: 10, 
    completion_tokens: 20, 
    total_tokens: 30 
  }
};

const mockAnthropicResponse = {
  content: [{ text: 'Anthropic response' }],
  usage: {
    input_tokens: 15,
    output_tokens: 25
  }
};

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue(mockOpenAIResponse)
  }))
}));

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue(mockAnthropicResponse)
    }
  }))
}));

describe('LLMService', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = new LLMService();
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should generate response using OpenAI provider', async () => {
      const request = {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: 150
      };

      const result = await llmService.generateResponse(request);

      expect(result).toMatchObject({
        content: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        tokenCount: 30,
        cost: expect.any(Number),
        latency: expect.any(Number)
      });
    });

    it('should generate response using Anthropic provider', async () => {
      const request = {
        provider: 'anthropic' as const,
        model: 'claude-3-sonnet',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: 150
      };

      const result = await llmService.generateResponse(request);

      expect(result).toMatchObject({
        content: 'Anthropic response',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        tokenCount: 40, // input_tokens + output_tokens
        cost: expect.any(Number),
        latency: expect.any(Number)
      });
    });

    it('should handle variable substitution in prompts', async () => {
      const request = {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, {{name}}! Your age is {{age}}.',
        variables: { name: 'Alice', age: 30 },
        temperature: 0.7,
        maxTokens: 150
      };

      await llmService.generateResponse(request);

      // Verify the prompt was processed with variables
      const processedPrompt = llmService.processPromptVariables(
        request.prompt,
        request.variables
      );
      expect(processedPrompt).toBe('Hello, Alice! Your age is 30.');
    });

    it('should throw error for unsupported provider', async () => {
      const request = {
        provider: 'unsupported' as any,
        model: 'some-model',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: 150
      };

      await expect(llmService.generateResponse(request)).rejects.toThrow(
        'Unsupported provider: unsupported'
      );
    });

    it('should handle API errors gracefully', async () => {
      const request = {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: 150
      };

      // Mock API error
      const { ChatOpenAI } = await import('@langchain/openai');
      const mockInstance = new ChatOpenAI();
      (mockInstance.invoke as jest.Mock).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(llmService.generateResponse(request)).rejects.toThrow(
        'API rate limit exceeded'
      );
    });
  });

  describe('processPromptVariables', () => {
    it('should replace single variable', () => {
      const prompt = 'Hello, {{name}}!';
      const variables = { name: 'Alice' };

      const result = llmService.processPromptVariables(prompt, variables);

      expect(result).toBe('Hello, Alice!');
    });

    it('should replace multiple variables', () => {
      const prompt = 'Hello, {{name}}! You are {{age}} years old.';
      const variables = { name: 'Bob', age: 25 };

      const result = llmService.processPromptVariables(prompt, variables);

      expect(result).toBe('Hello, Bob! You are 25 years old.');
    });

    it('should handle missing variables by leaving placeholders', () => {
      const prompt = 'Hello, {{name}}! Your email is {{email}}.';
      const variables = { name: 'Charlie' };

      const result = llmService.processPromptVariables(prompt, variables);

      expect(result).toBe('Hello, Charlie! Your email is {{email}}.');
    });

    it('should handle nested object variables', () => {
      const prompt = 'Hello, {{user.name}}! Your role is {{user.role}}.';
      const variables = { user: { name: 'Diana', role: 'admin' } };

      const result = llmService.processPromptVariables(prompt, variables);

      expect(result).toBe('Hello, Diana! Your role is admin.');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for OpenAI models', () => {
      const cost = llmService.calculateCost('openai', 'gpt-3.5-turbo', 1000);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should calculate cost for Anthropic models', () => {
      const cost = llmService.calculateCost('anthropic', 'claude-3-sonnet', 1000);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should return 0 for unknown models', () => {
      const cost = llmService.calculateCost('openai', 'unknown-model', 1000);
      expect(cost).toBe(0);
    });
  });

  describe('validateRequest', () => {
    it('should validate valid request', () => {
      const request = {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: 150
      };

      expect(() => llmService.validateRequest(request)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const request = {
        provider: 'openai' as const,
        // missing model
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: 150
      } as any;

      expect(() => llmService.validateRequest(request)).toThrow();
    });

    it('should throw error for invalid temperature', () => {
      const request = {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 2.5, // Invalid: > 2.0
        maxTokens: 150
      };

      expect(() => llmService.validateRequest(request)).toThrow(
        'Temperature must be between 0 and 2'
      );
    });

    it('should throw error for invalid maxTokens', () => {
      const request = {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, world!',
        variables: {},
        temperature: 0.7,
        maxTokens: -10 // Invalid: negative
      };

      expect(() => llmService.validateRequest(request)).toThrow(
        'Max tokens must be positive'
      );
    });
  });

  describe('batch processing', () => {
    it('should process multiple requests concurrently', async () => {
      const requests = [
        {
          provider: 'openai' as const,
          model: 'gpt-3.5-turbo',
          prompt: 'Hello, {{name}}!',
          variables: { name: 'Alice' },
          temperature: 0.7,
          maxTokens: 150
        },
        {
          provider: 'openai' as const,
          model: 'gpt-3.5-turbo',
          prompt: 'Hello, {{name}}!',
          variables: { name: 'Bob' },
          temperature: 0.7,
          maxTokens: 150
        }
      ];

      const results = await llmService.batchGenerateResponses(requests);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        content: expect.any(String),
        provider: 'openai',
        success: true
      });
      expect(results[1]).toMatchObject({
        content: expect.any(String),
        provider: 'openai',
        success: true
      });
    });

    it('should handle partial failures in batch processing', async () => {
      const requests = [
        {
          provider: 'openai' as const,
          model: 'gpt-3.5-turbo',
          prompt: 'Hello, world!',
          variables: {},
          temperature: 0.7,
          maxTokens: 150
        },
        {
          provider: 'invalid' as any,
          model: 'invalid-model',
          prompt: 'Hello, world!',
          variables: {},
          temperature: 0.7,
          maxTokens: 150
        }
      ];

      const results = await llmService.batchGenerateResponses(requests);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });
});