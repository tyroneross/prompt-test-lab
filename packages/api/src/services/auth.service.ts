import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient, User } from '../generated/client';
import { ProjectRole } from '../types/enums';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';
import { z } from 'zod';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const SALT_ROUNDS = 12;

// Validation schemas with enhanced password requirements
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
});

export interface AuthToken {
  sub: string; // user ID
  email: string;
  name: string;
  scope: string[]; // permissions
  tenant: string; // for multi-tenancy
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  token: string;
  expiresAt: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const validated = registerSchema.parse(data);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email }
    });

    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, SALT_ROUNDS);

    // Create user with hashed password
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        passwordHash,
      }
    });
    
    // Generate token
    const token = this.generateToken(user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        avatar: user.avatar || undefined,
      },
      token,
      expiresAt,
    };
  }

  /**
   * Login user
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    const validated = loginSchema.parse(data);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      include: {
        projectMemberships: {
          include: {
            project: true
          }
        }
      }
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user has a password hash (for backward compatibility with demo users)
    if (!user.passwordHash) {
      throw new AuthenticationError('Please register with a password to continue');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        avatar: user.avatar || undefined,
      },
      token,
      expiresAt,
    };
  }

  /**
   * Verify JWT token and get user
   */
  static async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          projectMemberships: {
            include: {
              project: true
            }
          }
        }
      });

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user permissions for a project
   */
  static async getUserProjectPermissions(userId: string, projectId: string): Promise<string[]> {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    if (!membership) {
      return [];
    }

    // Define permissions based on role
    const rolePermissions: Record<ProjectRole, string[]> = {
      OWNER: ['read', 'write', 'delete', 'admin', 'manage_members'],
      ADMIN: ['read', 'write', 'delete', 'manage_members'],
      MEMBER: ['read', 'write'],
      VIEWER: ['read'],
    };

    return rolePermissions[membership.role] || [];
  }

  /**
   * Generate JWT token for user
   */
  private static generateToken(user: User): string {
    const payload: Omit<AuthToken, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      name: user.name || '',
      scope: ['user'], // Basic user permissions
      tenant: 'default', // For multi-tenancy support
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'prompt-testing-lab',
      audience: 'prompt-lab-users'
    });
  }

  /**
   * Refresh token
   */
  static async refreshToken(token: string): Promise<AuthResponse> {
    const user = await this.verifyToken(token);
    
    if (!user) {
      throw new AuthenticationError('Invalid token');
    }

    const newToken = this.generateToken(user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        avatar: user.avatar || undefined,
      },
      token: newToken,
      expiresAt,
    };
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        projectMemberships: {
          include: {
            project: true
          }
        },
        ownedProjects: true,
      }
    });
  }
}