/**
 * Prompt Testing Lab API Server
 * Main entry point for the Express.js backend
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth';

// Service imports
import { QueueService } from './services/queue.service';
import { websocketService } from './services/websocket.service';

// Route imports
import authRoutes from './routes/auth';
import magicLinkRoutes from './routes/magic-link';
import passwordRoutes from './routes/password';
import projectRoutes from './routes/projects';
import promptRoutes from './routes/prompts';
import testRunRoutes from './routes/test-runs';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';

const app: Application = express();
const PORT = process.env.PORT || 4001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check (no auth required)
app.use('/health', healthRoutes);

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/auth/magic-link', magicLinkRoutes);
app.use('/api/auth', passwordRoutes);

// Protected routes (require authentication)
app.use('/api/projects', projectRoutes);
app.use('/api', promptRoutes);
app.use('/api', testRunRoutes);
app.use('/api', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Prompt Testing Lab API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/docs',
    health: '/health'
  });
});

// Error handling (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /',
      'GET /health',
      'POST /api/auth/login',
      'GET /api/projects',
      'POST /api/prompts/:id/test'
    ]
  });
});

// Create HTTP server for WebSocket support
const server = createServer(app);

// Initialize services
QueueService.initialize();
websocketService.initialize(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Prompt Testing Lab API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`🔌 WebSocket server running on /ws`);
  console.log(`⚡ Queue service initialized`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  QueueService.stop();
  websocketService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  QueueService.stop();
  websocketService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;