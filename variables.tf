variable "name" {
  type        = string
  description = "Name for the ECR Archiver function"
  default     = "ECR-Archiver"
}

variable "repositories" {
  type        = list(string)
  description = "List of repositories to check (or blank for all repositories in this account)"
  default     = []
}

variable "schedule" {
  type        = string
  description = "AWS Cron Schedule for running the function"
  default     = "cron(30 2 * * ? *)"
}

variable "boundary_policy_arn" {
  type        = string
  description = "ARN of the policy to use as a boundary for the IAM role"
  default     = null
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to the resources"
  default     = {}
}

variable "archive_days" {
  type        = number
  description = "Number of days before moving to archive storage"
  default     = 1
}

variable "deep_archive_days" {
  type        = number
  description = "Number of days before moving to deep archive storage"
  default     = null
}

variable "kms_key_id" {
  type        = string
  description = "KMS key ID to use for encryption"
  default     = null
}
