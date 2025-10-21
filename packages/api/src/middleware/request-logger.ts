/**
 * Request logging middleware
 */

import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Add request ID to request for use in other middleware
  (req as any).requestId = requestId;
  
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    
    const logData = {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      contentLength: body ? Buffer.byteLength(body) : 0,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    };

    // Log level based on status code
    if (res.statusCode >= 500) {
      console.error('🔴 ERROR:', logData);
    } else if (res.statusCode >= 400) {
      console.warn('🟡 WARN:', logData);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('🟢 INFO:', logData);
    }

    return originalSend.call(this, body);
  };

  next();
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}