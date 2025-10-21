# Prompt Testing Lab API

The backend API server for the Prompt Testing Lab MVP, built with Node.js, Express, TypeScript, and Prisma.

## Features

### Core Functionality
- **Project Management**: Create and manage prompt testing projects with team collaboration
- **Prompt Management**: CRUD operations with versioning and tagging support
- **Test Execution**: A/B/C testing across multiple LLM providers with queue-based processing
- **Real-time Updates**: WebSocket support for live test progress tracking
- **Analytics**: Comprehensive metrics, cost tracking, and performance analysis

### LLM Integration
- **Multiple Providers**: OpenAI, Groq, Anthropic, and local model support
- **LangChain Integration**: Unified interface for different LLM providers
- **Cost Tracking**: Automatic token usage and cost calculation
- **Error Handling**: Robust error handling and retry mechanisms

### Plugin System
- **Extensible Evaluators**: Built-in and custom evaluation criteria
- **Diff Algorithms**: Multiple comparison algorithms for response analysis
- **Custom Plugins**: Framework for adding custom evaluation logic

### Security & Performance
- **JWT Authentication**: Secure user authentication and authorization
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Data Validation**: Input validation using Zod schemas
- **Queue Management**: Background job processing for test execution

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL or SQLite
- Redis (optional, for advanced queue features)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize the database:
```bash
npm run db:init
npm run db:seed
```

4. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:4000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/refresh` - Refresh authentication token

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/members` - Add project member

### Prompts
- `GET /api/projects/:projectId/prompts` - List project prompts
- `POST /api/projects/:projectId/prompts` - Create new prompt
- `GET /api/prompts/:id` - Get prompt details
- `PUT /api/prompts/:id` - Update prompt
- `POST /api/prompts/:id/versions` - Create prompt version
- `GET /api/prompts/:id/versions` - Get version history

### Test Runs
- `POST /api/projects/:projectId/test-runs` - Create and start test run
- `GET /api/test-runs/:id` - Get test run results
- `GET /api/test-runs/:id/progress` - Get real-time progress
- `POST /api/test-runs/:id/cancel` - Cancel test run
- `GET /api/test-runs/:id/comparison` - Get model comparison data

### Analytics
- `GET /api/projects/:projectId/analytics` - Get project analytics
- `GET /api/users/:userId/analytics` - Get user analytics
- `GET /api/projects/:projectId/analytics/export` - Export analytics data

## Database Schema

The application uses Prisma ORM with the following main entities:

- **User**: User accounts and authentication
- **Project**: Testing projects with team collaboration
- **ProjectMember**: Project membership with role-based access
- **Prompt**: Prompt templates with versioning support
- **TestRun**: Test execution configurations and status
- **TestResponse**: Individual LLM responses with metrics
- **TestMetric**: Aggregated test metrics and analytics
- **EvaluationPlugin**: Plugin system for custom evaluations
- **QueueJob**: Background job queue management

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/prompt_testing_lab"

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# LLM API Keys
OPENAI_API_KEY=sk-your-openai-key
GROQ_API_KEY=gsk-your-groq-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Optional: Redis for queue management
REDIS_URL=redis://localhost:6379
```

### Model Configuration

The system supports multiple LLM providers with automatic cost calculation:

```typescript
// Supported models with pricing
{
  'openai/gpt-4': { inputCost: 0.03, outputCost: 0.06 },
  'openai/gpt-4-turbo': { inputCost: 0.01, outputCost: 0.03 },
  'groq/llama2-70b-4096': { inputCost: 0.0008, outputCost: 0.0008 },
  'anthropic/claude-3-opus': { inputCost: 0.015, outputCost: 0.075 },
}
```

## Development

### Database Operations

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed

# Reset database (development only)
npm run db:reset
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check
```

### Building

```bash
# Build for production
npm run build

# Start production server
npm start
```

## WebSocket API

The API includes WebSocket support for real-time updates:

### Connection
```javascript
const ws = new WebSocket('ws://localhost:4000/ws');

// Authenticate
ws.send(JSON.stringify({
  type: 'authenticate',
  data: { token: 'your-jwt-token' }
}));

// Subscribe to test run updates
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { channels: ['test_run:123', 'project:456'] }
}));
```

### Events
- `test_progress` - Real-time test execution progress
- `test_status` - Test run status changes
- `project_update` - Project-level updates
- `notification` - User notifications

## Plugin System

### Built-in Evaluators
- **Similarity**: Text similarity using various algorithms
- **Sentiment**: Sentiment analysis of responses
- **Toxicity**: Toxic content detection
- **Relevance**: Response relevance to prompt

### Built-in Diff Algorithms
- **Levenshtein**: Character-level edit distance
- **Semantic**: Meaning-based comparison
- **Word Diff**: Word-level comparison

### Custom Plugins

Create custom evaluators by implementing the `EvaluatorPlugin` interface:

```typescript
class CustomEvaluator implements EvaluatorPlugin {
  id = 'custom-evaluator';
  name = 'Custom Evaluator';
  type = 'evaluator' as const;
  
  async evaluate(context: PluginContext): Promise<PluginResult> {
    // Your evaluation logic here
    return {
      success: true,
      data: {
        score: 0.85,
        maxScore: 1,
        passed: true,
        details: { /* evaluation details */ }
      }
    };
  }
}
```

## Deployment

### Production Setup

1. Set up PostgreSQL database
2. Configure environment variables
3. Build the application:
```bash
npm run build
```
4. Run migrations:
```bash
npm run db:migrate
```
5. Start the server:
```bash
npm start
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY prisma ./prisma
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "start"]
```

## Architecture

### Queue System
- Background job processing for test execution
- Automatic retry logic for failed jobs
- Progress tracking and real-time updates

### Security
- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting and abuse prevention

### Monitoring
- Comprehensive logging
- Performance metrics
- Error tracking
- Queue monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details