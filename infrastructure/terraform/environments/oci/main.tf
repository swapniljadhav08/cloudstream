# Oracle Cloud environment.
#
#   terraform init
#   terraform apply -var-file=prod.tfvars
#
# Same platform contract as ../local and ../aws. The differences are confined
# to modules/oci-stack: OCI Object Storage replaces S3 (reached through its S3
# Compatibility API, so the application code is unchanged), and public read is
# handled by the CDN because OCI has no prefix-scoped anonymous access.

terraform {
  required_version = ">= 1.6"

  required_providers {
    oci = { source = "oracle/oci", version = "~> 6.0" }
  }

  # backend "s3" {
  #   # OCI Object Storage is S3-compatible, so the s3 backend works here too.
  #   bucket = "my-terraform-state"
  #   key    = "video-streaming/oci/terraform.tfstate"
  # }
}

provider "oci" {
  region = var.region
  # Credentials come from ~/.oci/config or OCI_* environment variables;
  # declaring them here would put secrets in the configuration.
}

module "stack" {
  source = "../../modules/oci-stack"

  project     = var.project
  environment = var.environment

  compartment_id = var.compartment_id
  region         = var.region
  subnet_id      = var.subnet_id
  app_user_id    = var.app_user_id

  db_password = var.db_password
}
