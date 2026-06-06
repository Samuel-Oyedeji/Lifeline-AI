locals {
  ssh_key_path = "~/.ssh/onewithai-hacka.pem"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    aws-apn-id  = "pc:8l8gcn23lmlgammd8572tk6va"
    event       = "oneWithAI"
  }
}
