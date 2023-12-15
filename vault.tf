resource "aws_s3_bucket" "this" {
  bucket_prefix = lower(var.name)
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "example" {
  bucket = aws_s3_bucket.this.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "Archive"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }

    transition {
      days          = var.archive_days
      storage_class = "GLACIER"
    }

    transition {
      days          = var.deep_archive_days != null ? var.deep_archive_days : var.archive_days + 90
      storage_class = "DEEP_ARCHIVE"
    }
  }

}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  count = var.kms_key_id != null ? 1 : 0

  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_id
      sse_algorithm     = "aws:kms"
    }
  }
}
