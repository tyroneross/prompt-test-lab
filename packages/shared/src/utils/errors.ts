/**
 * Error handling utilities
 */

import type { PromptLabError } from '../types';

export class PromptLabException extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly retryable: boolean;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    options: {
      details?: Record<string, any>;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'PromptLabException';
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.timestamp = new Date();

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toJSON(): PromptLabError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp
    };
  }
}

// Common error types
export class ValidationError extends PromptLabException {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, { details, retryable: false });
  }
}

export class ParseError extends PromptLabException {
  constructor(message: string, rawOutput?: string) {
    super('PARSE_ERROR', message, { 
      details: { rawOutput: rawOutput?.substring(0, 200) }, 
      retryable: true 
    });
  }
}

export class ModelError extends PromptLabException {
  constructor(message: string, modelName?: string, originalError?: Error) {
    super('MODEL_ERROR', message, { 
      details: { modelName }, 
      retryable: true,
      cause: originalError
    });
  }
}

export class RateLimitError extends PromptLabException {
  constructor(retryAfter?: number) {
    super('RATE_LIMIT_ERROR', 'Rate limit exceeded', { 
      details: { retryAfter }, 
      retryable: true 
    });
  }
}

export class AuthenticationError extends PromptLabException {
  constructor(message = 'Authentication failed') {
    super('AUTH_ERROR', message, { retryable: false });
  }
}

export class AuthorizationError extends PromptLabException {
  constructor(message = 'Insufficient permissions') {
    super('AUTHZ_ERROR', message, { retryable: false });
  }
}

export class NotFoundError extends PromptLabException {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, { retryable: false });
  }
}

// Error utilities
export function isRetryableError(error: Error): boolean {
  if (error instanceof PromptLabException) {
    return error.retryable;
  }
  
  // Check for common retryable error patterns
  const retryablePatterns = [
    /timeout/i,
    /connection/i,
    /network/i,
    /rate.?limit/i,
    /5\d\d/i // 5xx status codes
  ];
  
  return retryablePatterns.some(pattern => pattern.test(error.message));
}

export function getRetryDelay(attemptNumber: number, baseDelay = 1000): number {
  // Exponential backoff with jitter
  const delay = baseDelay * Math.pow(2, attemptNumber - 1);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, 30000); // Cap at 30 seconds
}

export function formatError(error: Error): string {
  if (error instanceof PromptLabException) {
    return `[${error.code}] ${error.message}`;
  }
  return error.message;
}