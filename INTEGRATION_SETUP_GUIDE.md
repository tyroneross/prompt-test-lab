# Prompt Testing Lab Integration Setup Guide

This guide shows you how to connect your Prompt Testing Lab to your specific application for bidirectional prompt testing and deployment.

## 🚀 Quick Start Integration

### 1. **Connect Your Application**

#### Option A: LangSmith Integration (Recommended)
```bash
# Set up LangSmith connection
curl -X POST http://localhost:3001/api/integration/apps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "My Production App",
    "type": "langsmith",
    "config": {
      "apiUrl": "https://api.smith.langchain.com",
      "apiKey": "YOUR_LANGSMITH_API_KEY",
      "projectId": "YOUR_PROJECT_ID"
    },
    "syncSettings": {
      "direction": "bidirectional",
      "autoSync": true,
      "conflictResolution": "manual"
    }
  }'
```

#### Option B: Direct API Integration
```bash
# Connect via your app's API
curl -X POST http://localhost:3001/api/integration/apps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "My Production App",
    "type": "api",
    "config": {
      "apiUrl": "https://api.your-app.com",
      "apiKey": "YOUR_API_KEY",
      "endpoints": {
        "prompts": "/api/prompts",
        "deploy": "/api/prompts/deploy"
      }
    }
  }'
```

### 2. **Pull Existing Prompts for Testing**
```bash
# Fetch prompts from your app
curl -X POST http://localhost:3001/api/integration/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "appIntegrationId": "YOUR_APP_INTEGRATION_ID",
    "direction": "pull",
    "filters": {
      "tags": ["production", "active"],
      "updatedAfter": "2024-01-01T00:00:00Z"
    }
  }'
```

### 3. **Set Up Testing Pipeline**
```bash
# Create testing pipeline for your prompts
curl -X POST http://localhost:3001/api/integration/pipelines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Production Prompt Testing",
    "description": "Test prompts before deploying to production",
    "config": {
      "providers": ["openai", "anthropic"],
      "evaluationCriteria": {
        "accuracy": { "threshold": 0.85 },
        "latency": { "maxMs": 2000 },
        "cost": { "maxCostPer1k": 0.01 }
      }
    },
    "stages": [
      {
        "name": "validation",
        "type": "validation",
        "config": { "checks": ["syntax", "variables", "length"] }
      },
      {
        "name": "performance",
        "type": "performance", 
        "config": { "testCases": 10, "concurrent": 3 }
      },
      {
        "name": "quality",
        "type": "quality",
        "config": { "evaluators": ["accuracy", "relevance"] }
      }
    ]
  }'
```

### 4. **Deploy Tested Prompts Back**
```bash
# Deploy successful prompts to production
curl -X POST http://localhost:3001/api/integration/deploy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "appIntegrationId": "YOUR_APP_INTEGRATION_ID",
    "promptId": "YOUR_TESTED_PROMPT_ID",
    "strategy": "canary",
    "config": {
      "canaryPercent": 10,
      "autoPromote": true,
      "rollbackThreshold": 0.05
    },
    "approvals": {
      "required": true,
      "approvers": ["user@company.com"]
    }
  }'
```

## 🔧 Environment Configuration

Add these environment variables to your `.env` file:

```bash
# Integration Settings
INTEGRATION_ENABLED=true
DEFAULT_SYNC_INTERVAL=3600000  # 1 hour in ms
MAX_CONCURRENT_SYNCS=3
WEBHOOK_SECRET=your-webhook-secret-here

# LangSmith Integration (if using)
LANGSMITH_API_URL=https://api.smith.langchain.com
LANGSMITH_DEFAULT_PROJECT=your-default-project

# LLM Provider Settings
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GROQ_API_KEY=gsk_your-groq-key

# Deployment Settings
ENABLE_AUTO_DEPLOYMENT=true
REQUIRE_APPROVAL_FOR_PROD=true
MAX_CANARY_DURATION=86400000  # 24 hours in ms

# Monitoring
PROMETHEUS_ENABLED=true
WEBHOOK_DELIVERY_TIMEOUT=30000
```

## 📊 Workflow Examples

### Complete Prompt Testing Workflow

1. **Pull Production Prompts**
   ```javascript
   // Your app pushes prompts to the lab
   const response = await fetch('/api/integration/sync', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({
       appIntegrationId: 'your-app-id',
       direction: 'pull'
     })
   });
   ```

2. **Test Prompt Variations**
   ```javascript
   // Run A/B tests on prompt variations
   const testRun = await fetch('/api/integration/pipelines/execute', {
     method: 'POST',
     body: JSON.stringify({
       pipelineId: 'your-pipeline-id',
       promptIds: ['prompt-1', 'prompt-2-variation'],
       config: {
         testCases: 100,
         providers: ['openai', 'anthropic']
       }
     })
   });
   ```

3. **Deploy Winners**
   ```javascript
   // Deploy the best performing prompt
   const deployment = await fetch('/api/integration/deploy', {
     method: 'POST',
     body: JSON.stringify({
       promptId: 'winning-prompt-id',
       strategy: 'canary',
       config: { canaryPercent: 5 }
     })
   });
   ```

### Automatic Prompt Optimization

```javascript
// Set up automatic optimization
const optimization = await fetch('/api/integration/optimize', {
  method: 'POST',
  body: JSON.stringify({
    promptId: 'your-prompt-id',
    config: {
      variations: 5,
      optimizationGoals: ['accuracy', 'cost', 'latency'],
      autoApprove: false
    }
  })
});
```

## 🔗 Integration Patterns

### 1. **LangSmith Integration Pattern**
```typescript
// Your production app code
import { LangSmithPromptClient } from '@langchain/langsmith';

const client = new LangSmithPromptClient({
  apiUrl: process.env.LANGSMITH_API_URL,
  apiKey: process.env.LANGSMITH_API_KEY
});

// Prompts are automatically synced with the lab
const prompt = await client.getPrompt('user-onboarding-prompt');

// Use in production
const result = await llm.invoke(prompt.format({ userName: 'John' }));

// Lab automatically pulls this prompt for testing
```

### 2. **Webhook Integration Pattern**
```typescript
// In your production app
app.post('/webhooks/prompt-lab', (req, res) => {
  const { event, data } = req.body;
  
  switch (event) {
    case 'prompt.tested':
      // New prompt version is ready for review
      console.log(`Prompt ${data.promptId} tested successfully`);
      break;
      
    case 'deployment.completed':
      // Prompt deployed to production
      console.log(`Prompt ${data.promptId} deployed successfully`);
      break;
      
    case 'deployment.failed':
      // Rollback occurred
      console.log(`Deployment failed, rolled back: ${data.reason}`);
      break;
  }
  
  res.status(200).send('OK');
});
```

### 3. **Direct API Integration Pattern**
```typescript
// Your app exposes these endpoints for the lab
app.get('/api/prompts', authenticatePromptLab, (req, res) => {
  // Return all prompts for testing
  res.json(await getActivePrompts());
});

app.post('/api/prompts/:id/deploy', authenticatePromptLab, (req, res) => {
  // Deploy tested prompt
  const { promptId } = req.params;
  const { strategy, config } = req.body;
  
  await deployPrompt(promptId, strategy, config);
  res.json({ success: true });
});
```

## 🚨 Dependency Management

### LangSmith Dependencies
The lab automatically monitors your LangSmith setup:

```bash
# Check LangSmith integration health
curl http://localhost:3001/api/integration/dependencies/langsmith/health

# Get upgrade recommendations
curl http://localhost:3001/api/integration/dependencies/langsmith/updates
```

### Automatic Dependency Updates
```javascript
// Set up automatic dependency monitoring
const depManager = await fetch('/api/integration/dependencies', {
  method: 'POST',
  body: JSON.stringify({
    name: 'langsmith',
    type: 'langsmith',
    config: {
      projectId: 'your-project',
      monitorHealth: true,
      autoUpdate: false,  // Manual approval required
      alertOnIssues: true
    }
  })
});
```

## 📈 Monitoring & Alerts

### Set Up Monitoring
```bash
# Create webhook for deployment notifications
curl -X POST http://localhost:3001/api/integration/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/prompt-lab",
    "events": ["deployment.completed", "deployment.failed", "sync.completed"],
    "secret": "your-webhook-secret"
  }'
```

### Health Checks
```bash
# Monitor integration health
curl http://localhost:3001/api/integration/apps/YOUR_APP_ID/health

# Get sync status
curl http://localhost:3001/api/integration/sync/status
```

## 🛡️ Security Best Practices

1. **API Key Management**
   - Store API keys securely in environment variables
   - Use different keys for lab vs production
   - Rotate keys regularly

2. **Webhook Security**
   - Always verify webhook signatures
   - Use HTTPS endpoints only
   - Implement retry logic with exponential backoff

3. **Access Control**
   - Require approval for production deployments
   - Use role-based access for different environments
   - Log all integration activities

## 🔄 Migration from Existing Setup

### If you're using LangSmith directly:
1. Connect your existing LangSmith project to the lab
2. Import your current prompts for testing
3. Set up approval workflows for deployments
4. Gradually migrate to lab-based deployments

### If you have custom prompt management:
1. Implement the Direct API integration pattern
2. Create endpoints for prompt retrieval and deployment
3. Set up webhooks for real-time updates
4. Test the integration with non-critical prompts first

## 📞 Support & Troubleshooting

### Common Issues:

**Connection Failed**: Check API keys and network connectivity
```bash
curl -v http://localhost:3001/api/integration/apps/YOUR_APP_ID/test-connection
```

**Sync Conflicts**: Review conflict resolution settings
```bash
curl http://localhost:3001/api/integration/sync/conflicts
```

**Deployment Failures**: Check deployment logs and rollback status
```bash
curl http://localhost:3001/api/integration/deployments/YOUR_DEPLOYMENT_ID/logs
```

This integration setup enables a complete prompt engineering workflow: develop → test → optimize → deploy → monitor. Your Prompt Testing Lab now acts as a bridge between development and production, ensuring only well-tested prompts make it to your users.