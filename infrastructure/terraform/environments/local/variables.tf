variable "project" {
  type    = string
  default = "video-streaming"
}

variable "docker_host" {
  type    = string
  default = "unix:///var/run/docker.sock"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  default   = "postgres"
  sensitive = true
}

variable "storage_access_key" {
  type    = string
  default = "test"
}

variable "storage_secret_key" {
  type      = string
  default   = "test"
  sensitive = true
}

variable "storage_region" {
  type    = string
  default = "us-east-1"
}

variable "host_port_postgres" {
  type    = number
  default = 5433
}

variable "host_port_redis" {
  type    = number
  default = 6379
}

variable "host_port_storage_api" {
  type    = number
  default = 4566
}

variable "media_allowed_origins" {
  description = <<-DESC
    Origins allowed to fetch media cross-origin. Add any site that will embed
    the player: the iframe loads fine without this, but the browser blocks the
    playlist and segment requests, so playback fails with an opaque error.
  DESC
  type        = list(string)
  default     = ["http://localhost:3000"]
}
