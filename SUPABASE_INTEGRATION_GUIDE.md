# Supabase Integration Guide for Prompt Testing Lab

This guide shows you how to connect your Prompt Testing Lab to your Supabase-based main application for seamless prompt testing and deployment.

## 🚀 Quick Start with Supabase

### Option 1: Share the Same Supabase Project (Recommended)
```bash
# Use the same Supabase project as your main app
DATABASE_URL="postgresql://postgres:[password]@db.[your-project-ref].supabase.co:5432/postgres"
SUPABASE_URL="https://[your-project-ref].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"
```

### Option 2: Separate Supabase Project with Integration
```bash
# Separate project that connects to your main app's Supabase
DATABASE_URL="postgresql://postgres:[password]@db.[lab-project-ref].supabase.co:5432/postgres"
SUPABASE_URL="https://[lab-project-ref].supabase.co"
SUPABASE_ANON_KEY="lab-anon-key"
SUPABASE_SERVICE_ROLE_KEY="lab-service-key"

# Main app connection
MAIN_APP_SUPABASE_URL="https://[main-app-project-ref].supabase.co"
MAIN_APP_SUPABASE_SERVICE_KEY="main-app-service-key"
```

## 📋 Environment Setup

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Configure Supabase integration for main app connection", "status": "completed", "priority": "high"}, {"id": "2", "content": "Update authentication to support Supabase auth", "status": "completed", "priority": "high"}, {"id": "3", "content": "Set up real-time prompt synchronization with Supabase", "status": "completed", "priority": "medium"}, {"id": "4", "content": "Create Supabase-specific integration service", "status": "completed", "priority": "medium"}, {"id": "5", "content": "Update environment configuration for Supabase", "status": "completed", "priority": "low"}]