/**
 * Test Fixtures and Factories
 * 
 * Provides consistent test data generation for all test suites.
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { TEST_CONFIG, getTestCredentials } from '../../../tests/config/test-config';

// Base factory interface
interface BaseFactory<T> {
  create(overrides?: Partial<T>): T;
  createMany(count: number, overrides?: Partial<T>): T[];
}

// User fixtures
export interface UserFixture {
  id: string;
  email: string;
  password: string;
  hashedPassword: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export const userFactory: BaseFactory<UserFixture> = {
  create(overrides = {}) {
    const password = TEST_CONFIG.credentials.user.password;
    const email = overrides.email || `user-${uuidv4()}@test.com`;
    return {
      id: uuidv4(),
      email,
      password,
      hashedPassword: bcrypt.hashSync(password, 10),
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
};

// Project fixtures
export interface ProjectFixture {
  id: string;
  name: string;
  description: string;
  userId: string;
  settings: object;
  createdAt: Date;
  updatedAt: Date;
}

export const projectFactory: BaseFactory<ProjectFixture> = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      name: `Test Project ${uuidv4().slice(0, 8)}`,
      description: 'A test project for automated testing',
      userId: uuidv4(),
      settings: {
        maxConcurrentTests: 5,
        timeoutMs: 30000,
        retryCount: 3
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
};

// Prompt fixtures
export interface PromptFixture {
  id: string;
  name: string;
  content: string;
  variables: object;
  projectId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const promptFactory: BaseFactory<PromptFixture> = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      name: `Test Prompt ${uuidv4().slice(0, 8)}`,
      content: 'You are a helpful assistant. {{input}}',
      variables: {
        input: {
          type: 'string',
          description: 'User input',
          required: true
        }
      },
      projectId: uuidv4(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
};

// Test Run fixtures
export interface TestRunFixture {
  id: string;
  name: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  configuration: object;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const testRunFactory: BaseFactory<TestRunFixture> = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      name: `Test Run ${uuidv4().slice(0, 8)}`,
      projectId: uuidv4(),
      status: 'pending',
      configuration: {
        prompts: [],
        providers: ['openai', 'anthropic'],
        testCases: [],
        evaluators: ['similarity', 'accuracy']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
};

// Test Result fixtures
export interface TestResultFixture {
  id: string;
  testRunId: string;
  promptId: string;
  provider: string;
  input: object;
  output: string;
  evaluationResults: object;
  metrics: object;
  executionTime: number;
  createdAt: Date;
}

export const testResultFactory: BaseFactory<TestResultFixture> = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      testRunId: uuidv4(),
      promptId: uuidv4(),
      provider: 'openai',
      input: {
        prompt: 'Test prompt',
        variables: { input: 'test input' }
      },
      output: 'Test response from LLM',
      evaluationResults: {
        similarity: { score: 0.85, passed: true },
        accuracy: { score: 0.92, passed: true }
      },
      metrics: {
        tokenCount: 150,
        cost: 0.003,
        latency: 1200
      },
      executionTime: 1500,
      createdAt: new Date(),
      ...overrides
    };
  },
  
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
};

// LLM Response fixtures for mocking
export interface LLMResponseFixture {
  content: string;
  tokenCount: number;
  finishReason: 'stop' | 'length' | 'error';
  model: string;
}

export const llmResponseFactory: BaseFactory<LLMResponseFixture> = {
  create(overrides = {}) {
    return {
      content: 'This is a mocked LLM response for testing purposes.',
      tokenCount: 12,
      finishReason: 'stop',
      model: 'gpt-3.5-turbo',
      ...overrides
    };
  },
  
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
};

// Helper function to create related data
export function createUserWithProject(userOverrides = {}, projectOverrides = {}) {
  const user = userFactory.create(userOverrides);
  const project = projectFactory.create({ userId: user.id, ...projectOverrides });
  return { user, project };
}

export function createProjectWithPrompts(
  projectOverrides = {}, 
  promptCount = 3, 
  promptOverrides = {}
) {
  const project = projectFactory.create(projectOverrides);
  const prompts = promptFactory.createMany(promptCount, { 
    projectId: project.id, 
    ...promptOverrides 
  });
  return { project, prompts };
}

export function createCompleteTestScenario() {
  const user = userFactory.create();
  const project = projectFactory.create({ userId: user.id });
  const prompts = promptFactory.createMany(2, { projectId: project.id });
  const testRun = testRunFactory.create({ projectId: project.id });
  const testResults = prompts.flatMap(prompt => 
    testResultFactory.createMany(2, { 
      testRunId: testRun.id, 
      promptId: prompt.id 
    })
  );
  
  return { user, project, prompts, testRun, testResults };
}