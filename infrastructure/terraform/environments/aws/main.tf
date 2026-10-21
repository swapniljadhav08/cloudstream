# AWS environment.
#
#   terraform init
#   terraform apply -var-file=prod.tfvars
#
# Applies the same modules/storage-s3 the local environment uses, against real
# S3, plus RDS and ElastiCache in place of the local containers.
#
# Nothing here writes a .env file: in a real environment the application reads
# these values from the task definition or a secret manager. `terraform output
# -json app_config` emits exactly the keys the local .env contains, so a
# deployment pipeline can render whatever format it needs.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # Uncomment and point at a real bucket before applying: local state for
  # shared cloud infrastructure loses the ability to collaborate safely.
  # backend "s3" {
  #   bucket       = "my-terraform-state"
  #   key          = "video-streaming/aws/terraform.tfstate"
  #   region       = "eu-west-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}

module "stack" {
  source = "../../modules/aws-stack"

  project     = var.project
  environment = var.environment

  vpc_id                 = var.vpc_id
  private_subnet_ids     = var.private_subnet_ids
  app_security_group_ids = var.app_security_group_ids

  db_password     = var.db_password
  allowed_origins = var.allowed_origins
}
