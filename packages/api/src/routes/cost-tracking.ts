import { Router, Request, Response, NextFunction } from 'express';
import { CostTrackingService } from '../services/cost-tracking.service';
import { authMiddleware } from '../middleware/auth';
import { AuthenticationError, ValidationError } from '@prompt-lab/shared';

const router: Router = Router();

// Apply authentication to all cost tracking routes
router.use(authMiddleware);

/**
 * GET /projects/:projectId/cost-data
 * Get cost data for a user in a specific project
 */
router.get('/:projectId/cost-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const costData = await CostTrackingService.getUserProjectCostData(req.user.sub, projectId);

    res.json({
      success: true,
      data: costData,
      message: 'Cost data retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/cost-history
 * Get cost tracking history for a project
 */
router.get('/:projectId/cost-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { periods, userId } = req.query;

    const options = {
      periods: periods ? parseInt(periods as string) : undefined,
      userId: userId as string
    };

    const costHistory = await CostTrackingService.getProjectCostHistory(
      req.user.sub,
      projectId,
      options
    );

    res.json({
      success: true,
      data: costHistory,
      message: 'Cost history retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects/:projectId/cost-tracking
 * Update cost tracking for a user and project
 */
router.post('/:projectId/cost-tracking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { projectId } = req.params;
    const { cost, tokenUsage, metadata } = req.body;

    // Validate required fields
    if (typeof cost !== 'number' || typeof tokenUsage !== 'number') {
      throw new ValidationError('cost and tokenUsage must be numbers');
    }

    if (cost < 0 || tokenUsage < 0) {
      throw new ValidationError('cost and tokenUsage must be non-negative');
    }

    await CostTrackingService.updateCostTracking(
      req.user.sub,
      projectId,
      cost,
      tokenUsage,
      metadata || {}
    );

    res.json({
      success: true,
      message: 'Cost tracking updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /user/billing
 * Get user billing information
 */
router.get('/user/billing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const billing = await CostTrackingService.getUserBilling(req.user.sub);

    res.json({
      success: true,
      data: billing,
      message: 'User billing information retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /user/billing
 * Update user billing information
 */
router.put('/user/billing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { billingEmail, plan, monthlyLimit } = req.body;

    // Validate plan if provided
    if (plan && !['free', 'pro', 'enterprise'].includes(plan)) {
      throw new ValidationError('Invalid plan. Must be one of: free, pro, enterprise');
    }

    // Validate monthlyLimit if provided
    if (monthlyLimit !== undefined && (typeof monthlyLimit !== 'number' || monthlyLimit < 0)) {
      throw new ValidationError('monthlyLimit must be a non-negative number');
    }

    const updateData: any = {};
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
    if (plan !== undefined) updateData.plan = plan;
    if (monthlyLimit !== undefined) updateData.monthlyLimit = monthlyLimit;

    const billing = await CostTrackingService.updateUserBilling(req.user.sub, updateData);

    res.json({
      success: true,
      data: billing,
      message: 'User billing information updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /user/cost-limit-status
 * Check if user has exceeded their monthly limit
 */
router.get('/user/cost-limit-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const limitStatus = await CostTrackingService.checkCostLimit(req.user.sub);

    res.json({
      success: true,
      data: limitStatus,
      message: 'Cost limit status retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /user/reset-monthly-usage
 * Reset monthly usage (admin only or automated)
 */
router.post('/user/reset-monthly-usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { targetUserId } = req.body;

    // For now, users can only reset their own usage
    // In a real system, you'd check for admin permissions here
    const userIdToReset = targetUserId && req.user.scope.includes('admin') ? targetUserId : req.user.sub;

    await CostTrackingService.resetMonthlyUsage(userIdToReset);

    res.json({
      success: true,
      message: 'Monthly usage reset successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;