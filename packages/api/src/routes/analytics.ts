import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all analytics routes
router.use(authMiddleware);

/**
 * GET /projects/:projectId/analytics
 * Get comprehensive project analytics
 */
router.get('/projects/:projectId/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { startDate, endDate } = req.query;

    let timeRange;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      };
    }

    const analytics = await AnalyticsService.getProjectAnalytics(projectId, req.user.sub, timeRange);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Project analytics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/:userId/analytics
 * Get user analytics across all projects
 */
router.get('/users/:userId/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { userId } = req.params;
    
    // Users can only access their own analytics unless they're admin
    if (userId !== req.user.sub && !req.user.scope.includes('admin')) {
      throw new AuthenticationError('Access denied to user analytics');
    }

    const { startDate, endDate } = req.query;

    let timeRange;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      };
    }

    const analytics = await AnalyticsService.getUserAnalytics(userId, timeRange);
    
    res.json({
      success: true,
      data: analytics,
      message: 'User analytics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/analytics/export
 * Export project analytics data
 */
router.get('/projects/:projectId/analytics/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { format, startDate, endDate } = req.query;

    const exportFormat = format as 'json' | 'csv' || 'json';
    
    if (!['json', 'csv'].includes(exportFormat)) {
      throw new ValidationError('Format must be json or csv');
    }

    let timeRange;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      };
    }

    const exportData = await AnalyticsService.exportProjectAnalytics(
      projectId,
      req.user.sub,
      exportFormat,
      timeRange
    );

    const filename = `project-${projectId}-analytics-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 
      exportFormat === 'csv' ? 'text/csv' : 'application/json'
    );
    
    res.send(exportData);
  } catch (error) {
    next(error);
  }
});

export default router;