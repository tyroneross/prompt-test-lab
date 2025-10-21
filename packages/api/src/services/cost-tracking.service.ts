import { PrismaClient } from '../generated/client';
import { NotFoundError, AuthorizationError } from '@prompt-lab/shared';
import type { CostData, CostTracking, UserBilling } from '@prompt-lab/shared';
import { ProjectService } from './project.service';

const prisma = new PrismaClient();

export class CostTrackingService {
  /**
   * Get cost data for a user in a specific project
   */
  static async getUserProjectCostData(
    userId: string,
    projectId: string
  ): Promise<CostData> {
    // Validate user access to project
    await ProjectService.getProjectById(projectId, userId);

    const currentPeriod = this.getCurrentPeriod();
    
    // Get user billing information
    const userBilling = await prisma.userBilling.findUnique({
      where: { userId }
    });

    if (!userBilling) {
      // Create default billing record
      await this.createDefaultUserBilling(userId);
    }

    // Get current month cost tracking
    const currentCostTracking = await prisma.costTracking.findUnique({
      where: {
        projectId_userId_period: {
          projectId,
          userId,
          period: currentPeriod
        }
      }
    });

    // Get project-wide cost tracking for breakdown
    const projectCostTracking = await prisma.costTracking.findMany({
      where: {
        projectId,
        period: currentPeriod
      }
    });

    // Calculate breakdown
    const breakdown = this.calculateCostBreakdown(projectCostTracking);

    // Get last test cost (most recent test run cost)
    const lastTestCost = await this.getLastTestCost(userId, projectId);

    const billing = userBilling || await this.getDefaultBilling();

    return {
      thisMonth: currentCostTracking?.totalCost || 0,
      limit: billing.monthlyLimit,
      lastTest: lastTestCost,
      breakdown
    };
  }

  /**
   * Update cost tracking for a user and project
   */
  static async updateCostTracking(
    userId: string,
    projectId: string,
    cost: number,
    tokenUsage: number,
    metadata: {
      modelProvider?: string;
      modelName?: string;
      testRunId?: string;
      promptId?: string;
    } = {}
  ): Promise<void> {
    const currentPeriod = this.getCurrentPeriod();

    // Update or create cost tracking record
    await prisma.costTracking.upsert({
      where: {
        projectId_userId_period: {
          projectId,
          userId,
          period: currentPeriod
        }
      },
      update: {
        totalCost: {
          increment: cost
        },
        tokenUsage: {
          increment: tokenUsage
        },
        requestCount: {
          increment: 1
        },
        breakdown: {
          // This would be more complex in a real implementation
          // For now, we'll track basic metadata
          lastUpdate: new Date().toISOString(),
          ...metadata
        }
      },
      create: {
        projectId,
        userId,
        period: currentPeriod,
        totalCost: cost,
        tokenUsage,
        requestCount: 1,
        breakdown: {
          created: new Date().toISOString(),
          ...metadata
        }
      }
    });

    // Update user billing current usage
    await prisma.userBilling.upsert({
      where: { userId },
      update: {
        currentUsage: {
          increment: cost
        }
      },
      create: {
        userId,
        currentUsage: cost,
        monthlyLimit: 100.0, // Default limit
        plan: 'free'
      }
    });
  }

  /**
   * Get cost tracking history for a project
   */
  static async getProjectCostHistory(
    userId: string,
    projectId: string,
    options: {
      periods?: number; // Number of periods to return
      userId?: string; // Filter by specific user
    } = {}
  ): Promise<CostTracking[]> {
    // Validate user access to project
    await ProjectService.getProjectById(projectId, userId);

    const { periods = 12, userId: filterUserId } = options;
    
    // Generate period list (last N periods)
    const periodList = this.generatePeriodList(periods);

    const costTracking = await prisma.costTracking.findMany({
      where: {
        projectId,
        period: {
          in: periodList
        },
        ...(filterUserId && { userId: filterUserId })
      },
      orderBy: {
        period: 'desc'
      }
    });

    return costTracking.map(record => ({
      id: record.id,
      period: record.period,
      totalCost: record.totalCost,
      tokenUsage: record.tokenUsage,
      requestCount: record.requestCount,
      breakdown: record.breakdown as Record<string, any>,
      projectId: record.projectId,
      userId: record.userId || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));
  }

  /**
   * Get user billing information
   */
  static async getUserBilling(userId: string): Promise<UserBilling> {
    let userBilling = await prisma.userBilling.findUnique({
      where: { userId }
    });

    if (!userBilling) {
      userBilling = await this.createDefaultUserBilling(userId);
    }

    return {
      id: userBilling.id,
      billingEmail: userBilling.billingEmail,
      plan: userBilling.plan as 'free' | 'pro' | 'enterprise',
      monthlyLimit: userBilling.monthlyLimit,
      currentUsage: userBilling.currentUsage,
      isActive: userBilling.isActive,
      userId: userBilling.userId,
      createdAt: userBilling.createdAt,
      updatedAt: userBilling.updatedAt
    };
  }

  /**
   * Update user billing information
   */
  static async updateUserBilling(
    userId: string,
    updateData: Partial<Pick<UserBilling, 'billingEmail' | 'plan' | 'monthlyLimit'>>
  ): Promise<UserBilling> {
    const userBilling = await prisma.userBilling.update({
      where: { userId },
      data: updateData
    });

    return {
      id: userBilling.id,
      billingEmail: userBilling.billingEmail,
      plan: userBilling.plan as 'free' | 'pro' | 'enterprise',
      monthlyLimit: userBilling.monthlyLimit,
      currentUsage: userBilling.currentUsage,
      isActive: userBilling.isActive,
      userId: userBilling.userId,
      createdAt: userBilling.createdAt,
      updatedAt: userBilling.updatedAt
    };
  }

  /**
   * Reset monthly usage (typically called at the start of each month)
   */
  static async resetMonthlyUsage(userId?: string): Promise<void> {
    const where = userId ? { userId } : {};
    
    await prisma.userBilling.updateMany({
      where,
      data: {
        currentUsage: 0
      }
    });
  }

  /**
   * Check if user has exceeded their monthly limit
   */
  static async checkCostLimit(userId: string): Promise<{
    withinLimit: boolean;
    currentUsage: number;
    limit: number;
    percentageUsed: number;
  }> {
    const billing = await this.getUserBilling(userId);
    
    const percentageUsed = billing.monthlyLimit > 0 ? (billing.currentUsage / billing.monthlyLimit) * 100 : 0;
    
    return {
      withinLimit: billing.currentUsage <= billing.monthlyLimit,
      currentUsage: billing.currentUsage,
      limit: billing.monthlyLimit,
      percentageUsed
    };
  }

  /**
   * Get current period string (YYYY-MM format)
   */
  private static getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Generate list of periods for history queries
   */
  private static generatePeriodList(count: number): string[] {
    const periods: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const period = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = period.getFullYear();
      const month = String(period.getMonth() + 1).padStart(2, '0');
      periods.push(`${year}-${month}`);
    }
    
    return periods;
  }

  /**
   * Calculate cost breakdown from tracking records
   */
  private static calculateCostBreakdown(costTrackingRecords: any[]): {
    byModel: Record<string, number>;
    byUser: Record<string, number>;
    byProject: Record<string, number>;
  } {
    const breakdown = {
      byModel: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      byProject: {} as Record<string, number>
    };

    costTrackingRecords.forEach(record => {
      // Aggregate by user
      if (record.userId) {
        breakdown.byUser[record.userId] = (breakdown.byUser[record.userId] || 0) + record.totalCost;
      }

      // Aggregate by project
      breakdown.byProject[record.projectId] = (breakdown.byProject[record.projectId] || 0) + record.totalCost;

      // Aggregate by model (from breakdown metadata)
      if (record.breakdown?.modelName) {
        const modelKey = `${record.breakdown.modelProvider || 'unknown'}/${record.breakdown.modelName}`;
        breakdown.byModel[modelKey] = (breakdown.byModel[modelKey] || 0) + record.totalCost;
      }
    });

    return breakdown;
  }

  /**
   * Get the cost of the last test run
   */
  private static async getLastTestCost(userId: string, projectId: string): Promise<number> {
    const lastTestRun = await prisma.testRun.findFirst({
      where: {
        userId,
        projectId
      },
      include: {
        responses: {
          select: {
            cost: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!lastTestRun) {
      return 0;
    }

    const totalCost = lastTestRun.responses.reduce((sum, response) => {
      return sum + (response.cost || 0);
    }, 0);

    return totalCost;
  }

  /**
   * Create default user billing record
   */
  private static async createDefaultUserBilling(userId: string) {
    return prisma.userBilling.create({
      data: {
        userId,
        plan: 'free',
        monthlyLimit: 100.0,
        currentUsage: 0,
        isActive: true
      }
    });
  }

  /**
   * Get default billing info
   */
  private static async getDefaultBilling(): Promise<UserBilling> {
    return {
      id: 'default',
      plan: 'free',
      monthlyLimit: 100.0,
      currentUsage: 0,
      isActive: true,
      userId: 'default',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}