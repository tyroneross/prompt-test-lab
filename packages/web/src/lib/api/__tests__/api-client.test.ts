/**
 * API Client Integration Tests
 * 
 * Tests the frontend API client including authentication,
 * error handling, request/response transformation, and state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../../api-client';
import * as authApi from '../auth';
import * as projectsApi from '../projects';
import * as promptsApi from '../prompts';
import { TEST_PASSWORDS } from '../../../test/constants/test-credentials';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('API Client Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient({
      baseURL: 'http://localhost:3001/api',
      timeout: 5000
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should login and store authentication token', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'test@test.com' },
          token: 'jwt-token-123'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await apiClient.auth.login('test@test.com', TEST_PASSWORDS.VALID_TEST_PASSWORD);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@test.com',
            password: TEST_PASSWORDS.VALID_TEST_PASSWORD
          })
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
    });

    it('should include authentication token in subsequent requests', async () => {
      mockLocalStorage.getItem.mockReturnValue('jwt-token-123');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      });

      await apiClient.projects.list();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer jwt-token-123'
          })
        })
      );
    });

    it('should handle authentication errors and clear stored token', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Invalid token'
        })
      });

      await expect(apiClient.projects.list()).rejects.toThrow('Invalid token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('Request/Response Handling', () => {
    it('should handle successful responses', async () => {
      const mockData = {
        success: true,
        data: { id: '1', name: 'Test Project' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData
      });

      const result = await apiClient.projects.get('1');

      expect(result).toEqual(mockData.data);
    });

    it('should handle error responses', async () => {
      const mockError = {
        success: false,
        error: 'Project not found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => mockError
      });

      await expect(apiClient.projects.get('invalid-id')).rejects.toThrow('Project not found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.projects.list()).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const apiClientWithShortTimeout = new ApiClient({
        baseURL: 'http://localhost:3001/api',
        timeout: 100
      });

      // Mock a delayed response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(apiClientWithShortTimeout.projects.list()).rejects.toThrow(/timeout/i);
    });
  });

  describe('Request Transformation', () => {
    it('should transform request data correctly', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        settings: { maxTests: 5 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { id: '1', ...projectData }
        })
      });

      await apiClient.projects.create(projectData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(projectData)
        })
      );
    });

    it('should handle query parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { projects: [], total: 0, page: 1 }
        })
      });

      await apiClient.projects.list({
        page: 2,
        limit: 20,
        search: 'test query'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/projects?page=2&limit=20&search=test%20query',
        expect.any(Object)
      );
    });
  });

  describe('Response Caching', () => {
    it('should cache GET requests when enabled', async () => {
      const mockData = {
        success: true,
        data: { id: '1', name: 'Cached Project' }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      });

      // First request
      const result1 = await apiClient.projects.get('1', { cache: true });
      
      // Second request (should use cache)
      const result2 = await apiClient.projects.get('1', { cache: true });

      expect(result1).toEqual(mockData.data);
      expect(result2).toEqual(mockData.data);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one actual network request
    });

    it('should invalidate cache after mutations', async () => {
      const getResponse = {
        success: true,
        data: { id: '1', name: 'Project' }
      };

      const updateResponse = {
        success: true,
        data: { id: '1', name: 'Updated Project' }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => getResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updateResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updateResponse
        });

      // First GET request (cached)
      await apiClient.projects.get('1', { cache: true });

      // Update request (should invalidate cache)
      await apiClient.projects.update('1', { name: 'Updated Project' });

      // Second GET request (should make new network request)
      await apiClient.projects.get('1', { cache: true });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const apiClientWithRetry = new ApiClient({
        baseURL: 'http://localhost:3001/api',
        retries: 2,
        retryDelay: 100
      });

      // Mock 2 failures followed by success
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: []
          })
        });

      const result = await apiClientWithRetry.projects.list();

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const apiClientWithRetry = new ApiClient({
        baseURL: 'http://localhost:3001/api',
        retries: 2
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Bad request'
        })
      });

      await expect(apiClientWithRetry.projects.list()).rejects.toThrow('Bad request');
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry for 4xx errors
    });
  });

  describe('Request Interceptors', () => {
    it('should apply request interceptors', async () => {
      const interceptor = vi.fn((config) => ({
        ...config,
        headers: {
          ...config.headers,
          'X-Custom-Header': 'test-value'
        }
      }));

      apiClient.addRequestInterceptor(interceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: []
        })
      });

      await apiClient.projects.list();

      expect(interceptor).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value'
          })
        })
      );
    });
  });

  describe('Response Interceptors', () => {
    it('should apply response interceptors', async () => {
      const interceptor = vi.fn((response) => ({
        ...response,
        data: {
          ...response.data,
          intercepted: true
        }
      }));

      apiClient.addResponseInterceptor(interceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: '1', name: 'Test' }
        })
      });

      const result = await apiClient.projects.get('1');

      expect(interceptor).toHaveBeenCalled();
      expect(result).toEqual({
        id: '1',
        name: 'Test',
        intercepted: true
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const mockResponses = [
        { success: true, data: { id: '1', name: 'Project 1' } },
        { success: true, data: { id: '2', name: 'Project 2' } },
        { success: true, data: { id: '3', name: 'Project 3' } }
      ];

      mockResponses.forEach(response => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => response
        });
      });

      const promises = [
        apiClient.projects.get('1'),
        apiClient.projects.get('2'),
        apiClient.projects.get('3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockResponses[0].data);
      expect(results[1]).toEqual(mockResponses[1].data);
      expect(results[2]).toEqual(mockResponses[2].data);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate identical concurrent requests', async () => {
      const apiClientWithDedup = new ApiClient({
        baseURL: 'http://localhost:3001/api',
        deduplicateRequests: true
      });

      const mockResponse = {
        success: true,
        data: { id: '1', name: 'Project 1' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      // Make 3 identical concurrent requests
      const promises = [
        apiClientWithDedup.projects.get('1'),
        apiClientWithDedup.projects.get('1'),
        apiClientWithDedup.projects.get('1')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.id === '1')).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one actual request
    });
  });
});