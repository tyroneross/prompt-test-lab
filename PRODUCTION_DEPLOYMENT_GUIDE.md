# Production Deployment Guide

This guide walks you through deploying the Prompt Testing Lab to production using the recommended hybrid architecture.

## Architecture Overview

- **API Backend**: Railway (Node.js with WebSockets and background jobs)
- **Frontend**: Vercel (React with global CDN)
- **Database**: Supabase (PostgreSQL with real-time features)
- **Monitoring**: Railway + Vercel built-in monitoring

## Prerequisites

1. **Accounts Required**:
   - [Railway](https://railway.app) account
   - [Vercel](https://vercel.com) account  
   - [Supabase](https://supabase.com) account
   - [GitHub](https://github.com) repository

2. **Local Tools**:
   - Node.js 18+
   - pnpm package manager
   - Git

3. **API Keys** (at least one LLM provider):
   - OpenAI API key (recommended)
   - Groq API key (cost-effective alternative)
   - Anthropic API key (optional)

## Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose organization and project name: "prompt-testing-lab"
4. Select region closest to your users
5. Generate a strong database password
6. Wait for project to be created

### 1.2 Configure Database

1. Note your project URL and API keys from Settings > API
2. Copy the database connection string from Settings > Database

### 1.3 Run Database Migration

```bash
# Set environment variables
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migration script
./scripts/migrate-to-postgres.sh

# Verify migration
cd packages/api
pnpm exec prisma db push
```

## Step 2: API Deployment (Railway)

### 2.1 Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Choose "packages/api" as the source directory

### 2.2 Configure Environment Variables

In Railway dashboard, go to your service > Variables:

```bash
# Required Variables
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
JWT_SECRET=your-super-strong-32-character-secret
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-your-openai-key
GROQ_API_KEY=gsk_your-groq-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Optional but recommended
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=warn
```

### 2.3 Configure Build Settings

1. Build Command: `pnpm install && pnpm build`
2. Start Command: `node dist/index.js`
3. Health Check Path: `/health`

### 2.4 Deploy

1. Railway will automatically deploy on git push
2. Note your Railway app URL: `https://your-app.railway.app`

## Step 3: Frontend Deployment (Vercel)

### 3.1 Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Set Framework Preset to "Vite"
5. Set Root Directory to "packages/web"

### 3.2 Configure Build Settings

1. Build Command: `pnpm build`
2. Output Directory: `dist`
3. Install Command: `pnpm install --frozen-lockfile`

### 3.3 Configure Environment Variables

In Vercel dashboard, go to Project Settings > Environment Variables:

```bash
# API Configuration
VITE_API_URL=/api

# Optional
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DSN=your-sentry-dsn
```

### 3.4 Configure API Proxy

Update `packages/web/vercel.json` with your Railway API URL:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-app.railway.app/api/$1"
    }
  ]
}
```

### 3.5 Deploy

1. Vercel will automatically deploy on git push
2. Note your Vercel app URL: `https://your-app.vercel.app`

## Step 4: DNS and Domain Configuration

### 4.1 Custom Domains (Optional)

1. **API Domain**: Configure in Railway dashboard
   - Add custom domain: `api.yourdomain.com`
   - Update DNS CNAME record

2. **Web Domain**: Configure in Vercel dashboard  
   - Add custom domain: `app.yourdomain.com`
   - Update DNS CNAME record

### 4.2 Update CORS Origins

Update Railway environment variables:

```bash
ALLOWED_ORIGINS=https://app.yourdomain.com,https://your-app.vercel.app
```

## Step 5: Monitoring and Observability

### 5.1 Health Checks

1. **Railway**: Automatically monitors `/health` endpoint
2. **Vercel**: Monitors frontend uptime

### 5.2 Error Tracking (Optional)

1. Create [Sentry](https://sentry.io) project
2. Add Sentry DSN to environment variables
3. Monitor errors in real-time

### 5.3 Uptime Monitoring

Set up external monitoring:
- [UptimeRobot](https://uptimerobot.com)
- [Pingdom](https://pingdom.com)
- Monitor both API and web endpoints

## Step 6: Testing Deployment

### 6.1 Automated Deployment Test

```bash
# Run deployment verification
./scripts/deploy-production.sh --verify

# Or run health checks manually
curl https://your-api.railway.app/health
curl https://your-app.vercel.app
```

### 6.2 Manual Testing

1. Visit your frontend URL
2. Create an account
3. Create a test project
4. Run a prompt test
5. Verify results display correctly

## Step 7: Backup and Security

### 7.1 Database Backups

Supabase automatically creates backups:
- Point-in-time recovery available
- Manual backups in dashboard

### 7.2 Security Checklist

- ✅ Strong JWT secret (32+ characters)
- ✅ HTTPS enforced on all endpoints
- ✅ Environment variables not in code
- ✅ API rate limiting enabled
- ✅ CORS properly configured
- ✅ Database connection over SSL

## Troubleshooting

### Common Issues

**1. API not accessible from frontend**
- Check CORS origins configuration
- Verify Vercel proxy configuration
- Check Railway deployment logs

**2. Database connection issues**
- Verify DATABASE_URL format
- Check Supabase project status
- Run migration again if needed

**3. Build failures**
- Check Node.js version compatibility
- Verify pnpm lock file
- Review build logs in Railway/Vercel

### Rollback Procedure

**Quick rollback:**
```bash
# Revert to previous deployment
git revert HEAD
git push origin main
```

**Database rollback:**
```bash
# Restore from Supabase backup
# Use Supabase dashboard to restore from point-in-time
```

## Cost Optimization

### Expected Monthly Costs

- **Railway API**: $5-20 (Hobby to Starter)
- **Vercel Frontend**: $0-20 (Free to Pro) 
- **Supabase Database**: $0-25 (Free to Pro)
- **Total**: $5-65/month

### Cost Reduction Tips

1. Use Groq for cost-effective LLM calls
2. Implement request caching
3. Monitor usage with built-in dashboards
4. Set up billing alerts

## Scaling Considerations

### Performance Optimization

1. Enable Redis for caching (Railway add-on)
2. Implement database connection pooling
3. Use Vercel Edge Functions for dynamic content
4. Monitor performance with Railway metrics

### High Availability

1. Enable Railway auto-scaling
2. Use multiple Vercel regions
3. Implement health check retries
4. Set up status page for users

## Support

- **Railway**: [Railway Docs](https://docs.railway.app)
- **Vercel**: [Vercel Docs](https://vercel.com/docs)
- **Supabase**: [Supabase Docs](https://supabase.com/docs)

For application-specific issues, check the project README and GitHub issues.