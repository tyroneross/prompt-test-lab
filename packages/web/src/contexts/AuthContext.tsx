/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, LoginRequest, RegisterRequest, LoginResponse } from '@/lib/api/auth';
import { apiClient } from '@/lib/api-client';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  requestMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string, email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const isAuthenticated = !!user;

  const saveTokens = (token: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    apiClient.setAuthToken(token);
  };

  const clearTokens = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    apiClient.removeAuthToken();
  };

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response = await authApi.login(credentials);
      saveTokens(response.token, response.refreshToken);
      setUser(response.user);
      navigate('/dashboard');
    } catch (error) {
      clearTokens();
      throw error;
    }
  }, [navigate]);

  const register = useCallback(async (userData: RegisterRequest) => {
    try {
      const response = await authApi.register(userData);
      saveTokens(response.token, response.refreshToken);
      setUser(response.user);
      navigate('/dashboard');
    } catch (error) {
      clearTokens();
      throw error;
    }
  }, [navigate]);

  const loginAsDemo = useCallback(async () => {
    try {
      // Create a mock demo user
      const demoUser: User = {
        id: 'demo-user-id',
        email: 'demo@prompttestinglab.com',
        name: 'Demo User',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        role: 'editor',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Set mock tokens to simulate authentication
      const mockToken = 'demo-jwt-token';
      const mockRefreshToken = 'demo-refresh-token';
      saveTokens(mockToken, mockRefreshToken);
      
      setUser(demoUser);
      navigate('/dashboard');
    } catch (error) {
      clearTokens();
      throw error;
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const refreshToken = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await authApi.refreshToken({ refreshToken });
      localStorage.setItem(TOKEN_KEY, response.token);
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    }
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      apiClient.setAuthToken(token);
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestMagicLink = useCallback(async (email: string) => {
    try {
      await authApi.requestMagicLink(email);
      // Success - caller should navigate to magic link sent page
    } catch (error) {
      throw error;
    }
  }, []);

  const verifyMagicLink = useCallback(async (token: string, email: string) => {
    try {
      const response = await authApi.verifyMagicLink(token, email);
      saveTokens(response.token, response.refreshToken);
      setUser(response.user);
      navigate('/dashboard');
    } catch (error) {
      clearTokens();
      throw error;
    }
  }, [navigate]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
    loginAsDemo,
    requestMagicLink,
    verifyMagicLink,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};