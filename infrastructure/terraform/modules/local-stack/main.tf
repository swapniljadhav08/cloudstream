terraform {
  required_providers {
    docker = { source = "kreuzwerker/docker", version = "~> 3.0" }
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

module "contract" {
  source      = "../platform-contract"
  project     = var.project
  environment = var.environment
}

locals {
  name = module.contract.name_prefix
}

# --- Network -----------------------------------------------------------------
# Stands in for a VPC. The app tier joins this network to reach services by
# their container alias (postgres / redis / minio).
resource "docker_network" "platform" {
  name   = "${local.name}-net"
  driver = "bridge"
}

# --- PostgreSQL (stands in for RDS / OCI PostgreSQL) ------------------------
resource "docker_image" "postgres" {
  name         = "postgres:${var.postgres_version}"
  keep_locally = true
}

resource "docker_volume" "postgres_data" {
  name = "${local.name}-pgdata"
}

resource "docker_container" "postgres" {
  name     = "${local.name}-postgres"
  image    = docker_image.postgres.image_id
  restart  = "unless-stopped"
  must_run = true

  env = [
    "POSTGRES_USER=${var.db_username}",
    "POSTGRES_PASSWORD=${var.db_password}",
    "POSTGRES_DB=${module.contract.database_name}",
  ]

  networks_advanced {
    name    = docker_network.platform.name
    aliases = ["postgres"]
  }

  ports {
    internal = 5432
    external = var.host_port_postgres
  }

  volumes {
    volume_name    = docker_volume.postgres_data.name
    container_path = "/var/lib/postgresql/data"
  }

  # Docker 29 reports log options the provider reads back as a diff against
  # its own unset default, which marks the container for replacement on every
  # plan. Replacement here is destructive: LocalStack community keeps S3 in
  # memory, so a needless recreate drops the bucket and everything in it.
  lifecycle {
    ignore_changes = [log_opts]
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U ${var.db_username} -d ${module.contract.database_name}"]
    interval = "5s"
    timeout  = "3s"
    retries  = 10
  }
}

# --- Redis (stands in for ElastiCache / OCI Cache) --------------------------
resource "docker_image" "redis" {
  name         = "redis:${var.redis_version}"
  keep_locally = true
}

resource "docker_volume" "redis_data" {
  name = "${local.name}-redisdata"
}

resource "docker_container" "redis" {
  name     = "${local.name}-redis"
  image    = docker_image.redis.image_id
  restart  = "unless-stopped"
  must_run = true

  # appendonly: BullMQ job state must survive a container restart.
  command = ["redis-server", "--appendonly", "yes"]

  networks_advanced {
    name    = docker_network.platform.name
    aliases = ["redis"]
  }

  ports {
    internal = 6379
    external = var.host_port_redis
  }

  volumes {
    volume_name    = docker_volume.redis_data.name
    container_path = "/data"
  }

  # Docker 29 reports log options the provider reads back as a diff against
  # its own unset default, which marks the container for replacement on every
  # plan. Replacement here is destructive: LocalStack community keeps S3 in
  # memory, so a needless recreate drops the bucket and everything in it.
  lifecycle {
    ignore_changes = [log_opts]
  }

  healthcheck {
    test     = ["CMD", "redis-cli", "ping"]
    interval = "5s"
    timeout  = "3s"
    retries  = 10
  }
}

# --- LocalStack (stands in for S3 / OCI Object Storage) ---------------------
resource "docker_image" "localstack" {
  name         = var.localstack_image
  keep_locally = true
}

resource "docker_volume" "localstack_data" {
  name = "${local.name}-s3data"
}

resource "docker_container" "localstack" {
  name     = "${local.name}-localstack"
  image    = docker_image.localstack.image_id
  restart  = "unless-stopped"
  must_run = true

  env = [
    "SERVICES=s3",
    "DEBUG=0",
    "PERSISTENCE=1",
    "AWS_DEFAULT_REGION=${var.storage_region}",
  ]

  networks_advanced {
    name    = docker_network.platform.name
    aliases = ["localstack", "s3"]
  }

  ports {
    internal = 4566
    external = var.host_port_storage_api
  }

  volumes {
    volume_name    = docker_volume.localstack_data.name
    container_path = "/var/lib/localstack"
  }

  # Docker 29 reports log options the provider reads back as a diff against
  # its own unset default, which marks the container for replacement on every
  # plan. Replacement here is destructive: LocalStack community keeps S3 in
  # memory, so a needless recreate drops the bucket and everything in it.
  lifecycle {
    ignore_changes = [log_opts]
  }

  # No healthcheck block: the LocalStack image defines its own, and declaring
  # a second one here only produces a permanent in-place diff. Readiness is
  # gated by terraform_data.storage_ready below, which is what the bucket
  # resources actually depend on.
}

# --- Readiness gates --------------------------------------------------------
# The aws provider talks to a live endpoint. Provider configuration is static,
# but the bucket resources are sequenced behind this gate so a first apply does
# not race LocalStack's startup.
resource "terraform_data" "storage_ready" {
  triggers_replace = [docker_container.localstack.id]

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-SCRIPT
      for i in $(seq 1 90); do
        if curl -fsS "http://127.0.0.1:${var.host_port_storage_api}/_localstack/health" 2>/dev/null | grep -q '"s3"'; then
          echo "localstack s3 ready after $${i}s"; exit 0
        fi
        sleep 1
      done
      echo "localstack did not become ready in 90s" >&2; exit 1
    SCRIPT
  }
}

resource "terraform_data" "database_ready" {
  triggers_replace = [docker_container.postgres.id]

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-SCRIPT
      for i in $(seq 1 60); do
        if docker exec ${docker_container.postgres.name} pg_isready -U ${var.db_username} -d ${module.contract.database_name} >/dev/null 2>&1; then
          echo "postgres ready after $${i}s"; exit 0
        fi
        sleep 1
      done
      echo "postgres did not become ready in 60s" >&2; exit 1
    SCRIPT
  }
}

# --- Object storage layout (docs/33_Bucket_Structure.md) --------------------
# Same module as environments/aws. The only difference is the provider's
# endpoint, which the environment supplies.
module "storage" {
  source = "../storage-s3"

  bucket_name              = module.contract.bucket_name
  public_read_key_patterns = module.contract.public_read_key_patterns
  lifecycle_rules          = module.contract.lifecycle_rules
  allowed_origins          = var.allowed_origins
  force_destroy            = true

  # See modules/storage-s3/main.tf: the provider's lifecycle consistency wait
  # is incompatible with LocalStack. Cloud environments leave this on.
  manage_lifecycle = false

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [terraform_data.storage_ready]
}
