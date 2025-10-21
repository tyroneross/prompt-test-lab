/**
 * Tests API Functions
 */

import { apiClient } from '../api-client';
import { 
  TestConfiguration, 
  TestSession, 
  TestExecution, 
  TestContent,
  TestParameters,
  ApiResponse, 
  PaginationParams 
} from '@/types';

export interface CreateTestRequest {
  name: string;
  description?: string;
  prompts: string[]; // Prompt IDs
  models: string[]; // Model IDs
  content: Omit<TestContent, 'id'>[];
  parameters?: TestParameters;
}

export interface UpdateTestRequest {
  name?: string;
  description?: string;
  prompts?: string[];
  models?: string[];
  content?: Omit<TestContent, 'id'>[];
  parameters?: TestParameters;
}

export const testsApi = {
  /**
   * Get all test configurations for a project
   */
  getTestConfigurations: async (
    projectId: string,
    params?: PaginationParams
  ): Promise<{ configurations: TestConfiguration[]; total: number }> => {
    const response = await apiClient.get<ApiResponse<{ configurations: TestConfiguration[]; total: number }>>(
      `/projects/${projectId}/tests/configurations`,
      params
    );
    return response.data!;
  },

  /**
   * Get test configuration by ID
   */
  getTestConfiguration: async (projectId: string, configId: string): Promise<TestConfiguration> => {
    const response = await apiClient.get<ApiResponse<TestConfiguration>>(
      `/projects/${projectId}/tests/configurations/${configId}`
    );
    return response.data!;
  },

  /**
   * Create new test configuration
   */
  createTestConfiguration: async (
    projectId: string,
    data: CreateTestRequest
  ): Promise<TestConfiguration> => {
    const response = await apiClient.post<ApiResponse<TestConfiguration>>(
      `/projects/${projectId}/tests/configurations`,
      data
    );
    return response.data!;
  },

  /**
   * Update test configuration
   */
  updateTestConfiguration: async (
    projectId: string,
    configId: string,
    data: UpdateTestRequest
  ): Promise<TestConfiguration> => {
    const response = await apiClient.patch<ApiResponse<TestConfiguration>>(
      `/projects/${projectId}/tests/configurations/${configId}`,
      data
    );
    return response.data!;
  },

  /**
   * Delete test configuration
   */
  deleteTestConfiguration: async (projectId: string, configId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/tests/configurations/${configId}`);
  },

  /**
   * Get all test sessions for a project
   */
  getTestSessions: async (
    projectId: string,
    params?: PaginationParams & { 
      status?: string[];
      configurationId?: string;
    }
  ): Promise<{ sessions: TestSession[]; total: number }> => {
    const response = await apiClient.get<ApiResponse<{ sessions: TestSession[]; total: number }>>(
      `/projects/${projectId}/tests/sessions`,
      params
    );
    return response.data!;
  },

  /**
   * Get test session by ID
   */
  getTestSession: async (projectId: string, sessionId: string): Promise<TestSession> => {
    const response = await apiClient.get<ApiResponse<TestSession>>(
      `/projects/${projectId}/tests/sessions/${sessionId}`
    );
    return response.data!;
  },

  /**
   * Create and start new test session
   */
  startTestSession: async (
    projectId: string,
    configurationId: string,
    name?: string
  ): Promise<TestSession> => {
    const response = await apiClient.post<ApiResponse<TestSession>>(
      `/projects/${projectId}/tests/sessions`,
      { configurationId, name }
    );
    return response.data!;
  },

  /**
   * Pause test session
   */
  pauseTestSession: async (projectId: string, sessionId: string): Promise<TestSession> => {
    const response = await apiClient.post<ApiResponse<TestSession>>(
      `/projects/${projectId}/tests/sessions/${sessionId}/pause`
    );
    return response.data!;
  },

  /**
   * Resume test session
   */
  resumeTestSession: async (projectId: string, sessionId: string): Promise<TestSession> => {
    const response = await apiClient.post<ApiResponse<TestSession>>(
      `/projects/${projectId}/tests/sessions/${sessionId}/resume`
    );
    return response.data!;
  },

  /**
   * Cancel test session
   */
  cancelTestSession: async (projectId: string, sessionId: string): Promise<TestSession> => {
    const response = await apiClient.post<ApiResponse<TestSession>>(
      `/projects/${projectId}/tests/sessions/${sessionId}/cancel`
    );
    return response.data!;
  },

  /**
   * Get test executions for a session
   */
  getTestExecutions: async (
    projectId: string,
    sessionId: string,
    params?: PaginationParams & {
      status?: string[];
      modelId?: string;
      promptId?: string;
    }
  ): Promise<{ executions: TestExecution[]; total: number }> => {
    const response = await apiClient.get<ApiResponse<{ executions: TestExecution[]; total: number }>>(
      `/projects/${projectId}/tests/sessions/${sessionId}/executions`,
      params
    );
    return response.data!;
  },

  /**
   * Get single test execution
   */
  getTestExecution: async (
    projectId: string,
    sessionId: string,
    executionId: string
  ): Promise<TestExecution> => {
    const response = await apiClient.get<ApiResponse<TestExecution>>(
      `/projects/${projectId}/tests/sessions/${sessionId}/executions/${executionId}`
    );
    return response.data!;
  },

  /**
   * Retry failed test execution
   */
  retryTestExecution: async (
    projectId: string,
    sessionId: string,
    executionId: string
  ): Promise<TestExecution> => {
    const response = await apiClient.post<ApiResponse<TestExecution>>(
      `/projects/${projectId}/tests/sessions/${sessionId}/executions/${executionId}/retry`
    );
    return response.data!;
  },

  /**
   * Upload test content files
   */
  uploadTestContent: async (
    projectId: string,
    files: File[]
  ): Promise<{ content: TestContent[]; errors: string[] }> => {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });

    const response = await apiClient.upload<ApiResponse<{ content: TestContent[]; errors: string[] }>>(
      `/projects/${projectId}/tests/content/upload`,
      formData as any
    );
    return response.data!;
  },

  /**
   * Get available models
   */
  getAvailableModels: async (projectId: string): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>(`/projects/${projectId}/tests/models`);
    return response.data!;
  },

  /**
   * Estimate test cost
   */
  estimateTestCost: async (
    projectId: string,
    data: {
      prompts: string[];
      models: string[];
      contentCount: number;
      parameters?: TestParameters;
    }
  ): Promise<{ estimatedCost: number; estimatedTime: number; breakdown: any[] }> => {
    const response = await apiClient.post<ApiResponse<{ 
      estimatedCost: number; 
      estimatedTime: number; 
      breakdown: any[] 
    }>>(
      `/projects/${projectId}/tests/estimate`,
      data
    );
    return response.data!;
  },

  /**
   * Export test results
   */
  exportTestResults: async (
    projectId: string,
    sessionId: string,
    format: 'json' | 'csv' | 'xlsx' = 'json'
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/projects/${projectId}/tests/sessions/${sessionId}/export`,
      { format }
    );
    return response as any; // Blob response
  },

  /**
   * Compare test results
   */
  compareResults: async (
    projectId: string,
    executionIds: string[]
  ): Promise<{
    executions: TestExecution[];
    comparison: {
      metrics: any[];
      differences: any[];
      summary: any;
    };
  }> => {
    const response = await apiClient.post<ApiResponse<{
      executions: TestExecution[];
      comparison: {
        metrics: any[];
        differences: any[];
        summary: any;
      };
    }>>(
      `/projects/${projectId}/tests/compare`,
      { executionIds }
    );
    return response.data!;
  },
};