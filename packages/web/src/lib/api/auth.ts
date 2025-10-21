/**
 * Authentication API Functions
 */

import { apiClient } from '../api-client';
import { User, ApiResponse } from '@/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export const authApi = {
  /**
   * Login user
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    return response.data!;
  },

  /**
   * Register new user
   */
  register: async (userData: RegisterRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/register', userData);
    return response.data!;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshData: RefreshTokenRequest): Promise<{ token: string }> => {
    const response = await apiClient.post<ApiResponse<{ token: string }>>('/auth/refresh', refreshData);
    return response.data!;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data!;
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>('/auth/me', updates);
    return response.data!;
  },

  /**
   * Change password
   */
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.post('/auth/change-password', data);
  },

  /**
   * Request password reset
   */
  requestPasswordReset: async (email: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { email });
  },

  /**
   * Reset password with token
   */
  resetPassword: async (data: { token: string; newPassword: string; email: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password/confirm', data);
  },

  /**
   * Request magic link for passwordless authentication
   */
  requestMagicLink: async (email: string): Promise<void> => {
    const response = await apiClient.post<ApiResponse<{ message: string; expiresInMinutes: number }>>('/auth/magic-link/send', { email });
    console.log(`Magic link sent to ${email} - expires in ${response.data?.expiresInMinutes || 15} minutes`);
  },

  /**
   * Verify magic link token and authenticate user
   */
  verifyMagicLink: async (token: string, email: string): Promise<LoginResponse> => {
    const response = await apiClient.get<ApiResponse<LoginResponse>>(`/auth/magic-link/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
    return response.data!;
  },
};