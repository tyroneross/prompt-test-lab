import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/project.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all project routes
router.use(authMiddleware);

/**
 * GET /projects
 * Get all projects for the authenticated user
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const projects = await ProjectService.getUserProjects(req.user.sub);
    
    res.json({
      success: true,
      data: projects,
      message: 'Projects retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const project = await ProjectService.createProject(req.user.sub, req.body);
    
    res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId
 * Get a specific project by ID
 */
router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const project = await ProjectService.getProjectById(projectId, req.user.sub);
    
    res.json({
      success: true,
      data: project,
      message: 'Project retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /projects/:projectId
 * Update a project (partial update)
 */
router.patch('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const project = await ProjectService.updateProject(projectId, req.user.sub, req.body);

    res.json({
      success: true,
      data: project,
      message: 'Project updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /projects/:projectId
 * Delete a project
 */
router.delete('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    await ProjectService.deleteProject(projectId, req.user.sub);
    
    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects/:projectId/members
 * Add a member to the project
 */
router.post('/:projectId/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const member = await ProjectService.addProjectMember(projectId, req.user.sub, req.body);
    
    res.status(201).json({
      success: true,
      data: member,
      message: 'Member added successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /projects/:projectId/members/:memberId
 * Update member role (partial update)
 */
router.patch('/:projectId/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId, memberId } = req.params;
    const { role } = req.body;

    if (!role) {
      throw new ValidationError('Role is required');
    }

    const member = await ProjectService.updateMemberRole(projectId, req.user.sub, memberId, role);

    res.json({
      success: true,
      data: member,
      message: 'Member role updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /projects/:projectId/members/:memberId
 * Remove a member from the project
 */
router.delete('/:projectId/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId, memberId } = req.params;
    await ProjectService.removeMember(projectId, req.user.sub, memberId);
    
    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/stats
 * Get project statistics
 */
router.get('/:projectId/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const stats = await ProjectService.getProjectStats(projectId, req.user.sub);
    
    res.json({
      success: true,
      data: stats,
      message: 'Project statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;