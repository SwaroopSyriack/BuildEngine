output "public_ip" {
  description = "Elastic IP of the server - point your domain here"
  value       = aws_eip.web.public_ip
}

output "url" {
  description = "Ready-to-click URL"
  value       = "http://${aws_eip.web.public_ip}"
}

output "public_dns" {
  description = "Public DNS name of the Elastic IP"
  value       = aws_eip.web.public_dns
}

output "instance_id" {
  description = "EC2 instance ID (CD sends the deploy command here)"
  value       = aws_instance.web.id
}

output "artifacts_bucket" {
  description = "S3 bucket CI uploads release tarballs to"
  value       = aws_s3_bucket.artifacts.id
}

output "ami_id" {
  description = "AMI resolved by the data source"
  value       = data.aws_ami.al2023.id
}

output "data_volume_id" {
  description = "Persistent EBS volume holding the SQLite DB"
  value       = aws_ebs_volume.data.id
}

output "app_env_parameter_prefix" {
  description = "App secrets live here as SSM SecureStrings; each becomes an env var on the next deploy"
  value       = "${local.ssm_prefix}/env/"
}

output "ssm_session_command" {
  description = "Open a shell on the instance via Session Manager (no SSH needed)"
  value       = "aws ssm start-session --target ${aws_instance.web.id} --region ${var.aws_region}"
}

output "ssh_command" {
  description = "SSH command (only when enable_ssh = true)"
  value       = var.enable_ssh ? "ssh ec2-user@${aws_eip.web.public_ip}" : "SSH disabled - use ssm_session_command"
}
