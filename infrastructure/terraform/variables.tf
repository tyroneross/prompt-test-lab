variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "supabase_access_token" {
  description = "Supabase access token"
  type        = string
  sensitive   = true
}

variable "supabase_org_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "supabase_db_password" {
  description = "Supabase database password"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.supabase_db_password) >= 12
    error_message = "Database password must be at least 12 characters long."
  }
}

variable "nextauth_secret" {
  description = "NextAuth.js secret key"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.nextauth_secret) >= 32
    error_message = "NextAuth secret must be at least 32 characters long."
  }
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "groq_api_key" {
  description = "Groq API key"
  type        = string
  sensitive   = true
}

variable "github_oauth_id" {
  description = "GitHub OAuth App ID"
  type        = string
  sensitive   = true
}

variable "github_oauth_secret" {
  description = "GitHub OAuth App Secret"
  type        = string
  sensitive   = true
}

# Removed enable_cdn variable - see main.tf comments for future CDN options

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 7 and 365 days."
  }
}

variable "log_retention_days" {
  description = "Number of days to retain application logs"
  type        = number
  default     = 30
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention value."
  }
}

variable "enable_monitoring" {
  description = "Enable additional monitoring and alerting"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
  
  validation {
    condition     = var.alert_email == "" || can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Alert email must be a valid email address."
  }
}