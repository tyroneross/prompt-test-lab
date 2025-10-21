terraform {
  required_version = ">= 1.5"
  
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.15"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "prompt-testing-lab-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-east-1"
    
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

# Configure providers
provider "vercel" {
  api_token = var.vercel_api_token
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "vercel_project_directory" "prompt_lab" {
  path = "../.."
}

# Local values
locals {
  project_name = "prompt-testing-lab"
  environment  = var.environment
  
  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

# Vercel Project
resource "vercel_project" "prompt_lab" {
  name      = local.project_name
  framework = "nextjs"
  
  git_repository = {
    type = "github"
    repo = var.github_repo
  }

  build_command    = "npm run build"
  output_directory = "packages/web/dist"
  install_command  = "npm ci"
  
  environment = [
    {
      key    = "NODE_ENV"
      value  = "production"
      target = ["production"]
    },
    {
      key    = "NEXT_TELEMETRY_DISABLED"
      value  = "1"
      target = ["production", "preview"]
    },
    {
      key    = "DATABASE_URL"
      value  = supabase_project.main.database_url
      target = ["production"]
    },
    {
      key    = "NEXTAUTH_URL"
      value  = "https://${local.project_name}.vercel.app"
      target = ["production"]
    },
    {
      key       = "NEXTAUTH_SECRET"
      value     = var.nextauth_secret
      target    = ["production"]
      sensitive = true
    },
    {
      key       = "OPENAI_API_KEY"
      value     = var.openai_api_key
      target    = ["production"]
      sensitive = true
    },
    {
      key       = "GROQ_API_KEY"
      value     = var.groq_api_key
      target    = ["production"]
      sensitive = true
    },
    {
      key       = "GITHUB_ID"
      value     = var.github_oauth_id
      target    = ["production"]
      sensitive = true
    },
    {
      key       = "GITHUB_SECRET"
      value     = var.github_oauth_secret
      target    = ["production"]
      sensitive = true
    }
  ]

  production_deployment_enabled = true
  preview_deployment_enabled    = true
}

# Supabase Project
resource "supabase_project" "main" {
  organization_id = var.supabase_org_id
  name           = local.project_name
  database_password = var.supabase_db_password
  region         = "us-east-1"
  
  tags = local.common_tags
}

# Supabase Database Schema
resource "supabase_settings" "main" {
  project_ref = supabase_project.main.id
  
  api = {
    db_schema            = "public"
    db_extra_search_path = "public"
    max_rows             = 1000
  }
  
  auth = {
    enable_signup                = false
    enable_manual_linking        = false
    enable_phone_signup          = false
    enable_phone_autoconfirm     = false
    phone_double_opt_in          = true
    enable_anonymous_sign_ins    = false
    minimum_password_length      = 8
    password_required_characters = "lower,upper,number,special"
    
    external_github_enabled = true
    external_github_client_id = var.github_oauth_id
    external_github_secret = var.github_oauth_secret
    external_github_redirect_uri = "https://${local.project_name}.vercel.app/api/auth/callback/github"
  }
}

# AWS S3 Bucket for backups
resource "aws_s3_bucket" "backups" {
  bucket = "${local.project_name}-backups-${var.environment}"
  
  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "backups" {
  bucket = aws_s3_bucket.backups.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "backup_lifecycle"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/vercel/${local.project_name}"
  retention_in_days = 30
  
  tags = local.common_tags
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_state_lock" {
  name           = "terraform-state-lock"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

# =============================================================================
# FUTURE INFRASTRUCTURE OPTIONS
# =============================================================================
# The following resources are documented for future scaling needs:
#
# 1. AWS CloudFront CDN
#    - Global content delivery network
#    - Improves performance for users worldwide
#    - Cost: ~$0.085/GB + $0.0075/10k requests
#    - When to add: >10k users or international traffic
#
# 2. AWS WAF (Web Application Firewall)
#    - Protects against OWASP Top 10 attacks
#    - DDoS protection and rate limiting
#    - Cost: ~$5-10/month base + $0.60/million requests
#    - When to add: Security compliance or frequent attacks
#
# 3. Multi-region deployment
#    - AWS regions: us-west-2, eu-west-1
#    - Database replication
#    - When to add: >100k users or strict SLA requirements
#
# See DEPLOYMENT_GUIDE.md for implementation details when needed.