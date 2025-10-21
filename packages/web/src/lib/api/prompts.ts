/**
 * Prompts API Functions
 */

import { apiClient } from '../api-client';
import { PromptTemplate, ApiResponse, PaginationParams } from '@/types';

export interface CreatePromptRequest {
  name: string;
  content: string;
  description?: string;
  tags?: string[];
  variables?: PromptTemplate['variables'];
}

export interface UpdatePromptRequest {
  name?: string;
  content?: string;
  description?: string;
  tags?: string[];
  variables?: PromptTemplate['variables'];
}

export interface DuplicatePromptRequest {
  name: string;
  description?: string;
}

export const promptsApi = {
  /**
   * Get all prompts for a project
   */
  getPrompts: async (
    projectId: string,
    params?: PaginationParams & { 
      tags?: string[];
      isArchived?: boolean;
    }
  ): Promise<{ prompts: PromptTemplate[]; total: number }> => {
    const response = await apiClient.get<ApiResponse<{ prompts: PromptTemplate[]; total: number }>>(
      `/projects/${projectId}/prompts`,
      params
    );
    return response.data!;
  },

  /**
   * Get prompt by ID
   */
  getPrompt: async (projectId: string, promptId: string): Promise<PromptTemplate> => {
    const response = await apiClient.get<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts/${promptId}`
    );
    return response.data!;
  },

  /**
   * Create new prompt
   */
  createPrompt: async (projectId: string, data: CreatePromptRequest): Promise<PromptTemplate> => {
    const response = await apiClient.post<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts`,
      data
    );
    return response.data!;
  },

  /**
   * Update prompt
   */
  updatePrompt: async (
    projectId: string,
    promptId: string,
    data: UpdatePromptRequest
  ): Promise<PromptTemplate> => {
    const response = await apiClient.patch<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts/${promptId}`,
      data
    );
    return response.data!;
  },

  /**
   * Duplicate prompt
   */
  duplicatePrompt: async (
    projectId: string,
    promptId: string,
    data: DuplicatePromptRequest
  ): Promise<PromptTemplate> => {
    const response = await apiClient.post<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts/${promptId}/duplicate`,
      data
    );
    return response.data!;
  },

  /**
   * Archive prompt
   */
  archivePrompt: async (projectId: string, promptId: string): Promise<PromptTemplate> => {
    const response = await apiClient.patch<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts/${promptId}`,
      { isArchived: true }
    );
    return response.data!;
  },

  /**
   * Restore archived prompt
   */
  restorePrompt: async (projectId: string, promptId: string): Promise<PromptTemplate> => {
    const response = await apiClient.patch<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts/${promptId}`,
      { isArchived: false }
    );
    return response.data!;
  },

  /**
   * Delete prompt permanently
   */
  deletePrompt: async (projectId: string, promptId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/prompts/${promptId}`);
  },

  /**
   * Get prompt versions
   */
  getPromptVersions: async (projectId: string, promptId: string): Promise<PromptTemplate[]> => {
    const response = await apiClient.get<ApiResponse<PromptTemplate[]>>(
      `/projects/${projectId}/prompts/${promptId}/versions`
    );
    return response.data!;
  },

  /**
   * Create new version of prompt
   */
  createPromptVersion: async (
    projectId: string,
    promptId: string,
    data: UpdatePromptRequest
  ): Promise<PromptTemplate> => {
    const response = await apiClient.post<ApiResponse<PromptTemplate>>(
      `/projects/${projectId}/prompts/${promptId}/versions`,
      data
    );
    return response.data!;
  },

  /**
   * Get available tags
   */
  getTags: async (projectId: string): Promise<string[]> => {
    const response = await apiClient.get<ApiResponse<string[]>>(`/projects/${projectId}/prompts/tags`);
    return response.data!;
  },

  /**
   * Import prompts from file
   */
  importPrompts: async (projectId: string, file: File): Promise<{ imported: number; errors: string[] }> => {
    const response = await apiClient.upload<ApiResponse<{ imported: number; errors: string[] }>>(
      `/projects/${projectId}/prompts/import`,
      file
    );
    return response.data!;
  },

  /**
   * Export prompts
   */
  exportPrompts: async (
    projectId: string,
    promptIds?: string[],
    format: 'json' | 'csv' = 'json'
  ): Promise<Blob> => {
    const params = { format, ...(promptIds && { promptIds: promptIds.join(',') }) };
    const response = await apiClient.get(`/projects/${projectId}/prompts/export`, params);
    return response as any; // Blob response
  },
};