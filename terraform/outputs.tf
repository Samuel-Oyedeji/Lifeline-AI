output "instance_public_ip" {
  description = "Elastic IP of the EC2 instance"
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ${pathexpand(local.ssh_key_path)} ubuntu@${aws_eip.app.public_ip}"
}

output "private_key_path" {
  description = "Local path of the generated SSH private key"
  value       = pathexpand(local.ssh_key_path)
}
