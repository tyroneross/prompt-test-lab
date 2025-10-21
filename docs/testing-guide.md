# Prompt Testing Lab - Accuracy & Constraints Testing Guide

## Overview

This guide covers comprehensive testing strategies for validating the accuracy, performance, and constraints of the Prompt Testing Lab SDK and API. It includes unit tests, integration tests, load testing, and accuracy validation methods.

## Table of Contents

1. [Accuracy Testing](#accuracy-testing)
2. [Constraint Testing](#constraint-testing)
3. [Integration Testing](#integration-testing)
4. [Performance & Load Testing](#performance--load-testing)
5. [Cost Validation](#cost-validation)
6. [Security Testing](#security-testing)

---

## 🎯 Accuracy Testing

### 1. Prompt Output Consistency Testing

Test that the same prompt produces consistent results across multiple runs:

```javascript
// test/accuracy/consistency.test.js
const { PromptLabSDK } = require('@prompt-lab/sdk');

describe('Prompt Output Consistency', () => {
  const sdk = new PromptLabSDK({
    apiUrl: process.env.API_URL,
    apiKey: process.env.API_KEY
  });

  test('should produce consistent outputs for deterministic prompts', async () => {
    const prompt = 'Complete this math: 2 + 2 = ';
    const modelConfig = {
      provider: 'openai',
      modelName: 'gpt-3.5-turbo',
      temperature: 0, // Deterministic
      maxTokens: 10
    };

    // Run the same prompt 5 times
    const results = [];
    for (let i = 0; i < 5; i++) {
      const result = await sdk.testSinglePrompt({
        prompt,
        modelConfig,
        input: ''
      });
      results.push(result.output);
    }

    // All results should be identical for deterministic settings
    const uniqueResults = [...new Set(results)];
    expect(uniqueResults.length).toBe(1);
    expect(results[0]).toContain('4');
  });

  test('should show variation with high temperature', async () => {
    const prompt = 'Write a creative story about: ';
    const modelConfig = {
      provider: 'openai',
      modelName: 'gpt-3.5-turbo',
      temperature: 1.0, // High variation
      maxTokens: 50
    };

    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await sdk.testSinglePrompt({
        prompt,
        modelConfig,
        input: 'a magic door'
      });
      results.push(result.output);
    }

    // Results should be different with high temperature
    const uniqueResults = [...new Set(results)];
    expect(uniqueResults.length).toBeGreaterThan(1);
  });
});
```

### 2. Model Comparison Accuracy

Test accuracy across different models:

```javascript
// test/accuracy/model-comparison.test.js
describe('Model Comparison Accuracy', () => {
  const testCases = [
    {
      name: 'Factual Question',
      prompt: 'What is the capital of France? Answer in one word:',
      expectedOutput: 'Paris',
      scoreThreshold: 0.9
    },
    {
      name: 'Math Problem',
      prompt: 'Calculate: 15 * 4 = ',
      expectedOutput: '60',
      scoreThreshold: 1.0
    },
    {
      name: 'Code Generation',
      prompt: 'Write a Python function to add two numbers. Function only, no explanation:',
      expectedPattern: /def\s+\w+\s*\([^)]*\):/,
      scoreThreshold: 0.8
    }
  ];

  const models = [
    'openai/gpt-4',
    'openai/gpt-3.5-turbo',
    'groq/llama2-70b-4096',
    'anthropic/claude-3-opus'
  ];

  test.each(testCases)('$name - accuracy across models', async ({ prompt, expectedOutput, expectedPattern, scoreThreshold }) => {
    const results = await sdk.compareModels({
      prompt,
      models,
      evaluationCriteria: ['accuracy', 'relevance']
    });

    results.forEach(result => {
      if (expectedOutput) {
        const accuracy = calculateStringAccuracy(result.output, expectedOutput);
        expect(accuracy).toBeGreaterThanOrEqual(scoreThreshold);
      }
      if (expectedPattern) {
        expect(result.output).toMatch(expectedPattern);
      }
    });
  });
});

// Helper function to calculate string similarity
function calculateStringAccuracy(actual, expected) {
  if (actual === expected) return 1.0;
  
  // Simple Levenshtein distance-based accuracy
  const distance = levenshteinDistance(actual.toLowerCase(), expected.toLowerCase());
  const maxLength = Math.max(actual.length, expected.length);
  return 1 - (distance / maxLength);
}
```

### 3. Evaluation Plugin Testing

Test custom evaluation criteria:

```javascript
// test/accuracy/evaluation-plugins.test.js
describe('Evaluation Plugin Accuracy', () => {
  test('sentiment analysis accuracy', async () => {
    const testPrompts = [
      { text: 'I love this product! It\'s amazing!', expectedSentiment: 'positive' },
      { text: 'This is terrible and I hate it.', expectedSentiment: 'negative' },
      { text: 'The product is okay, nothing special.', expectedSentiment: 'neutral' }
    ];

    for (const { text, expectedSentiment } of testPrompts) {
      const result = await sdk.evaluatePrompt({
        prompt: 'Analyze sentiment: ' + text,
        evaluationPlugins: ['sentiment'],
        modelConfig: { temperature: 0 }
      });

      expect(result.evaluations.sentiment.label).toBe(expectedSentiment);
      expect(result.evaluations.sentiment.confidence).toBeGreaterThan(0.7);
    }
  });

  test('toxicity detection accuracy', async () => {
    const testCases = [
      { text: 'You are wonderful!', toxic: false },
      { text: '[inappropriate content]', toxic: true },
      { text: 'I disagree with your opinion.', toxic: false }
    ];

    for (const { text, toxic } of testCases) {
      const result = await sdk.evaluatePrompt({
        prompt: text,
        evaluationPlugins: ['toxicity'],
      });

      expect(result.evaluations.toxicity.isToxic).toBe(toxic);
    }
  });
});
```

---

## 🔒 Constraint Testing

### 1. Rate Limiting Tests

```javascript
// test/constraints/rate-limiting.test.js
describe('API Rate Limiting', () => {
  test('should respect rate limits', async () => {
    const requests = [];
    const rateLimit = 100; // As per .env.example
    
    // Send requests up to the limit
    for (let i = 0; i < rateLimit + 10; i++) {
      requests.push(
        sdk.testSinglePrompt({
          prompt: 'Test prompt',
          modelConfig: { provider: 'openai', modelName: 'gpt-3.5-turbo' }
        }).catch(err => err)
      );
    }

    const results = await Promise.all(requests);
    
    // Count successful vs rate-limited requests
    const successful = results.filter(r => r.success).length;
    const rateLimited = results.filter(r => r.error?.code === 'RATE_LIMIT_EXCEEDED').length;
    
    expect(successful).toBeLessThanOrEqual(rateLimit);
    expect(rateLimited).toBeGreaterThan(0);
  });

  test('should reset rate limit after window', async () => {
    // Wait for rate limit window to reset (default: 15 minutes)
    // In tests, you might mock this or use a shorter window
    
    const result = await sdk.testSinglePrompt({
      prompt: 'Test after reset',
      modelConfig: { provider: 'openai', modelName: 'gpt-3.5-turbo' }
    });
    
    expect(result.success).toBe(true);
  });
});
```

### 2. Token Limit Testing

```javascript
// test/constraints/token-limits.test.js
describe('Token Limit Constraints', () => {
  const models = [
    { name: 'gpt-3.5-turbo', maxTokens: 4096 },
    { name: 'gpt-4', maxTokens: 8192 },
    { name: 'llama2-70b-4096', maxTokens: 4096 }
  ];

  test.each(models)('$name respects token limits', async ({ name, maxTokens }) => {
    const longPrompt = 'Tell me about '.repeat(1000); // Very long prompt
    
    const result = await sdk.testSinglePrompt({
      prompt: longPrompt,
      modelConfig: {
        modelName: name,
        maxTokens: maxTokens
      }
    });

    if (result.error) {
      expect(result.error.code).toBe('TOKEN_LIMIT_EXCEEDED');
    } else {
      expect(result.tokenUsage.totalTokens).toBeLessThanOrEqual(maxTokens);
    }
  });

  test('should handle max_tokens parameter correctly', async () => {
    const requestedTokens = 100;
    
    const result = await sdk.testSinglePrompt({
      prompt: 'Write a long story about space exploration',
      modelConfig: {
        modelName: 'gpt-3.5-turbo',
        maxTokens: requestedTokens
      }
    });

    expect(result.tokenUsage.completionTokens).toBeLessThanOrEqual(requestedTokens);
  });
});
```

### 3. Input Validation Testing

```javascript
// test/constraints/input-validation.test.js
describe('Input Validation Constraints', () => {
  test('should reject invalid prompt templates', async () => {
    const invalidPrompts = [
      { prompt: '', error: 'EMPTY_PROMPT' },
      { prompt: null, error: 'INVALID_PROMPT' },
      { prompt: 'a'.repeat(50000), error: 'PROMPT_TOO_LONG' },
      { prompt: '{invalid{{brackets}', error: 'INVALID_TEMPLATE' }
    ];

    for (const { prompt, error } of invalidPrompts) {
      await expect(
        sdk.createPrompt({ prompt, projectId: 'test-project' })
      ).rejects.toThrow(error);
    }
  });

  test('should validate model configurations', async () => {
    const invalidConfigs = [
      { temperature: -1, error: 'Temperature must be between 0 and 2' },
      { temperature: 3, error: 'Temperature must be between 0 and 2' },
      { maxTokens: -100, error: 'maxTokens must be positive' },
      { topP: 2, error: 'topP must be between 0 and 1' }
    ];

    for (const config of invalidConfigs) {
      await expect(
        sdk.testSinglePrompt({
          prompt: 'Test',
          modelConfig: { ...config, provider: 'openai', modelName: 'gpt-4' }
        })
      ).rejects.toThrow();
    }
  });
});
```

---

## 🔄 Integration Testing

### 1. End-to-End Test Flow

```javascript
// test/integration/e2e-flow.test.js
describe('End-to-End A/B Testing Flow', () => {
  let projectId;
  let promptIds = [];

  beforeAll(async () => {
    // 1. Create a test project
    const project = await sdk.createProject({
      name: 'E2E Test Project',
      description: 'Integration testing'
    });
    projectId = project.id;
  });

  test('complete A/B testing workflow', async () => {
    // 2. Create prompt variants
    const promptA = await sdk.createPrompt({
      projectId,
      name: 'Formal Tone',
      template: 'Respond formally to: {input}',
      modelConfig: { temperature: 0.3 }
    });
    
    const promptB = await sdk.createPrompt({
      projectId,
      name: 'Casual Tone',
      template: 'Respond casually to: {input}',
      modelConfig: { temperature: 0.7 }
    });

    promptIds = [promptA.id, promptB.id];

    // 3. Run A/B test
    const testRun = await sdk.createTestRun({
      projectId,
      name: 'Tone Comparison Test',
      promptIds,
      testInputs: [
        'How do I reset my password?',
        'I need help with billing',
        'Technical support needed'
      ],
      evaluationCriteria: ['sentiment', 'relevance', 'clarity']
    });

    expect(testRun.status).toBe('QUEUED');

    // 4. Wait for completion
    let status;
    let attempts = 0;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await sdk.getTestRunStatus(testRun.id);
      attempts++;
    } while (status.status !== 'COMPLETED' && attempts < 30);

    expect(status.status).toBe('COMPLETED');

    // 5. Get results
    const results = await sdk.getTestResults(testRun.id);
    
    expect(results.comparison).toBeDefined();
    expect(results.comparison.models).toHaveLength(2);
    expect(results.winner).toBeDefined();
    
    // 6. Verify metrics
    results.comparison.models.forEach(model => {
      expect(model.metrics.successRate).toBeGreaterThan(0.8);
      expect(model.metrics.avgLatency).toBeLessThan(5000);
      expect(model.metrics.totalCost).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    // Cleanup
    if (projectId) {
      await sdk.deleteProject(projectId);
    }
  });
});
```

### 2. WebSocket Integration Test

```javascript
// test/integration/websocket.test.js
describe('WebSocket Real-time Updates', () => {
  let ws;
  let testRunId;

  beforeAll(async () => {
    // Connect to WebSocket
    ws = new WebSocket(process.env.WS_URL);
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });

    // Authenticate
    ws.send(JSON.stringify({
      type: 'authenticate',
      data: { token: process.env.API_KEY }
    }));
  });

  test('should receive real-time test progress', async () => {
    const progressUpdates = [];
    
    // Set up listener
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'test_progress') {
        progressUpdates.push(message.data);
      }
    });

    // Start a test run
    const testRun = await sdk.createTestRun({
      projectId: 'test-project',
      promptIds: ['prompt-1', 'prompt-2'],
      testInputs: ['input1', 'input2', 'input3']
    });
    testRunId = testRun.id;

    // Subscribe to updates
    ws.send(JSON.stringify({
      type: 'subscribe',
      data: { channels: [`test_run:${testRunId}`] }
    }));

    // Wait for updates
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verify we received progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
  });

  afterAll(() => {
    ws.close();
  });
});
```

---

## 🚀 Performance & Load Testing

### 1. Load Testing Script

```javascript
// test/performance/load-test.js
const autocannon = require('autocannon');

async function runLoadTest() {
  const instance = autocannon({
    url: process.env.API_URL + '/api/test-runs',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: 'load-test-project',
      promptIds: ['prompt-1'],
      testInputs: ['Test input'],
      options: { async: true }
    }),
    connections: 10, // Concurrent connections
    pipelining: 1,
    duration: 30, // seconds
    requests: [
      { // Warm up
        duration: 5,
        rate: 10
      },
      { // Ramp up
        duration: 10,
        rate: 50
      },
      { // Peak load
        duration: 10,
        rate: 100
      },
      { // Cool down
        duration: 5,
        rate: 10
      }
    ]
  });

  autocannon.track(instance, { renderProgressBar: true });

  instance.on('done', (results) => {
    console.log('Load Test Results:');
    console.log(`Requests/sec: ${results.requests.average}`);
    console.log(`Latency (p99): ${results.latency.p99}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Timeouts: ${results.timeouts}`);
    
    // Assert performance requirements
    expect(results.latency.p99).toBeLessThan(5000); // 5s p99 latency
    expect(results.errors).toBeLessThan(results.requests.total * 0.01); // <1% error rate
  });
}
```

### 2. Stress Testing

```javascript
// test/performance/stress-test.js
describe('API Stress Testing', () => {
  test('should handle concurrent test runs', async () => {
    const concurrentTests = 50;
    const promises = [];

    for (let i = 0; i < concurrentTests; i++) {
      promises.push(
        sdk.createTestRun({
          projectId: 'stress-test',
          promptIds: ['prompt-1'],
          testInputs: [`Stress test input ${i}`],
          options: { async: true }
        }).catch(err => ({ error: err }))
      );
    }

    const results = await Promise.all(promises);
    
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    
    console.log(`Success rate: ${(successful / concurrentTests * 100).toFixed(2)}%`);
    
    // Should handle at least 80% successfully
    expect(successful / concurrentTests).toBeGreaterThan(0.8);
  });

  test('should handle large batch tests', async () => {
    const largeInputSet = Array(1000).fill(0).map((_, i) => `Test input ${i}`);
    
    const startTime = Date.now();
    
    const result = await sdk.createTestRun({
      projectId: 'stress-test',
      promptIds: ['prompt-1'],
      testInputs: largeInputSet,
      options: { 
        async: true,
        concurrency: 10
      }
    });

    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(60000); // Should queue within 1 minute
  });
});
```

---

## 💰 Cost Validation

### 1. Cost Calculation Testing

```javascript
// test/cost/cost-calculation.test.js
describe('Cost Calculation Accuracy', () => {
  const modelPricing = {
    'openai/gpt-4': { input: 0.03, output: 0.06 },
    'openai/gpt-3.5-turbo': { input: 0.01, output: 0.03 },
    'groq/llama2-70b-4096': { input: 0.0008, output: 0.0008 }
  };

  test('should calculate costs accurately', async () => {
    for (const [model, pricing] of Object.entries(modelPricing)) {
      const result = await sdk.testSinglePrompt({
        prompt: 'Calculate the cost of this prompt',
        modelConfig: { 
          modelName: model.split('/')[1],
          provider: model.split('/')[0]
        }
      });

      const expectedInputCost = (result.tokenUsage.promptTokens / 1000) * pricing.input;
      const expectedOutputCost = (result.tokenUsage.completionTokens / 1000) * pricing.output;
      const expectedTotal = expectedInputCost + expectedOutputCost;

      expect(result.cost).toBeCloseTo(expectedTotal, 4);
    }
  });

  test('should track cumulative costs', async () => {
    const projectId = 'cost-test-project';
    
    // Get initial cost
    const initialCost = await sdk.getProjectCosts(projectId);
    
    // Run some tests
    const testRuns = 5;
    let totalExpectedCost = 0;
    
    for (let i = 0; i < testRuns; i++) {
      const result = await sdk.testSinglePrompt({
        projectId,
        prompt: `Test prompt ${i}`,
        modelConfig: { provider: 'openai', modelName: 'gpt-3.5-turbo' }
      });
      totalExpectedCost += result.cost;
    }
    
    // Get updated cost
    const finalCost = await sdk.getProjectCosts(projectId);
    
    const actualCostIncrease = finalCost.totalCost - initialCost.totalCost;
    expect(actualCostIncrease).toBeCloseTo(totalExpectedCost, 2);
  });
});
```

### 2. Cost Limit Enforcement

```javascript
// test/cost/cost-limits.test.js
describe('Cost Limit Enforcement', () => {
  test('should enforce monthly cost limits', async () => {
    // Set a low cost limit for testing
    await sdk.updateUserBilling({
      monthlyLimit: 0.10 // $0.10 limit
    });

    const results = [];
    
    // Keep running tests until we hit the limit
    for (let i = 0; i < 100; i++) {
      try {
        const result = await sdk.testSinglePrompt({
          prompt: 'Test cost limit enforcement',
          modelConfig: { provider: 'openai', modelName: 'gpt-4' } // Expensive model
        });
        results.push(result);
      } catch (error) {
        if (error.code === 'COST_LIMIT_EXCEEDED') {
          break;
        }
        throw error;
      }
    }

    // Calculate total cost
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    
    // Should stop before exceeding limit
    expect(totalCost).toBeLessThanOrEqual(0.10);
    
    // Should reject new requests
    await expect(
      sdk.testSinglePrompt({
        prompt: 'This should fail',
        modelConfig: { provider: 'openai', modelName: 'gpt-4' }
      })
    ).rejects.toThrow('COST_LIMIT_EXCEEDED');
  });
});
```

---

## 🔐 Security Testing

### 1. Authentication Testing

```javascript
// test/security/authentication.test.js
describe('API Authentication', () => {
  test('should reject requests without token', async () => {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'GET'
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('UNAUTHORIZED');
  });

  test('should reject invalid tokens', async () => {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid-token-here'
      }
    });
    
    expect(response.status).toBe(401);
  });

  test('should reject expired tokens', async () => {
    const expiredToken = 'eyJ...'; // Use an actual expired token
    
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${expiredToken}`
      }
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('TOKEN_EXPIRED');
  });
});
```

### 2. Authorization Testing

```javascript
// test/security/authorization.test.js
describe('API Authorization', () => {
  let userAToken, userBToken;
  let projectA, projectB;

  beforeAll(async () => {
    // Create two users with separate projects
    userAToken = await createTestUser('userA@test.com');
    userBToken = await createTestUser('userB@test.com');
    
    projectA = await createProject(userAToken, 'Project A');
    projectB = await createProject(userBToken, 'Project B');
  });

  test('should prevent cross-project access', async () => {
    // User A trying to access User B's project
    const response = await fetch(`${API_URL}/api/projects/${projectB.id}`, {
      headers: {
        'Authorization': `Bearer ${userAToken}`
      }
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('FORBIDDEN');
  });

  test('should enforce role-based permissions', async () => {
    // Add User B as VIEWER to Project A
    await addProjectMember(projectA.id, userBToken, 'VIEWER');
    
    // User B (viewer) trying to modify Project A
    const response = await fetch(`${API_URL}/api/projects/${projectA.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userBToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Modified Name' })
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('INSUFFICIENT_PERMISSIONS');
  });
});
```

---

## 📊 Test Reporting

### Generate Test Report

```javascript
// test/generate-report.js
const fs = require('fs');

async function generateTestReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    },
    accuracyMetrics: {
      modelAccuracy: {},
      evaluationAccuracy: {},
      costAccuracy: {}
    },
    performanceMetrics: {
      avgLatency: 0,
      p99Latency: 0,
      throughput: 0,
      errorRate: 0
    },
    constraints: {
      rateLimiting: 'PASS',
      tokenLimits: 'PASS',
      costLimits: 'PASS',
      inputValidation: 'PASS'
    },
    recommendations: []
  };

  // Run all test suites and collect results
  // ... test execution code ...

  // Generate HTML report
  const html = generateHTMLReport(report);
  fs.writeFileSync('test-report.html', html);
  
  // Generate JSON report
  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  
  console.log('Test report generated: test-report.html');
}
```

---

## 🚦 Continuous Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/api-testing.yml
name: API Testing Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run Unit Tests
      run: npm run test:unit
    
    - name: Run Integration Tests
      run: npm run test:integration
      env:
        API_URL: ${{ secrets.API_URL }}
        API_KEY: ${{ secrets.API_KEY }}
    
    - name: Run Accuracy Tests
      run: npm run test:accuracy
      
    - name: Run Performance Tests
      run: npm run test:performance
      
    - name: Generate Test Report
      run: npm run test:report
      
    - name: Upload Test Results
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: |
          test-report.html
          test-report.json
          coverage/
```

This comprehensive testing guide covers all aspects of validating the Prompt Testing Lab's accuracy, constraints, performance, and security. Regular execution of these tests ensures the system maintains its quality and reliability standards.