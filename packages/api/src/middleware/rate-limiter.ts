/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse and DDoS attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Rate limiter configurations
const rateLimiters = {
  // General API endpoints
  general: new RateLimiterMemory({
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
    points: 100, // Number of requests
    duration: 15 * 60, // Per 15 minutes
    blockDuration: 15 * 60, // Block for 15 minutes if limit exceeded
  }),

  // Authentication endpoints (stricter)
  auth: new RateLimiterMemory({
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
    points: 5, // Number of requests
    duration: 15 * 60, // Per 15 minutes
    blockDuration: 30 * 60, // Block for 30 minutes if limit exceeded
  }),

  // LLM endpoints (very strict)
  llm: new RateLimiterMemory({
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
    points: 10, // Number of requests
    duration: 60, // Per minute
    blockDuration: 60 * 60, // Block for 1 hour if limit exceeded
  }),

  // File upload endpoints
  upload: new RateLimiterMemory({
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
    points: 20, // Number of uploads
    duration: 60 * 60, // Per hour
    blockDuration: 60 * 60, // Block for 1 hour if limit exceeded
  }),
};

/**
 * Rate limiting middleware factory
 */
export function createRateLimiter(type: keyof typeof rateLimiters) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limiter = rateLimiters[type];
      const key = limiter.keyGenerator(req);
      
      await limiter.consume(key);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', limiter.points);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + limiter.duration * 1000).toISOString());
      
      next();
    } catch (error: any) {
      // Rate limit exceeded
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
        message: `Rate limit exceeded. Try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds.`
      });
    }
  };
}

/**
 * Specific rate limiters for different endpoint types
 */
export const rateLimitGeneral = createRateLimiter('general');
export const rateLimitAuth = createRateLimiter('auth');
export const rateLimitLLM = createRateLimiter('llm');
export const rateLimitUpload = createRateLimiter('upload');

/**
 * Custom rate limiter for specific endpoints
 */
export function createCustomRateLimiter(points: number, duration: number, blockDuration?: number) {
  const limiter = new RateLimiterMemory({
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
    points,
    duration,
    blockDuration: blockDuration || duration,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = limiter.keyGenerator(req);
      await limiter.consume(key);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', limiter.points);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + limiter.duration * 1000).toISOString());
      
      next();
    } catch (error: any) {
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
        message: `Rate limit exceeded. Try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds.`
      });
    }
  };
} 