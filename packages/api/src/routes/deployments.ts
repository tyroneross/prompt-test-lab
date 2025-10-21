import { Router, Request, Response, NextFunction } from 'express';
import { DeploymentService } from '../services/deployment.service';
import { ImpactAnalysisService } from '../services/impact-analysis.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';
import type { 
  DeploymentCreate, 
  DeploymentUpdate,
  ImpactAnalysisRequest 
} from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all deployment routes
router.use(authMiddleware);

/**
 * POST /projects/:projectId/deployments
 * Create a new deployment
 */
router.post('/:projectId/deployments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const deploymentData: DeploymentCreate = req.body;

    // Validate required fields
    if (!deploymentData.promptId || !deploymentData.environmentId || !deploymentData.version) {
      throw new ValidationError('promptId, environmentId, and version are required');
    }

    const deployment = await DeploymentService.createDeployment(
      req.user.sub,
      projectId,
      deploymentData
    );

    res.status(201).json({
      success: true,
      data: deployment,
      message: 'Deployment created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/deployments
 * Get deployments for a project
 */
router.get('/:projectId/deployments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { 
      environmentId, 
      status, 
      page = '1', 
      limit = '10' 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const { deployments, total } = await DeploymentService.getProjectDeployments(
      req.user.sub,
      projectId,
      {
        environmentId: environmentId as string,
        status: status as string,
        limit: limitNum,
        offset: offset
      }
    );

    res.json({
      success: true,
      data: deployments,
      message: 'Deployments retrieved successfully',
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /deployments/:deploymentId
 * Get a specific deployment
 */
router.get('/deployments/:deploymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { deploymentId } = req.params;
    const deployment = await DeploymentService.getDeploymentById(req.user.sub, deploymentId);

    res.json({
      success: true,
      data: deployment,
      message: 'Deployment retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /deployments/:deploymentId
 * Update a deployment
 */
router.put('/deployments/:deploymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { deploymentId } = req.params;
    const updateData: DeploymentUpdate = req.body;

    const deployment = await DeploymentService.updateDeployment(
      req.user.sub,
      deploymentId,
      updateData
    );

    res.json({
      success: true,
      data: deployment,
      message: 'Deployment updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /deployments/:deploymentId/rollback
 * Rollback a deployment
 */
router.post('/deployments/:deploymentId/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { deploymentId } = req.params;
    const deployment = await DeploymentService.rollbackDeployment(req.user.sub, deploymentId);

    res.json({
      success: true,
      data: deployment,
      message: 'Deployment rolled back successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /deployments/:deploymentId/history
 * Get deployment history
 */
router.get('/deployments/:deploymentId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { deploymentId } = req.params;
    const history = await DeploymentService.getDeploymentHistory(req.user.sub, deploymentId);

    res.json({
      success: true,
      data: history,
      message: 'Deployment history retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /deployments/:deploymentId
 * Delete a deployment
 */
router.delete('/deployments/:deploymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { deploymentId } = req.params;
    await DeploymentService.deleteDeployment(req.user.sub, deploymentId);

    res.json({
      success: true,
      message: 'Deployment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects/:projectId/impact-analysis
 * Perform impact analysis between two prompts
 */
router.post('/:projectId/impact-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const analysisRequest: ImpactAnalysisRequest = req.body;

    // Validate required fields
    if (!analysisRequest.promptId || !analysisRequest.baselinePromptId) {
      throw new ValidationError('promptId and baselinePromptId are required');
    }

    const analysis = await ImpactAnalysisService.performImpactAnalysis(
      req.user.sub,
      projectId,
      analysisRequest
    );

    res.json({
      success: true,
      data: analysis,
      message: 'Impact analysis completed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /impact-analysis/:analysisId
 * Get impact analysis by ID
 */
router.get('/impact-analysis/:analysisId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { analysisId } = req.params;
    const analysis = await ImpactAnalysisService.getImpactAnalysis(req.user.sub, analysisId);

    res.json({
      success: true,
      data: analysis,
      message: 'Impact analysis retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /deployments/:deploymentId/impact-analysis
 * Get impact analyses for a deployment
 */
router.get('/deployments/:deploymentId/impact-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { deploymentId } = req.params;
    const analyses = await ImpactAnalysisService.getDeploymentImpactAnalyses(req.user.sub, deploymentId);

    res.json({
      success: true,
      data: analyses,
      message: 'Impact analyses retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;