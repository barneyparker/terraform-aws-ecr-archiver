resource "aws_iam_role" "this" {
  name               = var.name
  assume_role_policy = data.aws_iam_policy_document.this_assume.json
  inline_policy {
    name   = "archiver"
    policy = data.aws_iam_policy_document.this.json
  }
  permissions_boundary = var.boundary_policy_arn
}

data "aws_iam_policy_document" "this_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}


data "aws_iam_policy_document" "this" {
  statement {
    sid = "logging"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }

  statement {
    actions = [
      "ecr:BatchGetImage",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:ListImages",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = [
      "arn:aws:s3:::${aws_s3_bucket.this.id}",
      "arn:aws:s3:::${aws_s3_bucket.this.id}/*",
    ]
  }
}
