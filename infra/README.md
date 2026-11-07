# BuildEngine infrastructure

One EC2 VM runs the whole app: the **orchestrator** (Express, port 3000, behind nginx on :80) and the **worker** (polls SQLite, builds sites in Docker, uploads to S3) as separate systemd services. SQLite sits on a separate EBS volume, so the DB survives instance replacement, and that volume is snapshotted daily.

## Pipelines

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR to main, push to feature/addtest, called by CD | `npm ci` + `npm test` on Node 22/24 |
| `infra-ci.yml` | PR/push touching `infra/**`, called by CD | fmt, validate, tflint, shellcheck, trivy; on PRs a `terraform plan` posted as a PR comment |
| `cd.yml` | push to main, manual | tests + infra checks → `terraform apply` → package → upload to S3 → deploy through SSM → `/health` smoke test |

Deploys need no SSH and no AWS keys stored in GitHub (OIDC). A release that fails its health check is rolled back automatically on the VM.

## One-time setup

1. **Bootstrap** (run locally with admin AWS credentials; keep `bootstrap/terraform.tfstate` safe):
   ```bash
   cd infra/bootstrap
   terraform init
   terraform apply
   terraform output github_variables
   ```
2. **GitHub → Settings → Secrets and variables → Actions**
   - Variables: `AWS_REGION`, `TF_STATE_BUCKET`, `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN` (from the output above); optional `JWT_EXPIRES_IN`
   - Secrets: `JWT_SECRET`, `SITES_AWS_ACCESS_KEY_ID`, `SITES_AWS_SECRET_ACCESS_KEY` (keys the worker uses to create site buckets)
3. **GitHub → Settings → Environments** → create `production` (optionally add yourself as a required reviewer to approve each deploy).
4. Push to `main`.

## Operating

```bash
aws ssm start-session --target <instance_id>                      # shell on the VM
sudo journalctl -u buildengine-orchestrator -u buildengine-worker -f
sudo systemctl restart buildengine-worker
```

Secrets live in SSM under `/buildengine/env/` and are loaded into the services on every deploy.
