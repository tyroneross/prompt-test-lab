/**
 * Test App Helper
 * 
 * Creates a test Express application with proper middleware setup
 * for integration testing.
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler } from '../../src/middleware/error-handler';
import { requestLogger } from '../../src/middleware/request-logger';

// Import routes
import authRoutes from '../../src/routes/auth';
import projectRoutes from '../../src/routes/projects';
import promptRoutes from '../../src/routes/prompts';
import testRunRoutes from '../../src/routes/test-runs';
import analyticsRoutes from '../../src/routes/analytics';
import healthRoutes from '../../src/routes/health';

export async function createTestApp(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging (disabled in test to reduce noise)
  if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/prompts', promptRoutes);
  app.use('/api/test-runs', testRunRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/health', healthRoutes);

  // Error handling
  app.use(errorHandler);

  return app;
}