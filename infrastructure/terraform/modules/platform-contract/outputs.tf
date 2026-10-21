locals {
  # docs/33_Bucket_Structure.md - one bucket, prefixed per concern.
  # Local uses the bare project slug so it matches docs/26_Environment_Variables.md
  # (MINIO_BUCKET=video-streaming); cloud environments get a suffix because
  # S3 and OCI bucket namespaces are shared across tenants.
  bucket_name = var.environment == "local" ? var.project : "${var.project}-${var.environment}"

  # Object key prefixes. The application derives every key from these, so a
  # change here propagates to all providers and to the generated app config.
  prefixes = {
    original   = "original"
    metadata   = "metadata"
    hls        = "hls"
    thumbnails = "thumbnails"
    preview    = "preview"
    temp       = "temp"
    logs       = "logs"
  }

  # docs/33_Bucket_Structure.md - Lifecycle Rules.
  lifecycle_rules = [
    { id = "temp-cleanup", prefix = "temp/", expiration_days = 1 },
    { id = "log-cleanup", prefix = "logs/", expiration_days = 30 },
  ]

  # docs/32_FFmpeg_Profiles.md - the ABR ladder. Exported so infrastructure
  # sizing (worker CPU/memory) and the worker's encode profiles agree.
  rendition_ladder = [
    { name = "144p", width = 256, height = 144, video_kbps = 150, audio_kbps = 48, crf = 30, h264_profile = "baseline", level = "3.0" },
    { name = "240p", width = 426, height = 240, video_kbps = 400, audio_kbps = 64, crf = 28, h264_profile = "baseline", level = "3.0" },
    { name = "360p", width = 640, height = 360, video_kbps = 800, audio_kbps = 96, crf = 26, h264_profile = "main", level = "3.0" },
    { name = "480p", width = 854, height = 480, video_kbps = 1400, audio_kbps = 128, crf = 24, h264_profile = "main", level = "3.1" },
    { name = "720p", width = 1280, height = 720, video_kbps = 2400, audio_kbps = 192, crf = 23, h264_profile = "main", level = "4.0" },
    { name = "1080p", width = 1920, height = 1080, video_kbps = 4800, audio_kbps = 256, crf = 22, h264_profile = "high", level = "4.2" },
    { name = "4k", width = 3840, height = 2160, video_kbps = 16000, audio_kbps = 320, crf = 21, h264_profile = "high", level = "5.1" },
  ]

  # Anonymous GET is granted to delivered media only (docs/33_Bucket_Structure.md).
  # Originals, metadata, temp and logs stay private. Patterns are relative to
  # the bucket root and the leading "*" is the {videoId} path segment.
  public_read_key_patterns = ["*/hls/*", "*/thumbnails/*", "*/preview.gif"]
}

output "bucket_name" { value = local.bucket_name }
output "prefixes" { value = local.prefixes }
output "lifecycle_rules" { value = local.lifecycle_rules }
output "rendition_ladder" { value = local.rendition_ladder }
output "public_read_key_patterns" { value = local.public_read_key_patterns }

output "database_name" { value = replace(var.project, "-", "_") }
output "name_prefix" { value = "${var.project}-${var.environment}" }
