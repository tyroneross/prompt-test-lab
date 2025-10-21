/**
 * Security headers configuration for Prompt Testing Lab
 * Implements OWASP security best practices
 */

export interface SecurityHeadersConfig {
  isDevelopment: boolean;
  domain: string;
  allowedOrigins: string[];
}

export function getSecurityHeaders(config: SecurityHeadersConfig) {
  const { isDevelopment, domain, allowedOrigins } = config;

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.openai.com https://api.groq.com https://vercel.live wss:",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];

  // Relax CSP in development
  if (isDevelopment) {
    cspDirectives.push("script-src 'self' 'unsafe-eval' 'unsafe-inline'");
    cspDirectives.push("connect-src 'self' ws: wss: http: https:");
  }

  const headers = {
    // Prevent XSS attacks
    'X-XSS-Protection': '1; mode=block',
    
    // Prevent content type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Content Security Policy
    'Content-Security-Policy': cspDirectives.join('; '),
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy (formerly Feature Policy)
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()'
    ].join(', '),
    
    // Cross-Origin Policies
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };

  // Add HSTS only in production with HTTPS
  if (!isDevelopment) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

export function getCorsConfig(config: SecurityHeadersConfig) {
  const { isDevelopment, allowedOrigins } = config;

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // In development, allow localhost
      if (isDevelopment && origin.includes('localhost')) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject all other origins
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Has-More'],
    maxAge: 86400 // 24 hours
  };
}

export function getRateLimitConfig() {
  return {
    // General API rate limiting
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    
    // Strict rate limiting for auth endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 auth requests per windowMs
      message: 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    
    // LLM API rate limiting (more restrictive)
    llm: {
      windowMs: 60 * 1000, // 1 minute
      max: 10, // limit each IP to 10 LLM requests per minute
      message: 'Rate limit exceeded for AI requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }
  };
}

export const securityMiddleware = {
  /**
   * Validate and sanitize input data
   */
  sanitizeInput: (data: any): any => {
    if (typeof data === 'string') {
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => securityMiddleware.sanitizeInput(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = securityMiddleware.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return data;
  },

  /**
   * Validate JWT tokens
   */
  validateToken: (token: string): boolean => {
    if (!token) return false;
    
    // Basic JWT format validation
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // Validate base64 encoding
      JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check for SQL injection patterns
   */
  detectSQLInjection: (input: string): boolean => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\b.*=.*)/i,
      /(;|\-\-|\/\*|\*\/)/,
      /(\b1\s*=\s*1\b)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Validate file uploads
   */
  validateFileUpload: (filename: string, size: number): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedExtensions = ['.json', '.txt', '.csv'];
    
    if (size > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }
    
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      return { valid: false, error: 'File type not allowed' };
    }
    
    return { valid: true };
  }
};