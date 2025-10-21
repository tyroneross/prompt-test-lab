# Vercel Serverless Deployment Guide

Deploy your Prompt Testing Lab entirely on Vercel + Supabase - no server management required!

## Quick Start (5 minutes)

### 1. Set up Supabase (2 min)
```bash
# Create Supabase project at https://supabase.com
# Note your project URL and anon key

# Run local setup
./scripts/setup-supabase.sh --production
```

### 2. Run Migration (1 min)
```bash
# Convert Express to Vercel functions
./scripts/migrate-to-vercel-serverless.sh

# Convert remaining routes
./scripts/convert-remaining-routes.sh
```

### 3. Deploy to Vercel (2 min)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (follow prompts)
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add OPENAI_API_KEY
```

## Environment Variables

### Required for Vercel
```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
JWT_SECRET=your-super-secure-32-char-secret
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key
ALLOWED_ORIGINS=https://your-app.vercel.app
CRON_SECRET=random-secret-for-cron-jobs

# At least one LLM provider
OPENAI_API_KEY=sk-...
# OR
GROQ_API_KEY=gsk_...
```

### Frontend (.env.production)
```bash
VITE_API_URL=/api
VITE_SUPABASE_URL=https://[PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

## Project Structure (Serverless)

```
prompt-testing-lab/
├── packages/
│   ├── api/
│   │   ├── api/              # Vercel API routes
│   │   │   ├── auth/
│   │   │   │   ├── login.ts
│   │   │   │   └── register.ts
│   │   │   ├── projects/
│   │   │   │   └── index.ts
│   │   │   ├── prompts/
│   │   │   │   ├── index.ts
│   │   │   │   └── test.ts
│   │   │   ├── cron/
│   │   │   │   └── process-queue.ts
│   │   │   └── health.ts
│   │   ├── lib/              # Shared utilities
│   │   │   ├── database/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   └── middleware/       # Middleware functions
│   └── web/                  # React frontend
└── vercel.json               # Vercel configuration

```

## Testing Locally

```bash
# Test with Vercel CLI
vercel dev

# API runs on: http://localhost:3000/api
# Frontend runs on: http://localhost:3000
```

## Deployment Commands

### First Deployment
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Update Deployment
```bash
# Auto-deploys on git push to main
git push origin main

# Manual production deploy
vercel --prod
```

## Features Comparison

| Feature | Express (Railway) | Vercel Serverless |
|---------|------------------|-------------------|
| Setup Time | 30 min | 5 min |
| Monthly Cost | $15-30 | $0-20 |
| Cold Start | None | 200-500ms |
| WebSockets | Native | Supabase Realtime |
| Background Jobs | Native queues | Vercel Cron |
| Scaling | Manual | Automatic |
| Global CDN | No | Yes |

## Real-time with Supabase

WebSocket connections are replaced with Supabase Realtime:

```typescript
// Frontend subscription
import { supabase } from '@/lib/supabase';

// Subscribe to test updates
const channel = supabase
  .channel('test-updates')
  .on('broadcast', { event: 'update' }, ({ payload }) => {
    console.log('Test update:', payload);
  })
  .subscribe();

// Cleanup
channel.unsubscribe();
```

## Background Jobs with Vercel Cron

Queue processing runs every 5 minutes:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-queue",
    "schedule": "*/5 * * * *"
  }]
}
```

## Monitoring

### Vercel Dashboard
- Function logs
- Error tracking
- Performance metrics
- Usage analytics

### Supabase Dashboard
- Database metrics
- Real-time connections
- Query performance
- Storage usage

## Troubleshooting

### Common Issues

**Cold starts too slow?**
- Reduce bundle size
- Use Edge Functions for simple endpoints
- Upgrade to Vercel Pro for faster cold starts

**Database connection errors?**
- Check connection pooling settings
- Use Supabase connection pooler URL
- Implement retry logic

**Cron jobs not running?**
- Verify CRON_SECRET is set
- Check Vercel logs for errors
- Ensure cron schedule is valid

**Real-time not working?**
- Verify Supabase keys are correct
- Check Supabase Realtime is enabled
- Review CORS settings

## Cost Optimization

### Free Tier Limits
- **Vercel Hobby**: 100GB bandwidth, 100hrs compute
- **Supabase Free**: 500MB database, 2GB bandwidth
- **Total**: $0/month for light usage

### When to Upgrade
- **Vercel Pro ($20/mo)**: >100GB bandwidth or need teams
- **Supabase Pro ($25/mo)**: >500MB database or >50 concurrent connections

## Migration Rollback

If you need to revert to Express:

```bash
# Rollback to Express
./scripts/migrate-to-vercel-serverless.sh --rollback

# Restore Railway deployment
railway up
```

## Support Links

- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Vercel Functions](https://vercel.com/docs/functions)

## Next Steps

1. ✅ Run migration script
2. ✅ Set up Supabase project
3. ✅ Deploy to Vercel
4. ✅ Configure custom domain
5. ✅ Set up monitoring alerts

Your serverless Prompt Testing Lab is ready! 🚀