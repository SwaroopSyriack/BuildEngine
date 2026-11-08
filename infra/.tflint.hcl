# TFLint config for infra/ and infra/bootstrap (infra-ci.yml runs `tflint --recursive --config $PWD/.tflint.hcl`)

config {
  call_module_type = "local"
}

# Bundled with tflint - no download needed
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# Optional AWS ruleset (invalid instance types, AMIs, etc.). Pin a released version before enabling:
# plugin "aws" {
#   enabled = true
#   version = "<x.y.z>"
#   source  = "github.com/terraform-linters/tflint-ruleset-aws"
# }
