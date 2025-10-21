import { Router, Request, Response, NextFunction } from 'express';
import { EnvironmentService } from '../services/environment.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';
import type { Environment } from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all environment routes
router.use(authMiddleware);

/**
 * POST /projects/:projectId/environments
 * Create a new environment
 */
router.post('/:projectId/environments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const environmentData: Omit<Environment, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> = req.body;

    // Validate required fields
    if (!environmentData.name || !environmentData.type) {
      throw new ValidationError('name and type are required');
    }

    const environment = await EnvironmentService.createEnvironment(
      req.user.sub,
      projectId,
      environmentData
    );

    res.status(201).json({
      success: true,
      data: environment,
      message: 'Environment created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/environments
 * Get environments for a project
 */
router.get('/:projectId/environments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { type, isActive } = req.query;

    const environments = await EnvironmentService.getProjectEnvironments(
      req.user.sub,
      projectId,
      {
        type: type as any,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      }
    );

    res.json({
      success: true,
      data: environments,
      message: 'Environments retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /environments/:environmentId
 * Get a specific environment
 */
router.get('/environments/:environmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { environmentId } = req.params;
    const environment = await EnvironmentService.getEnvironmentById(req.user.sub, environmentId);

    res.json({
      success: true,
      data: environment,
      message: 'Environment retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /environments/:environmentId
 * Update an environment
 */
router.put('/environments/:environmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { environmentId } = req.params;
    const updateData: Partial<Omit<Environment, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>> = req.body;

    const environment = await EnvironmentService.updateEnvironment(
      req.user.sub,
      environmentId,
      updateData
    );

    res.json({
      success: true,
      data: environment,
      message: 'Environment updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /environments/:environmentId
 * Delete an environment
 */
router.delete('/environments/:environmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { environmentId } = req.params;
    await EnvironmentService.deleteEnvironment(req.user.sub, environmentId);

    res.json({
      success: true,
      message: 'Environment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;