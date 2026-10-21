terraform {
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

module "contract" {
  source      = "../platform-contract"
  project     = var.project
  environment = var.environment
}

locals {
  name = module.contract.name_prefix

  tags = merge(var.tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# --- Object storage ---------------------------------------------------------
# The same module the local stack applies against LocalStack.
module "storage" {
  source = "../storage-s3"

  bucket_name              = module.contract.bucket_name
  public_read_key_patterns = module.contract.public_read_key_patterns
  lifecycle_rules          = module.contract.lifecycle_rules
  allowed_origins          = var.allowed_origins
  force_destroy            = var.force_destroy_bucket
  tags                     = local.tags
}

# --- Credentials for the application's S3 client -----------------------------
# A task role is preferable where the compute supports it. This user exists so
# the generated .env has the same shape as every other environment; delete it
# and attach the policy to the task role when running on ECS or EKS.
resource "aws_iam_user" "app" {
  name = "${local.name}-app"
  tags = local.tags
}

resource "aws_iam_access_key" "app" {
  user = aws_iam_user.app.name
}

resource "aws_iam_user_policy" "app_storage" {
  name = "${local.name}-storage"
  user = aws_iam_user.app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ]
        Resource = "${module.storage.bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:ListBucketMultipartUploads"]
        Resource = module.storage.bucket_arn
      },
    ]
  })
}

# --- Networking for data services -------------------------------------------
resource "aws_security_group" "database" {
  name        = "${local.name}-db"
  description = "PostgreSQL access for the application tier"
  vpc_id      = var.vpc_id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "database" {
  for_each = toset(var.app_security_group_ids)

  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = each.value
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from the application tier"
}

resource "aws_security_group" "cache" {
  name        = "${local.name}-cache"
  description = "Redis access for the application tier"
  vpc_id      = var.vpc_id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "cache" {
  for_each = toset(var.app_security_group_ids)

  security_group_id            = aws_security_group.cache.id
  referenced_security_group_id = each.value
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "Redis from the application tier"
}

# --- PostgreSQL -------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = var.private_subnet_ids
  tags       = local.tags
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name}-postgres"
  engine         = "postgres"
  engine_version = "16"

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_allocated_storage_gb * 4
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  # Never publicly routable: the application tier reaches it inside the VPC.
  publicly_accessible = false

  multi_az                = var.db_multi_az
  backup_retention_period = 14
  deletion_protection     = var.environment == "prod"
  skip_final_snapshot     = var.environment != "prod"
  final_snapshot_identifier = (
    var.environment == "prod" ? "${local.name}-postgres-final" : null
  )

  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  auto_minor_version_upgrade      = true

  tags = local.tags
}

# --- Redis ------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-cache"
  subnet_ids = var.private_subnet_ids
  tags       = local.tags
}

resource "random_password" "cache_auth" {
  length  = 48
  special = false
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name}-redis"
  description          = "BullMQ queue and cache for ${local.name}"

  engine         = "redis"
  engine_version = "7.1"
  node_type      = var.cache_node_type
  port           = 6379

  # BullMQ relies on blocking commands and Lua; it does not support cluster
  # mode, so this stays a single shard with a replica for failover.
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.cache.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.cache_auth.result

  # Queue state must survive a node replacement, so eviction is not an option:
  # dropping a job key would silently lose a transcode.
  maintenance_window = "sun:05:00-sun:07:00"
  snapshot_window    = "03:00-05:00"

  tags = local.tags
}
