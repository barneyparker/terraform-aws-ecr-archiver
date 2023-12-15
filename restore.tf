resource "aws_s3_object" "this" {
  bucket       = aws_s3_bucket.this.id
  key          = "restore.py"
  source       = "${path.module}/src/restore.py"
  etag         = filemd5("${path.module}/src/restore.py")
  content_type = "text/x-python"
}
