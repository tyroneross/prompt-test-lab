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
   * @deprecated Backend endpoint not yet implemented - PATCH /auth/me needed
   */
  updateProfile: async (updates: Partial<User>): Promise<User> => {
    // TODO: Backend needs to implement PATCH /auth/me endpoint
    throw new Error('Profile update endpoint not yet implemented in backend');
  },

  /**
   * Change password
   * @deprecated Backend endpoint not yet implemented - POST /auth/change-password needed
   */
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    // TODO: Backend needs to implement POST /auth/change-password endpoint
    throw new Error('Change password endpoint not yet implemented in backend');
  },

  /**
   * Request password reset
   * @deprecated Backend endpoint not yet implemented - POST /auth/reset-password needed
   */
  requestPasswordReset: async (email: string): Promise<void> => {
    // TODO: Backend needs to implement POST /auth/reset-password endpoint
    throw new Error('Password reset endpoint not yet implemented in backend');
  },

  /**
   * Reset password with token
   * @deprecated Backend endpoint not yet implemented - POST /auth/reset-password/confirm needed
   */
  resetPassword: async (data: { token: string; password: string }): Promise<void> => {
    // TODO: Backend needs to implement POST /auth/reset-password/confirm endpoint
    throw new Error('Password reset confirmation endpoint not yet implemented in backend');
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