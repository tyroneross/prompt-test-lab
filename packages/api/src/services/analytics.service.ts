import { PrismaClient } from '../generated/client';
import { ProjectService } from './project.service';
import { AuthorizationError, NotFoundError } from '@prompt-lab/shared';

const prisma = new PrismaClient();

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
}

export interface ProjectAnalytics {
  overview: {
    totalPrompts: number;
    totalTestRuns: number;
    totalResponses: number;
    totalCost: number;
    avgLatency: number;
    successRate: number;
  };
  timeSeriesData: {
    date: string;
    testRuns: number;
    cost: number;
    avgLatency: number;
    successRate: number;
  }[];
  modelPerformance: {
    model: string;
    responseCount: number;
    avgLatency: number;
    totalCost: number;
    successRate: number;
    avgScore?: number;
  }[];
  promptPerformance: {
    promptId: string;
    promptName: string;
    testRuns: number;
    avgLatency: number;
    totalCost: number;
    successRate: number;
    lastTested: Date;
  }[];
  costBreakdown: {
    byModel: Record<string, number>;
    byPrompt: Record<string, number>;
    byTimeRange: Record<string, number>;
  };
  usageMetrics: {
    tokensUsed: {
      total: number;
      input: number;
      output: number;
    };
    requestCount: number;
    avgRequestsPerDay: number;
  };
}

export interface UserAnalytics {
  overview: {
    totalProjects: number;
    totalTestRuns: number;
    totalCost: number;
    activeProjects: number;
  };
  recentActivity: {
    date: string;
    testRuns: number;
    cost: number;
  }[];
  projectBreakdown: {
    projectId: string;
    projectName: string;
    testRuns: number;
    cost: number;
    lastActivity: Date;
  }[];
}

export class AnalyticsService {
  /**
   * Get comprehensive project analytics
   */
  static async getProjectAnalytics(
    projectId: string,
    userId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<ProjectAnalytics> {
    // Check project access
    const userRole = await ProjectService.getUserProjectRole(projectId, userId);
    if (!userRole) {
      throw new AuthorizationError('Access denied to project');
    }

    const range = timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(),
    };

    // Get overview metrics
    const overview = await this.getProjectOverview(projectId, range);
    
    // Get time series data
    const timeSeriesData = await this.getProjectTimeSeries(projectId, range);
    
    // Get model performance
    const modelPerformance = await this.getModelPerformance(projectId, range);
    
    // Get prompt performance
    const promptPerformance = await this.getPromptPerformance(projectId, range);
    
    // Get cost breakdown
    const costBreakdown = await this.getCostBreakdown(projectId, range);
    
    // Get usage metrics
    const usageMetrics = await this.getUsageMetrics(projectId, range);

    return {
      overview,
      timeSeriesData,
      modelPerformance,
      promptPerformance,
      costBreakdown,
      usageMetrics,
    };
  }

  /**
   * Get project overview metrics
   */
  private static async getProjectOverview(
    projectId: string,
    range: AnalyticsTimeRange
  ) {
    const [
      totalPrompts,
      totalTestRuns,
      totalResponses,
      responseStats,
      testRunStats,
    ] = await Promise.all([
      prisma.prompt.count({
        where: { projectId, isArchived: false },
      }),
      prisma.testRun.count({
        where: {
          projectId,
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
      prisma.testResponse.count({
        where: {
          testRun: {
            projectId,
            createdAt: { gte: range.start, lte: range.end },
          },
        },
      }),
      prisma.testResponse.aggregate({
        where: {
          testRun: {
            projectId,
            createdAt: { gte: range.start, lte: range.end },
          },
        },
        _avg: { cost: true, latencyMs: true },
        _sum: { cost: true },
      }),
      prisma.testRun.findMany({
        where: {
          projectId,
          createdAt: { gte: range.start, lte: range.end },
        },
        select: { status: true },
      }),
    ]);

    const successfulRuns = testRunStats.filter(run => run.status === 'COMPLETED').length;
    const successRate = totalTestRuns > 0 ? (successfulRuns / totalTestRuns) * 100 : 0;

    return {
      totalPrompts,
      totalTestRuns,
      totalResponses,
      totalCost: responseStats._sum.cost || 0,
      avgLatency: responseStats._avg.latencyMs || 0,
      successRate,
    };
  }

  /**
   * Get time series data for charts
   */
  private static async getProjectTimeSeries(
    projectId: string,
    range: AnalyticsTimeRange
  ) {
    // Generate daily buckets
    const days: string[] = [];
    const current = new Date(range.start);
    while (current <= range.end) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const timeSeriesData = await Promise.all(
      days.map(async (date) => {
        const dayStart = new Date(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const [testRuns, responses] = await Promise.all([
          prisma.testRun.count({
            where: {
              projectId,
              createdAt: { gte: dayStart, lt: dayEnd },
            },
          }),
          prisma.testResponse.aggregate({
            where: {
              testRun: {
                projectId,
                createdAt: { gte: dayStart, lt: dayEnd },
              },
            },
            _avg: { latencyMs: true },
            _sum: { cost: true },
            _count: true,
          }),
        ]);

        const successfulRuns = await prisma.testRun.count({
          where: {
            projectId,
            createdAt: { gte: dayStart, lt: dayEnd },
            status: 'COMPLETED',
          },
        });

        return {
          date,
          testRuns,
          cost: responses._sum.cost || 0,
          avgLatency: responses._avg.latencyMs || 0,
          successRate: testRuns > 0 ? (successfulRuns / testRuns) * 100 : 0,
        };
      })
    );

    return timeSeriesData;
  }

  /**
   * Get model performance metrics
   */
  private static async getModelPerformance(
    projectId: string,
    range: AnalyticsTimeRange
  ) {
    const responses = await prisma.testResponse.findMany({
      where: {
        testRun: {
          projectId,
          createdAt: { gte: range.start, lte: range.end },
        },
      },
      select: {
        modelProvider: true,
        modelName: true,
        latencyMs: true,
        cost: true,
        error: true,
      },
    });

    // Group by model
    const modelGroups = responses.reduce((acc, response) => {
      const key = `${response.modelProvider}/${response.modelName}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(response);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(modelGroups).map(([model, modelResponses]) => {
      const totalCost = modelResponses.reduce((sum, r) => sum + (r.cost || 0), 0);
      const avgLatency = modelResponses.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / modelResponses.length;
      const successCount = modelResponses.filter(r => !r.error).length;
      const successRate = (successCount / modelResponses.length) * 100;

      return {
        model,
        responseCount: modelResponses.length,
        avgLatency: Math.round(avgLatency),
        totalCost: Math.round(totalCost * 10000) / 10000,
        successRate: Math.round(successRate),
      };
    });
  }

  /**
   * Get prompt performance metrics
   */
  private static async getPromptPerformance(
    projectId: string,
    range: AnalyticsTimeRange
  ) {
    const testRuns = await prisma.testRun.findMany({
      where: {
        projectId,
        createdAt: { gte: range.start, lte: range.end },
      },
      include: {
        prompt: {
          select: {
            id: true,
            name: true,
          },
        },
        responses: {
          select: {
            latencyMs: true,
            cost: true,
            error: true,
          },
        },
      },
    });

    // Group by prompt
    const promptGroups = testRuns.reduce((acc, testRun) => {
      const key = testRun.promptId;
      if (!acc[key]) {
        acc[key] = {
          promptId: testRun.promptId,
          promptName: testRun.prompt.name,
          testRuns: [],
          lastTested: testRun.createdAt,
        };
      }
      acc[key].testRuns.push(testRun);
      if (testRun.createdAt > acc[key].lastTested) {
        acc[key].lastTested = testRun.createdAt;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(promptGroups).map((group: any) => {
      const allResponses = group.testRuns.flatMap((tr: any) => tr.responses);
      const totalCost = allResponses.reduce((sum: number, r: any) => sum + (r.cost || 0), 0);
      const avgLatency = allResponses.length > 0 
        ? allResponses.reduce((sum: number, r: any) => sum + (r.latencyMs || 0), 0) / allResponses.length 
        : 0;
      const successCount = allResponses.filter((r: any) => !r.error).length;
      const successRate = allResponses.length > 0 ? (successCount / allResponses.length) * 100 : 0;

      return {
        promptId: group.promptId,
        promptName: group.promptName,
        testRuns: group.testRuns.length,
        avgLatency: Math.round(avgLatency),
        totalCost: Math.round(totalCost * 10000) / 10000,
        successRate: Math.round(successRate),
        lastTested: group.lastTested,
      };
    });
  }

  /**
   * Get cost breakdown
   */
  private static async getCostBreakdown(
    projectId: string,
    range: AnalyticsTimeRange
  ) {
    const responses = await prisma.testResponse.findMany({
      where: {
        testRun: {
          projectId,
          createdAt: { gte: range.start, lte: range.end },
        },
      },
      select: {
        modelProvider: true,
        modelName: true,
        cost: true,
        createdAt: true,
        testRun: {
          select: {
            promptId: true,
            prompt: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // By model
    const byModel = responses.reduce((acc, response) => {
      const key = `${response.modelProvider}/${response.modelName}`;
      acc[key] = (acc[key] || 0) + (response.cost || 0);
      return acc;
    }, {} as Record<string, number>);

    // By prompt
    const byPrompt = responses.reduce((acc, response) => {
      const key = response.testRun.prompt.name;
      acc[key] = (acc[key] || 0) + (response.cost || 0);
      return acc;
    }, {} as Record<string, number>);

    // By time range (weekly)
    const byTimeRange = responses.reduce((acc, response) => {
      const week = this.getWeekKey(response.createdAt);
      acc[week] = (acc[week] || 0) + (response.cost || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      byModel,
      byPrompt,
      byTimeRange,
    };
  }

  /**
   * Get usage metrics
   */
  private static async getUsageMetrics(
    projectId: string,
    range: AnalyticsTimeRange
  ) {
    const responses = await prisma.testResponse.findMany({
      where: {
        testRun: {
          projectId,
          createdAt: { gte: range.start, lte: range.end },
        },
      },
      select: {
        tokenUsage: true,
        createdAt: true,
      },
    });

    const tokensUsed = responses.reduce(
      (acc, response) => {
        const usage = response.tokenUsage as any;
        if (usage) {
          acc.total += usage.totalTokens || 0;
          acc.input += usage.promptTokens || 0;
          acc.output += usage.completionTokens || 0;
        }
        return acc;
      },
      { total: 0, input: 0, output: 0 }
    );

    const dayCount = Math.max(1, (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
    const avgRequestsPerDay = responses.length / dayCount;

    return {
      tokensUsed,
      requestCount: responses.length,
      avgRequestsPerDay: Math.round(avgRequestsPerDay * 100) / 100,
    };
  }

  /**
   * Get user analytics across all projects
   */
  static async getUserAnalytics(
    userId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<UserAnalytics> {
    const range = timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    // Get user's projects
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });

    const projectIds = projects.map(p => p.id);

    // Get overview
    const [totalTestRuns, costSum, activeProjectsCount] = await Promise.all([
      prisma.testRun.count({
        where: {
          userId,
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
      prisma.testResponse.aggregate({
        where: {
          testRun: {
            userId,
            createdAt: { gte: range.start, lte: range.end },
          },
        },
        _sum: { cost: true },
      }),
      prisma.testRun.groupBy({
        by: ['projectId'],
        where: {
          userId,
          createdAt: { gte: range.start, lte: range.end },
        },
      }).then(groups => groups.length),
    ]);

    const overview = {
      totalProjects: projects.length,
      totalTestRuns,
      totalCost: costSum._sum.cost || 0,
      activeProjects: activeProjectsCount,
    };

    // Get recent activity (daily)
    const recentActivity = await this.getUserDailyActivity(userId, range);

    // Get project breakdown
    const projectBreakdown = await this.getUserProjectBreakdown(userId, projectIds, range);

    return {
      overview,
      recentActivity,
      projectBreakdown,
    };
  }

  /**
   * Get user daily activity
   */
  private static async getUserDailyActivity(
    userId: string,
    range: AnalyticsTimeRange
  ) {
    const days: string[] = [];
    const current = new Date(range.start);
    while (current <= range.end) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return Promise.all(
      days.map(async (date) => {
        const dayStart = new Date(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const [testRuns, costSum] = await Promise.all([
          prisma.testRun.count({
            where: {
              userId,
              createdAt: { gte: dayStart, lt: dayEnd },
            },
          }),
          prisma.testResponse.aggregate({
            where: {
              testRun: {
                userId,
                createdAt: { gte: dayStart, lt: dayEnd },
              },
            },
            _sum: { cost: true },
          }),
        ]);

        return {
          date,
          testRuns,
          cost: costSum._sum.cost || 0,
        };
      })
    );
  }

  /**
   * Get user project breakdown
   */
  private static async getUserProjectBreakdown(
    userId: string,
    projectIds: string[],
    range: AnalyticsTimeRange
  ) {
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });

    return Promise.all(
      projects.map(async (project) => {
        const [testRuns, costSum] = await Promise.all([
          prisma.testRun.count({
            where: {
              projectId: project.id,
              userId,
              createdAt: { gte: range.start, lte: range.end },
            },
          }),
          prisma.testResponse.aggregate({
            where: {
              testRun: {
                projectId: project.id,
                userId,
                createdAt: { gte: range.start, lte: range.end },
              },
            },
            _sum: { cost: true },
          }),
        ]);

        return {
          projectId: project.id,
          projectName: project.name,
          testRuns,
          cost: costSum._sum.cost || 0,
          lastActivity: project.updatedAt,
        };
      })
    );
  }

  /**
   * Get week key for grouping
   */
  private static getWeekKey(date: Date): string {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    return startOfWeek.toISOString().split('T')[0];
  }

  /**
   * Export analytics data
   */
  static async exportProjectAnalytics(
    projectId: string,
    userId: string,
    format: 'json' | 'csv' = 'json',
    timeRange?: AnalyticsTimeRange
  ): Promise<string> {
    const analytics = await this.getProjectAnalytics(projectId, userId, timeRange);

    if (format === 'csv') {
      return this.convertToCSV(analytics);
    }

    return JSON.stringify(analytics, null, 2);
  }

  /**
   * Convert analytics to CSV format
   */
  private static convertToCSV(analytics: ProjectAnalytics): string {
    const headers = ['Date', 'Test Runs', 'Cost', 'Avg Latency', 'Success Rate'];
    const rows = analytics.timeSeriesData.map(data => [
      data.date,
      data.testRuns,
      data.cost,
      data.avgLatency,
      data.successRate,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}