variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "buildengine"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type. Orchestrator + worker + a 1 GB Docker build container need ~4 GB, so t3.medium is the practical minimum."
  type        = string
  default     = "t3.medium"
}

variable "root_volume_size" {
  description = "Root disk in GB: OS, node_modules, releases, Docker build images, swap"
  type        = number
  default     = 30
}

# ---------------------------------------------------------------------------
# Application (BuildEngine npm-workspaces monorepo)
# ---------------------------------------------------------------------------
variable "node_major" {
  description = "Node.js major version (installed from NodeSource). node:sqlite needs >= 22.5."
  type        = string
  default     = "22"
}

variable "services" {
  description = <<-EOT
    Processes to run from the repo root, one systemd unit each (<project>-<name>.service).
    port   = port the process listens on (null for background workers); used for health checks.
    public = true for the one service nginx sends traffic to.
    Ports must match the app code (packages/shared/config.js ORCHESTRATOR_PORT).
  EOT
  type = map(object({
    command = string
    port    = optional(number)
    public  = optional(bool, false)
  }))
  default = {
    orchestrator = { command = "node packages/orchestrator/main.js", port = 3000, public = true }
    worker       = { command = "node packages/workers/main.js" }
  }

  validation {
    condition     = length([for s in values(var.services) : s if s.public]) == 1
    error_message = "Exactly one service must have public = true."
  }

  validation {
    condition     = alltrue([for s in values(var.services) : s.port != null if s.public])
    error_message = "The public service needs a port."
  }
}

variable "sites_aws_region" {
  description = "Region the worker creates site buckets in (AWS_REGION env). Must match AWS_REGION in packages/shared/config.js, which builds the site URL."
  type        = string
  default     = "ap-southeast-2"
}

variable "max_upload_size" {
  description = "nginx client_max_body_size"
  type        = string
  default     = "50m"
}

# ---------------------------------------------------------------------------
# SQLite storage & snapshots
# ---------------------------------------------------------------------------
variable "data_volume_size" {
  description = "Size in GB of the persistent EBS volume holding the SQLite DB"
  type        = number
  default     = 10
}

variable "snapshot_retention_count" {
  description = "Number of daily EBS snapshots of the data volume to keep"
  type        = number
  default     = 7
}

variable "release_retention_days" {
  description = "Days to keep release tarballs in the artifacts bucket"
  type        = number
  default     = 30
}

# ---------------------------------------------------------------------------
# Access mode
#   enable_ssh = false (default) -> SSM Session Manager only, NO port 22 rule
#   enable_ssh = true            -> also creates a key pair + port 22 from your IP
# ---------------------------------------------------------------------------
variable "enable_ssh" {
  description = "Create a key pair and open port 22 to your IP (SSM is always enabled). Leave false in CI."
  type        = bool
  default     = false
}

variable "my_ip_cidr" {
  description = "Your IP in CIDR form (e.g. 203.0.113.10/32). If null and enable_ssh is true, it is auto-detected."
  type        = string
  default     = null
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key used when enable_ssh = true"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}
