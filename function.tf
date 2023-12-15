data "archive_file" "this" {
  type        = "zip"
  output_path = "archiver-bundle.zip"
  source {
    content  = file("${path.module}/src/archiver.mjs")
    filename = "index.mjs"
  }
}

resource "aws_lambda_function" "this" {
  function_name    = var.name
  description      = "Archiver function to back up ECR images"
  filename         = data.archive_file.this.output_path
  source_code_hash = data.archive_file.this.output_base64sha256
  role             = aws_iam_role.this.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  architectures    = ["arm64"]
  timeout          = 300
  memory_size      = 1024

  environment {
    variables = {
      REPOSITORIES = join(",", var.repositories)
      BUCKETNAME   = aws_s3_bucket.this.id
    }
  }
  tracing_config {
    mode = "Active"
  }
}

#tfsec:ignore:aws-cloudwatch-log-group-customer-key
resource "aws_cloudwatch_log_group" "logs" {
  name              = "/aws/lambda/${aws_lambda_function.this.function_name}"
  retention_in_days = 7
}
