/**
 * Prompt Testing Lab SDK
 * Lightweight client for interacting with the Prompt Testing Lab API
 */

export interface PromptLabConfig {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface PromptTest {
  id: string;
  name: string;
  prompt: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptTestRequest {
  name: string;
  prompt: string;
  provider: string;
  projectId: string;
  testData?: any;
}

export class PromptLabClient {
  private config: PromptLabConfig;

  constructor(config: PromptLabConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async createTest(request: CreatePromptTestRequest): Promise<PromptTest> {
    return this.request('POST', '/api/tests', request);
  }

  async getTest(testId: string): Promise<PromptTest> {
    return this.request('GET', `/api/tests/${testId}`);
  }

  async runTest(testId: string): Promise<PromptTest> {
    return this.request('POST', `/api/tests/${testId}/run`);
  }

  async listTests(projectId: string): Promise<PromptTest[]> {
    return this.request('GET', `/api/projects/${projectId}/tests`);
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default PromptLabClient;