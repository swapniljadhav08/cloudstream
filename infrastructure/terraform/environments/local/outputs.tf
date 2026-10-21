output "storage_public_base_url" { value = module.stack.storage_public_base_url }
output "storage_bucket" { value = module.stack.storage_bucket }
output "storage_endpoint" { value = module.stack.storage_endpoint }
output "network_name" { value = module.stack.network_name }
output "env_files" {
  value = [
    local_file.env_host.filename,
    local_file.env_docker.filename,
    local_file.env_frontend.filename,
  ]
}
