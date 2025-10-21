import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth';
import { ValidationError, AuthenticationError } from '@prompt-lab/shared';
import { nullToEmptyString, nullToUndefined } from '../utils/type-helpers';

const router: Router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authResponse = await AuthService.register(req.body);
    
    res.status(201).json({
      success: true,
      data: authResponse,
      message: 'User registered successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authResponse = await AuthService.login(req.body);
    
    res.json({
      success: true,
      data: authResponse,
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh authentication token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw new ValidationError('Token is required');
    }

    const authResponse = await AuthService.refreshToken(token);
    
    res.json({
      success: true,
      data: authResponse,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const user = await AuthService.getUserProfile(req.user.sub);
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: nullToEmptyString(user.name),
        avatar: nullToUndefined(user.avatar),
        createdAt: user.createdAt,
        projectMemberships: user.projectMemberships.map((membership: any) => ({
          id: membership.id,
          role: membership.role,
          project: {
            id: membership.project.id,
            name: membership.project.name,
            description: nullToUndefined(membership.project.description),
          }
        })),
        ownedProjects: user.ownedProjects.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: nullToUndefined(project.description),
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /auth/me
 * Update current user profile
 */
router.patch('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { name, avatar } = req.body;

    // Validate updates
    if (!name && !avatar) {
      throw new ValidationError('At least one field (name or avatar) must be provided');
    }

    const updates: { name?: string; avatar?: string } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new ValidationError('Name must be a non-empty string');
      }
      if (name.length > 100) {
        throw new ValidationError('Name must be less than 100 characters');
      }
      updates.name = name.trim();
    }

    if (avatar !== undefined) {
      if (typeof avatar !== 'string') {
        throw new ValidationError('Avatar must be a string');
      }
      // Basic URL validation for avatar
      if (avatar.length > 0 && !avatar.startsWith('http')) {
        throw new ValidationError('Avatar must be a valid URL');
      }
      updates.avatar = avatar || null;
    }

    // Update user in database
    const updatedUser = await AuthService.updateUserProfile(req.user.sub, updates);

    if (!updatedUser) {
      throw new AuthenticationError('User not found');
    }

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: nullToEmptyString(updatedUser.name),
        avatar: nullToUndefined(updatedUser.avatar),
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout user (client-side token removal mainly)
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a stateless JWT system, logout is mainly handled client-side
    // In a more sophisticated system, you might maintain a token blacklist

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/verify
 * Verify token validity
 */
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Authorization header missing');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('Token missing');
    }

    const user = await AuthService.verifyToken(token);

    if (!user) {
      throw new AuthenticationError('Invalid token');
    }

    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;