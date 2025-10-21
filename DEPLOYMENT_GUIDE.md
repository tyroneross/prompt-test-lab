# Deployment Guide - Prompt Testing Lab

## Overview

This guide provides comprehensive instructions for deploying the Prompt Testing Lab MVP to production using the automated CI/CD pipeline and supporting infrastructure.

## Architecture Summary

The deployment architecture follows modern DevOps best practices:

- **Edge-first**: Next.js 15 on Vercel Edge Functions for sub-3s cold starts
- **Database**: Supabase-managed PostgreSQL with automated backups
- **Monitoring**: Grafana + Prometheus with Logflare integration
- **Security**: Comprehensive security headers, CORS, rate limiting
- **CI/CD**: GitHub Actions with automated testing, security scanning, deployment
- **Infrastructure**: Terraform-managed cloud resources

## Quick Start

### 1. Prerequisites

```bash
# Required tools
node >= 18.0.0
npm >= 9.0.0
git
docker (optional, for local development)
terraform (for infrastructure management)
vercel CLI
```

### 2. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd prompt-testing-lab

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables (see Environment Configuration below)
```

### 3. Development Environment

```bash
# Start local development
npm run dev

# Or with Docker
docker-compose up
```

### 4. Production Deployment

```bash
# Deploy to staging
./scripts/deployment/deploy.sh -e staging

# Deploy to production
./scripts/deployment/deploy.sh -e production
```

## Environment Configuration

### Required Environment Variables

Configure these in your `.env` file and deployment environments:

```bash
# Core Application
NODE_ENV=production
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-32-char-secret

# Authentication
GITHUB_ID=your-github-oauth-id
GITHUB_SECRET=your-github-oauth-secret

# LLM Providers
OPENAI_API_KEY=your-openai-key
GROQ_API_KEY=your-groq-key

# Monitoring (optional)
LOGFLARE_API_KEY=your-logflare-key
SENTRY_DSN=your-sentry-dsn
```

### GitHub Repository Setup

1. **Secrets Configuration**
   
   Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

   ```
   VERCEL_TOKEN                    # Vercel deployment token
   VERCEL_ORG_ID                  # Your Vercel organization ID
   VERCEL_PROJECT_ID              # Vercel project ID
   DATABASE_URL                   # Production database URL
   NEXTAUTH_SECRET                # NextAuth secret key
   OPENAI_API_KEY                 # OpenAI API key
   GROQ_API_KEY                   # Groq API key
   GITHUB_ID                      # GitHub OAuth app ID
   GITHUB_SECRET                  # GitHub OAuth app secret
   SNYK_TOKEN                     # Snyk security scanning token
   SLACK_WEBHOOK                  # Slack notifications webhook
   ```

2. **Branch Protection**
   
   Configure branch protection rules for `main`:
   - Require pull request reviews
   - Require status checks to pass
   - Require branches to be up to date
   - Restrict who can push to matching branches

## Infrastructure Deployment

### 1. Terraform Setup

```bash
# Navigate to infrastructure directory
cd infrastructure/terraform

# Copy variables template
cp terraform.tfvars.example terraform.tfvars

# Configure your variables in terraform.tfvars
# (See terraform.tfvars.example for all options)

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply infrastructure
terraform apply
```

### 2. Infrastructure Components

The Terraform configuration creates:

- **Vercel Project**: Configured with environment variables and build settings
- **Supabase Project**: Managed PostgreSQL database with authentication
- **AWS Resources**: S3 backup bucket, CloudWatch logs, DynamoDB state lock
- **CloudFront CDN**: (Optional) for static asset delivery
- **Monitoring**: CloudWatch monitoring and alerting

## CI/CD Pipeline

### Workflow Overview

The GitHub Actions pipeline includes:

1. **Continuous Integration** (`.github/workflows/ci.yml`)
   - Type checking and linting
   - Unit and integration tests
   - End-to-end testing with Playwright
   - Security scanning with Snyk and CodeQL
   - Build verification

2. **Security Scanning** (`.github/workflows/security.yml`)
   - Dependency vulnerability scanning
   - Container security with Trivy
   - Secrets detection with GitLeaks
   - Infrastructure security with Checkov
   - SAST analysis with Semgrep

3. **Deployment** (`.github/workflows/deploy.yml`)
   - Staging deployment on main branch pushes
   - Production deployment on version tags
   - Database migration automation
   - Health checks and rollback on failure
   - Deployment artifact management

4. **Automated Updates** (`.github/workflows/auto-update.yml`)
   - Weekly dependency updates
   - Security patch automation
   - GitHub Actions version updates

### Deployment Triggers

- **Staging**: Automatic deployment on push to `main` branch
- **Production**: Manual deployment via version tags (`v1.0.0`, `v1.0.1`, etc.)
- **Rollback**: Automatic rollback on deployment failure (configurable)

### Creating a Production Release

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# This triggers the production deployment workflow
```

## Database Management

### Migration Strategy

```bash
# Run database migrations
./scripts/database/migrate.sh -e production

# Create database backup
./scripts/database/backup.sh -e production

# Rollback migrations (if needed)
./scripts/database/migrate.sh -e production -r 1
```

### Backup Configuration

- **Automatic Backups**: Daily full backups via Supabase
- **Manual Backups**: On-demand via backup script
- **Retention**: 30 days default (configurable)
- **Storage**: Local + S3 with encryption
- **Verification**: Automated backup integrity checks

## Monitoring and Observability

### Application Monitoring

- **Metrics**: Prometheus metrics at `/api/metrics`
- **Logs**: Structured logging via Logflare
- **Errors**: Error tracking with Sentry
- **Performance**: Real User Monitoring (RUM)
- **Health Checks**: Comprehensive health endpoints

### Grafana Dashboards

Access monitoring dashboards:
- Application metrics: Request rate, response time, error rate
- Infrastructure metrics: CPU, memory, database performance
- Business metrics: User activity, API usage, LLM costs

### Alerting

Alerts are configured for:
- Application errors (>5% error rate)
- High response times (>2s P95)
- Database connection issues
- Security incidents
- Deployment failures

## Security Configuration

### Security Headers

Comprehensive security headers are automatically applied:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options
- Cross-Origin policies

### Rate Limiting

API rate limits are configured:
- General API: 100 requests/15 minutes
- Authentication: 5 requests/15 minutes  
- LLM endpoints: 10 requests/minute

### CORS Configuration

CORS is configured to allow:
- Production domain
- Staging domain
- Local development (localhost:8002, localhost:8001)

## Rollback Procedures

### Automatic Rollback

The deployment pipeline automatically rolls back on:
- Health check failures
- Critical errors during deployment
- Database migration failures

### Manual Rollback

```bash
# Using deployment script rollback
./scripts/rollback/rollback-YYYYMMDD_HHMMSS.sh

# Or using Vercel CLI
vercel rollback [deployment-url]

# For database rollback
./scripts/database/migrate.sh -e production -r 1
```

### Rollback Verification

After rollback:
1. Run health checks: `./scripts/deployment/health-check.sh --url=https://your-domain.com`
2. Verify application functionality
3. Check monitoring dashboards
4. Validate database integrity

## Performance Optimization

### Edge Runtime Configuration

- **Next.js 15**: App Router with React Server Components
- **Vercel Edge**: Sub-3s cold starts globally
- **CDN**: Static assets served from global CDN
- **Caching**: Redis caching for API responses

### Database Optimization

- **Connection Pooling**: Configured for Supabase
- **Query Optimization**: Prisma ORM with optimized queries
- **Indexing**: Database indexes for critical queries
- **Read Replicas**: Available for high-traffic scenarios

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   ```bash
   # Check deployment logs
   vercel logs [deployment-url]
   
   # Run health checks
   ./scripts/deployment/health-check.sh --url=https://your-domain.com
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   ./scripts/database/migrate.sh -e production -d
   
   # Check connection pool
   # Review DATABASE_URL configuration
   ```

3. **Authentication Problems**
   ```bash
   # Verify OAuth configuration
   # Check NEXTAUTH_URL and secrets
   # Validate GitHub OAuth app settings
   ```

### Support Contacts

- **Technical Issues**: Create GitHub issue
- **Security Concerns**: security@prompt-lab.com
- **Infrastructure**: infrastructure@prompt-lab.com

## Maintenance

### Regular Tasks

- **Weekly**: Review dependency updates PR
- **Monthly**: Security scan results review
- **Quarterly**: Infrastructure cost optimization
- **Annually**: Disaster recovery testing

### Health Checks

```bash
# Manual health check
./scripts/deployment/health-check.sh --url=https://your-domain.com --verbose

# Comprehensive system check
npm run test:system
```

### Updates and Patches

The system automatically:
- Creates PRs for dependency updates
- Applies security patches
- Updates GitHub Actions
- Monitors for vulnerabilities

## Best Practices

### Development Workflow

1. **Feature Branches**: Create feature branches from `main`
2. **Pull Requests**: All changes via PR with review
3. **Testing**: Ensure all tests pass before merge
4. **Security**: Run security scans on all PRs

### Deployment Strategy

1. **Staging First**: Test all changes in staging
2. **Version Tags**: Use semantic versioning for releases
3. **Gradual Rollout**: Monitor metrics after deployment
4. **Quick Rollback**: Be prepared to rollback if issues arise

### Security Practices

1. **Secrets Management**: Never commit secrets to git
2. **Environment Separation**: Separate dev/staging/prod environments
3. **Access Control**: Minimal required permissions
4. **Audit Trails**: Log all administrative actions

---

For additional help, refer to the individual script documentation or create an issue in the repository.