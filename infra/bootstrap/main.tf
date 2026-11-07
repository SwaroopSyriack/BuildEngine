# One-time setup, run locally with your own AWS credentials (local state):
#   cd infra/bootstrap && terraform init && terraform apply
# Creates what GitHub Actions needs before it can run the main stack:
#   - S3 bucket for Terraform state
#   - GitHub OIDC provider (no long-lived AWS keys in GitHub)
#   - a read-only "plan" role for pull requests and a "deploy" role for the production environment

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  description = "Region for the state bucket (use the same region as the main stack)"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Must match project_name in the main stack"
  type        = string
  default     = "buildengine"
}

variable "github_repo" {
  description = "owner/repo allowed to assume the roles"
  type        = string
  default     = "SwaroopSyriack/BuildEngine"
}

variable "github_environment" {
  description = "GitHub environment the deploy jobs run in"
  type        = string
  default     = "production"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform-bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  state_key  = "${var.project_name}/terraform.tfstate"
}

############################################
# Terraform state bucket
############################################

resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project_name}-tfstate-${local.account_id}"


}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

############################################
# GitHub OIDC
############################################

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "plan_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:pull_request",
        "repo:${var.github_repo}:ref:refs/heads/*",
      ]
    }
  }
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Only jobs running in the protected GitHub environment can deploy
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:environment:${var.github_environment}"]
    }
  }
}

# State access shared by both roles (plan also writes the lock file)
data "aws_iam_policy_document" "state" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
  }
  statement {
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${aws_s3_bucket.tfstate.arn}/${local.state_key}",
      "${aws_s3_bucket.tfstate.arn}/${local.state_key}.tflock",
    ]
  }
}

# ---- plan role: read-only, used on pull requests ----
resource "aws_iam_role" "plan" {
  name               = "github-${var.project_name}-plan"
  assume_role_policy = data.aws_iam_policy_document.plan_trust.json
}

resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "plan_state" {
  name   = "terraform-state"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.state.json
}

# ---- deploy role: applies Terraform and ships the app ----
resource "aws_iam_role" "deploy" {
  name               = "github-${var.project_name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

# EC2/VPC/S3/SSM/DLM etc. PowerUserAccess excludes IAM, granted narrowly below.
resource "aws_iam_role_policy_attachment" "deploy_poweruser" {
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

data "aws_iam_policy_document" "deploy_iam" {
  # Manage only the stack's own roles/instance profile (named <project>-*).
  # The GitHub roles are named github-<project>-* so they can't edit themselves.
  statement {
    sid     = "StackIam"
    actions = ["iam:*"]
    resources = [
      "arn:aws:iam::${local.account_id}:role/${var.project_name}-*",
      "arn:aws:iam::${local.account_id}:instance-profile/${var.project_name}-*",
    ]
  }
}

resource "aws_iam_role_policy" "deploy_iam" {
  name   = "stack-iam"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_iam.json
}

resource "aws_iam_role_policy" "deploy_state" {
  name   = "terraform-state"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.state.json
}

############################################
# Values to put in GitHub -> Settings -> Secrets and variables -> Actions -> Variables
############################################

output "github_variables" {
  value = {
    AWS_REGION          = var.aws_region
    TF_STATE_BUCKET     = aws_s3_bucket.tfstate.id
    AWS_PLAN_ROLE_ARN   = aws_iam_role.plan.arn
    AWS_DEPLOY_ROLE_ARN = aws_iam_role.deploy.arn
  }
}
