import { Router, Request, Response, NextFunction } from 'express';
import { PromptService } from '../services/prompt.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all prompt routes
router.use(authMiddleware);

/**
 * GET /projects/:projectId/prompts
 * Get all prompts for a project
 */
router.get('/projects/:projectId/prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const {
      includeArchived,
      tags,
      search,
      limit,
      offset
    } = req.query;

    const options = {
      includeArchived: includeArchived === 'true',
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await PromptService.getProjectPrompts(projectId, req.user.sub, options);
    
    res.json({
      success: true,
      data: result.prompts,
      meta: {
        total: result.total,
        limit: options.limit || 50,
        offset: options.offset || 0,
      },
      message: 'Prompts retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects/:projectId/prompts
 * Create a new prompt
 */
router.post('/projects/:projectId/prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const prompt = await PromptService.createPrompt(projectId, req.user.sub, req.body);
    
    res.status(201).json({
      success: true,
      data: prompt,
      message: 'Prompt created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prompts/:promptId
 * Get a specific prompt by ID
 */
router.get('/prompts/:promptId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { promptId } = req.params;
    const prompt = await PromptService.getPromptById(promptId, req.user.sub);
    
    res.json({
      success: true,
      data: prompt,
      message: 'Prompt retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /prompts/:promptId
 * Update a prompt (partial update)
 */
router.patch('/prompts/:promptId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { promptId } = req.params;
    const prompt = await PromptService.updatePrompt(promptId, req.user.sub, req.body);

    res.json({
      success: true,
      data: prompt,
      message: 'Prompt updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /prompts/:promptId/versions
 * Create a new version of a prompt
 */
router.post('/prompts/:promptId/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { promptId } = req.params;
    const newVersion = await PromptService.createPromptVersion(promptId, req.user.sub, req.body);
    
    res.status(201).json({
      success: true,
      data: newVersion,
      message: 'Prompt version created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prompts/:promptId/versions
 * Get version history for a prompt
 */
router.get('/prompts/:promptId/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { promptId } = req.params;
    const versions = await PromptService.getPromptVersions(promptId, req.user.sub);
    
    res.json({
      success: true,
      data: versions,
      message: 'Prompt versions retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /prompts/:promptId/archive
 * Archive or unarchive a prompt
 */
router.put('/prompts/:promptId/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { promptId } = req.params;
    const { archive } = req.body;

    if (typeof archive !== 'boolean') {
      throw new ValidationError('Archive field must be a boolean');
    }

    const prompt = await PromptService.archivePrompt(promptId, req.user.sub, archive);
    
    res.json({
      success: true,
      data: prompt,
      message: `Prompt ${archive ? 'archived' : 'unarchived'} successfully`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /prompts/:promptId
 * Delete a prompt
 */
router.delete('/prompts/:promptId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { promptId } = req.params;
    await PromptService.deletePrompt(promptId, req.user.sub);
    
    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/prompts/tags
 * Get all tags for prompts in a project
 */
router.get('/projects/:projectId/prompts/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const tags = await PromptService.getProjectTags(projectId, req.user.sub);
    
    res.json({
      success: true,
      data: tags,
      message: 'Project tags retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/prompts/by-tags
 * Get prompts by specific tags
 */
router.get('/projects/:projectId/prompts/by-tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { tags } = req.query;

    if (!tags) {
      throw new ValidationError('Tags parameter is required');
    }

    const tagArray = Array.isArray(tags) ? tags as string[] : [tags as string];
    const prompts = await PromptService.getPromptsByTags(projectId, req.user.sub, tagArray);
    
    res.json({
      success: true,
      data: prompts,
      message: 'Prompts retrieved by tags successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;