/**
 * Centralized error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { PromptLabException } from '@prompt-lab/shared';

export interface APIErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: Record<string, any>;
  requestId: string;
  timestamp: string;
  retryAfter?: number;
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  console.error(`[${requestId}] Error:`, {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent']
  });

  // Handle PromptLabException errors
  if (error instanceof PromptLabException) {
    const errorResponse: APIErrorResponse = {
      error: 'PromptLabError',
      code: error.code,
      message: error.message,
      details: error.details,
      requestId,
      timestamp: new Date().toISOString()
    };

    if (error.retryable) {
      errorResponse.retryAfter = getRetryAfter(error.code);
    }

    const statusCode = getStatusCodeForError(error.code);
    res.status(statusCode).json(errorResponse);
    return;
  }

  // Handle validation errors (express-validator)
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: 'ValidationError',
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: { validationErrors: (error as any).errors },
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'AuthenticationError',
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'AuthenticationError',
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle database errors
  if (error.message.includes('SQLITE_') || error.message.includes('PostgreSQL')) {
    res.status(500).json({
      error: 'DatabaseError',
      code: 'DATABASE_ERROR',
      message: 'Database operation failed',
      requestId,
      timestamp: new Date().toISOString(),
      retryAfter: 5
    });
    return;
  }

  // Handle rate limit errors
  if (error.message.includes('Too many requests')) {
    res.status(429).json({
      error: 'RateLimitError',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      requestId,
      timestamp: new Date().toISOString(),
      retryAfter: 60
    });
    return;
  }

  // Generic server error
  res.status(500).json({
    error: 'InternalServerError',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
    requestId,
    timestamp: new Date().toISOString(),
    retryAfter: 30
  });
}

function getStatusCodeForError(errorCode: string): number {
  const statusMap: Record<string, number> = {
    'VALIDATION_ERROR': 400,
    'PARSE_ERROR': 400,
    'AUTH_ERROR': 401,
    'TOKEN_EXPIRED': 401,
    'INVALID_TOKEN': 401,
    'AUTHZ_ERROR': 403,
    'NOT_FOUND': 404,
    'RATE_LIMIT_ERROR': 429,
    'MODEL_ERROR': 502,
    'DATABASE_ERROR': 503
  };

  return statusMap[errorCode] || 500;
}

function getRetryAfter(errorCode: string): number {
  const retryMap: Record<string, number> = {
    'RATE_LIMIT_ERROR': 60,
    'MODEL_ERROR': 5,
    'DATABASE_ERROR': 10,
    'PARSE_ERROR': 1
  };

  return retryMap[errorCode] || 30;
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}