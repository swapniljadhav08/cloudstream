variable "project" {
  type    = string
  default = "video-streaming"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "app_security_group_ids" {
  type = list(string)
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "allowed_origins" {
  description = "Origins permitted to fetch media cross-origin, e.g. the public app URL."
  type        = list(string)
}
