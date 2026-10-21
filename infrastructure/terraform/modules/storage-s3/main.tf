# S3 object storage for delivered media.
#
# Deliberately written against the `aws` provider only, with no endpoint
# configuration of its own. The caller supplies the provider, so this exact
# module provisions:
#
#   * LocalStack, when environments/local passes a provider with its endpoints
#   * real AWS S3, when environments/aws passes a default provider
#   * Cloudflare R2 or any other S3-compatible target, same way
#
# Nothing here is local-only or AWS-only, which is what keeps the local and
# cloud environments from drifting apart.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_s3_bucket" "media" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy

  tags = var.tags
}

# A public bucket policy is refused unless policy blocking is off. Kept
# explicit so the intent is visible in review rather than implied.
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

# Anonymous GET on delivered media only.
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadDeliveredMedia"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource = [
          for pattern in var.public_read_key_patterns :
          "${aws_s3_bucket.media.arn}/${pattern}"
        ]
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.media]
}

# The player fetches playlists and segments cross-origin (app on :3000,
# storage on another port/host), so without CORS playback fails with an
# opaque media error.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["Content-Length", "Content-Range", "ETag"]
    max_age_seconds = 3000
  }
}

# Expiry rules for temp/ and logs/ (docs/33_Bucket_Structure.md).
#
# Gated behind a flag only because the AWS provider's post-create consistency
# wait never converges against LocalStack 3.0: the rules are written and read
# back correctly, but the provider's comparison includes a field LocalStack
# does not return, so the apply hangs until it times out. Lifecycle expiry is
# a storage-cost control with no effect on local development, so the local
# stack sets manage_lifecycle = false while cloud environments keep it on.
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  count = var.manage_lifecycle ? 1 : 0

  bucket = aws_s3_bucket.media.id

  timeouts {
    create = var.lifecycle_create_timeout
    update = var.lifecycle_create_timeout
  }

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = "Enabled"

      filter {
        prefix = rule.value.prefix
      }

      expiration {
        days = rule.value.expiration_days
      }
    }
  }
}
