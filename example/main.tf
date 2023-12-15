# Repository to archive
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
