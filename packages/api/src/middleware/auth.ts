/**
 * Authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '@prompt-lab/shared';
import type { AuthToken, Permission } from '@prompt-lab/shared';

// Environment validation for production
function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = [
      'JWT_SECRET',
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missingVars.join(', ')}\n` +
        'Please ensure all required variables are set in your production environment.'
      );
    }

    // Validate JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long for production');
    }

    // Validate database URL format
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.startsWith('postgresql://')) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
    }
  }
}

// Initialize environment validation
validateProductionEnvironment();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as any;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Permission checking middleware factory
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    if (!req.user.scope.includes(permission)) {
      return next(new AuthorizationError(`Missing required permission: ${permission}`));
    }

    next();
  };
}

/**
 * Project access middleware - ensures user has access to the project
 */
export function requireProjectAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AuthenticationError('User not authenticated'));
  }

  const projectId = req.params.projectId || req.body.projectId;
  
  if (!projectId) {
    return next(new AuthorizationError('Project ID required'));
  }

  // For now, we'll implement basic validation
  // In a real system, you'd check the database for user-project relationships
  if (req.user.scope.includes('admin')) {
    return next(); // Admins have access to all projects
  }

  // TODO: Implement project-specific access control
  // This would typically involve checking if the user belongs to the project
  next();
}

/**
 * Generate JWT token for user authentication
 */
export function generateToken(userId: string, email: string, role: string = 'user'): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const payload = {
    userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iss: 'prompt-testing-lab'
  };

  return jwt.sign(payload, secret, {
    expiresIn: '24h',
    issuer: 'prompt-testing-lab',
    audience: 'prompt-testing-lab-users'
  });
}

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token: string): any | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

// Export alias for backward compatibility
export const authMiddleware = authenticateToken;