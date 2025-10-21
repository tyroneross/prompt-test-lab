# Prompt Testing Lab

A modular, standalone prompt-testing and optimization service extracted from the Atomize-News application.

> **Recent Update**: v0 UI integration complete! Added comprehensive deployment management with DeployReview component, impact analysis capabilities, and enhanced cost tracking system.

---

## Overview

This microservice delivers a fast, repeatable way to test, compare, and optimize prompts across multiple LLM providers.  
- **Edge-first**: Next.js 15 API routes run on Vercel edge functions for < 3 s cold starts.  
- **Composable**: Designed as a plug-in module for any project (news, doc-parsing, agent workflows).  
- **Low-ops**: ≤ 5 direct production dependencies, shared Supabase Postgres, no extra servers.

---

## Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| **API** | TypeScript • Next.js 15 `/app/api/*` routes (edge runtime) |
| **Frontend** | Next.js 15 + React 18 | App Router, React Server Actions-ready |
| **State** | React Query *(Zustand optional plugin; not loaded in prod)* | Keeps dep count ≤ 5 |
| **Database** | SQLite (local dev) / Supabase-hosted PostgreSQL (prod) | One DDL for both |
| ***Auth** | NextAuth (GitHub OAuth + Resend Magic-Link) |
| **Observability** | Logflare + OpenTelemetry Edge exporter | <1 dep via bundled plugin |
| **Testing** | Jest (unit) + Playwright (e2e) | CI-ready |
| **Diffing** | `diff-match-patch` | Single, lightweight lib |
| **LLM Runtime** | LangChain (OpenAI, Groq connectors) | Adapter layer |

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# (Optional) run Postgres locally for parity
# docker compose up -d db

# Initialize database
npm run db:init     # uses SQLite by default

# Start dev server (web + edge API)
npm run dev


## Project Structure

```
prompt-testing-lab/
├── packages/
│   ├── api/                 # Edge API routes (Next.js 15)
│   ├── web/                 # Front-end UI
│   ├── shared/              # Types & utils
│   └── sdk/                 # Lightweight client SDK
├── database/                # Prisma schema & migrations
├── docs/                    # Additional guides
└── scripts/                 # Build / deploy helpers

```

## Features

🔄 Real-time prompt A/B/C testing with inline diff viewer
🔌 Pluggable LLM connectors via **LangChain** (OpenAI, Groq; local models via HTTP)
📊 Metrics dashboard (token usage, latency, pass-fail scoring)
🏢 Multi-tenant projects + JWT auth
🔌 Plugin system for custom evaluators / diff algorithms
📱 Responsive, accessible UI (WCAG 2.2 AA) with atomic design system
🚀 One-command Vercel deploy (vercel --prod)
🚢 Complete deployment management with impact analysis
💰 Built-in cost tracking and billing management
📱 Mobile-responsive design with custom hooks (useIsMobile)

## API Endpoints

### Deployment Management
- `POST /projects/:projectId/deployments` - Create deployment
- `GET /projects/:projectId/deployments` - List deployments with pagination  
- `GET /deployments/:deploymentId` - Get deployment details
- `PUT /deployments/:deploymentId` - Update deployment
- `POST /deployments/:deploymentId/rollback` - Rollback deployment
- `DELETE /deployments/:deploymentId` - Delete deployment

### Impact Analysis
- `POST /projects/:projectId/impact-analysis` - Perform impact analysis between prompts
- `GET /impact-analysis/:analysisId` - Get analysis results
- `GET /deployments/:deploymentId/impact-analysis` - Get deployment impact analyses

### Cost Tracking
- `GET /projects/:projectId/cost-data` - Get project cost data
- `GET /projects/:projectId/cost-history` - Get cost history with filtering
- `POST /projects/:projectId/cost-tracking` - Update cost tracking
- `GET /user/billing` - Get user billing info
- `PUT /user/billing` - Update billing settings
- `GET /user/cost-limit-status` - Check cost limits

## UI Components

### Atomic Design System
- **Atoms**: Alert, Button, Select, Separator, Input, Label, Progress, Badge
- **Molecules**: Card, FormField, Metric, NavItem  
- **Organisms**: DeployReview, Header, Sidebar
- **Templates**: MainLayout, ErrorFallback

### Custom Hooks
- `useIsMobile` - Responsive breakpoint detection
- `useKeyboardShortcuts` - Keyboard navigation support

## Documentation

- [API Reference](./docs/api.md)
- [Architecture Guide](./docs/architecture.md)
- [Migration Guide](./docs/migration.md)
- [Deployment Guide](./docs/deployment.md)

## License

MIT