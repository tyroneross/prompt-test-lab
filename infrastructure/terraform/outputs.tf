output "vercel_project_id" {
  description = "Vercel project ID"
  value       = vercel_project.prompt_lab.id
}

output "vercel_deployment_url" {
  description = "Vercel deployment URL"
  value       = "https://${vercel_project.prompt_lab.name}.vercel.app"
}

output "supabase_project_id" {
  description = "Supabase project ID"
  value       = supabase_project.main.id
}

output "supabase_project_url" {
  description = "Supabase project URL"
  value       = supabase_project.main.api_url
}

output "supabase_anon_key" {
  description = "Supabase anonymous key"
  value       = supabase_project.main.anon_key
  sensitive   = true
}

output "database_url" {
  description = "Database connection URL"
  value       = supabase_project.main.database_url
  sensitive   = true
}

output "s3_backup_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.bucket
}

output "s3_backup_bucket_arn" {
  description = "S3 backup bucket ARN"
  value       = aws_s3_bucket.backups.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app_logs.name
}

# Removed CloudFront and WAF outputs - see main.tf comments for future options

output "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  value       = "prompt-testing-lab-terraform-state"
}

output "terraform_state_lock_table" {
  description = "DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_state_lock.name
}