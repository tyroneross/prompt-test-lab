/**
 * Analytics API Functions
 */

import { apiClient } from '../api-client';
import { AnalyticsData, ApiResponse } from '@/types';

export interface AnalyticsQuery {
  timeRange: {
    start: string;
    end: string;
  };
  metrics?: string[];
  groupBy?: string[];
  filters?: {
    models?: string[];
    prompts?: string[];
    status?: string[];
  };
}

export const analyticsApi = {
  /**
   * Get analytics dashboard data
   */
  getDashboardAnalytics: async (
    projectId: string,
    query: AnalyticsQuery
  ): Promise<AnalyticsData> => {
    const response = await apiClient.post<ApiResponse<AnalyticsData>>(
      `/projects/${projectId}/analytics/dashboard`,
      query
    );
    return response.data!;
  },

  /**
   * Get test performance metrics
   */
  getTestMetrics: async (
    projectId: string,
    query: AnalyticsQuery & {
      testIds?: string[];
      sessionIds?: string[];
    }
  ): Promise<{
    metrics: Array<{
      testId: string;
      testName: string;
      successRate: number;
      averageLatency: number;
      totalCost: number;
      tokenUsage: number;
    }>;
    trends: {
      successRate: Array<{ timestamp: string; value: number }>;
      latency: Array<{ timestamp: string; value: number }>;
      cost: Array<{ timestamp: string; value: number }>;
    };
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/projects/${projectId}/analytics/tests`,
      query
    );
    return response.data!;
  },

  /**
   * Get model performance comparison
   */
  getModelComparison: async (
    projectId: string,
    query: AnalyticsQuery & {
      modelIds: string[];
    }
  ): Promise<{
    models: Array<{
      modelId: string;
      modelName: string;
      tests: number;
      successRate: number;
      averageLatency: number;
      totalCost: number;
      averageCost: number;
      strengths: string[];
      weaknesses: string[];
    }>;
    comparison: {
      bestFor: {
        speed: string;
        cost: string;
        accuracy: string;
      };
      rankings: Array<{
        modelId: string;
        score: number;
        rank: number;
      }>;
    };
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/projects/${projectId}/analytics/models`,
      query
    );
    return response.data!;
  },

  /**
   * Get prompt performance analysis
   */
  getPromptAnalysis: async (
    projectId: string,
    query: AnalyticsQuery & {
      promptIds: string[];
    }
  ): Promise<{
    prompts: Array<{
      promptId: string;
      promptName: string;
      tests: number;
      successRate: number;
      averageQuality: number;
      totalCost: number;
      improvements: string[];
    }>;
    insights: {
      topPerforming: string[];
      needsImprovement: string[];
      suggestions: Array<{
        promptId: string;
        suggestion: string;
        impact: 'high' | 'medium' | 'low';
      }>;
    };
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/projects/${projectId}/analytics/prompts`,
      query
    );
    return response.data!;
  },

  /**
   * Get cost analysis
   */
  getCostAnalysis: async (
    projectId: string,
    query: AnalyticsQuery
  ): Promise<{
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
    trends: Array<{
      timestamp: string;
      amount: number;
      breakdown: Record<string, number>;
    }>;
    projections: {
      nextMonth: number;
      nextQuarter: number;
      confidence: number;
    };
    optimization: Array<{
      suggestion: string;
      potentialSavings: number;
      effort: 'low' | 'medium' | 'high';
    }>;
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/projects/${projectId}/analytics/costs`,
      query
    );
    return response.data!;
  },

  /**
   * Get usage patterns
   */
  getUsagePatterns: async (
    projectId: string,
    query: AnalyticsQuery
  ): Promise<{
    patterns: {
      peakHours: Array<{ hour: number; usage: number }>;
      weeklyDistribution: Array<{ day: string; usage: number }>;
      userActivity: Array<{ userId: string; userName: string; tests: number }>;
    };
    insights: Array<{
      type: 'peak_usage' | 'low_activity' | 'user_behavior' | 'efficiency';
      title: string;
      description: string;
      recommendation?: string;
    }>;
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/projects/${projectId}/analytics/usage`,
      query
    );
    return response.data!;
  },

  /**
   * Get quality metrics
   */
  getQualityMetrics: async (
    projectId: string,
    query: AnalyticsQuery & {
      qualityDimensions?: string[];
    }
  ): Promise<{
    overall: {
      averageScore: number;
      trend: 'improving' | 'declining' | 'stable';
      distribution: Array<{ score: number; count: number }>;
    };
    dimensions: Array<{
      name: string;
      averageScore: number;
      trend: 'improving' | 'declining' | 'stable';
      topPrompts: Array<{ promptId: string; score: number }>;
      bottomPrompts: Array<{ promptId: string; score: number }>;
    }>;
    correlations: Array<{
      factor: string;
      correlation: number;
      significance: 'high' | 'medium' | 'low';
    }>;
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/projects/${projectId}/analytics/quality`,
      query
    );
    return response.data!;
  },

  /**
   * Export analytics report
   */
  exportReport: async (
    projectId: string,
    query: AnalyticsQuery & {
      format: 'pdf' | 'xlsx' | 'csv';
      sections: string[];
    }
  ): Promise<Blob> => {
    const response = await apiClient.post(
      `/projects/${projectId}/analytics/export`,
      query
    );
    return response as any; // Blob response
  },

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics: async (projectId: string): Promise<{
    activeTests: number;
    queuedTests: number;
    completedToday: number;
    failedToday: number;
    currentCostRate: number;
    estimatedDailyCost: number;
  }> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/projects/${projectId}/analytics/realtime`
    );
    return response.data!;
  },
};