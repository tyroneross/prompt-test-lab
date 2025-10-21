/**
 * Projects API Functions
 */

import { apiClient } from '../api-client';
import { Project, ProjectMember, ProjectSettings, ApiResponse, PaginationParams } from '@/types';

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export const projectsApi = {
  /**
   * Get all projects for current user
   */
  getProjects: async (params?: PaginationParams): Promise<{ projects: Project[]; total: number }> => {
    const response = await apiClient.get<ApiResponse<{ projects: Project[]; total: number }>>(
      '/projects',
      params
    );
    return response.data!;
  },

  /**
   * Get project by ID
   */
  getProject: async (projectId: string): Promise<Project> => {
    const response = await apiClient.get<ApiResponse<Project>>(`/projects/${projectId}`);
    return response.data!;
  },

  /**
   * Create new project
   */
  createProject: async (data: CreateProjectRequest): Promise<Project> => {
    const response = await apiClient.post<ApiResponse<Project>>('/projects', data);
    return response.data!;
  },

  /**
   * Update project
   */
  updateProject: async (projectId: string, data: UpdateProjectRequest): Promise<Project> => {
    const response = await apiClient.patch<ApiResponse<Project>>(`/projects/${projectId}`, data);
    return response.data!;
  },

  /**
   * Delete project
   */
  deleteProject: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}`);
  },

  /**
   * Get project members
   */
  getProjectMembers: async (projectId: string): Promise<ProjectMember[]> => {
    const response = await apiClient.get<ApiResponse<ProjectMember[]>>(`/projects/${projectId}/members`);
    return response.data!;
  },

  /**
   * Invite member to project
   */
  inviteMember: async (projectId: string, data: InviteMemberRequest): Promise<ProjectMember> => {
    const response = await apiClient.post<ApiResponse<ProjectMember>>(
      `/projects/${projectId}/members`,
      data
    );
    return response.data!;
  },

  /**
   * Update member role
   */
  updateMemberRole: async (
    projectId: string,
    userId: string,
    role: 'admin' | 'editor' | 'viewer'
  ): Promise<ProjectMember> => {
    const response = await apiClient.patch<ApiResponse<ProjectMember>>(
      `/projects/${projectId}/members/${userId}`,
      { role }
    );
    return response.data!;
  },

  /**
   * Remove member from project
   */
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/members/${userId}`);
  },

  /**
   * Update project settings
   */
  updateSettings: async (projectId: string, settings: Partial<ProjectSettings>): Promise<ProjectSettings> => {
    const response = await apiClient.patch<ApiResponse<ProjectSettings>>(
      `/projects/${projectId}/settings`,
      settings
    );
    return response.data!;
  },
};