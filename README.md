# Terraform AWS ECR Archiver

This module continually archives ECR images to S3. It is intended to be used as a backup solution for ECR images.

## Usage

```hcl
resource "aws_ecr_repository" "test" {
  name = "my-repo"
}

module "archiver" {
  source = "../"

  name = "ECR-Archiver"

  repositories = [
    aws_ecr_repository.test.name
  ]

  tags = {
    Application = "My Important Application"
    Team        = "App Team"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| name | Name of the archiver | `string` | n/a | yes |
| repositories | List of ECR repositories to archive | `list(string)` | n/a | yes |
| schedule | Schedule for the archiver to run | `string` | `"cron(30 2 * * ? *)"` | no |
| boundary\_policy\_arn | Boundary policy to attach to the role | `string` | `null` | no |
| tags | Tags to apply to resources | `map(string)` | `{}` | no |
| archive\_days | Number of days before moving to archive storage | `number` | `1` | no |
| deep\_archive\_days | Number of days before moving to deep archive storage | `number` | `null` | no |
| kms\_key\_id | KMS key to use for encryption | `string` | `null` | no |

## Outputs

| Name | Description |
|------|-------------|
| bucket\_arn | ARN of the bucket |
| bucket\_id | ID of the bucket |
