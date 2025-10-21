# Multi-stage Dockerfile for Prompt Testing Lab
# Optimized for production deployment with minimal attack surface

# Stage 1: Base dependencies
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm for better dependency management
RUN npm install -g pnpm@8

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/*/

# Stage 2: Dependencies installation
FROM base AS deps
# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# Stage 3: Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build all packages
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --production

# Stage 4: Production dependencies only
FROM base AS prod-deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/*/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --production=true

# Stage 5: Runtime stage
FROM node:18-alpine AS runtime

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install necessary runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/dist ./packages/web/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/dist ./packages/shared/dist

# Copy production dependencies
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /app/packages/*/node_modules ./packages/*/node_modules

# Copy necessary configuration files
COPY --chown=nextjs:nodejs package.json ./
COPY --chown=nextjs:nodejs database/ ./database/

# Set up database directory with proper permissions
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Create health check script
COPY --chown=nextjs:nodejs <<EOF /app/healthcheck.js
const http = require('http');
const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.log('Health check status:', res.statusCode);
  process.exit(res.statusCode === 200 ? 0 : 1);
});

request.on('error', (err) => {
  console.log('Health check failed:', err.message);
  process.exit(1);
});

request.end();
EOF

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node /app/healthcheck.js

# Switch to non-root user
USER nextjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/api/dist/index.js"]

# Stage 6: Development stage (for local development)
FROM base AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/*/

# Install all dependencies (including dev dependencies)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create development user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port for development
EXPOSE 3000
EXPOSE 3001

# Start in development mode
CMD ["pnpm", "run", "dev"]