# BuildEngine

A self-hosted static site deployment platform: a small Netlify/Vercel you run yourself.
Give it a Git repository and it clones the code, builds it in a Docker container, and
publishes the output to S3 as a live website. Every build streams logs you can follow
from the dashboard.

## Tech stack

Node.js 22 (ES modules, `node:sqlite`) · Express 5 · SQLite · Docker (dockerode) · AWS S3 ·
vanilla JS + Tailwind frontend · Terraform · GitHub Actions · nginx · systemd

## Running locally

**Requirements:** Node.js 22+, Git, Docker, and an AWS account for site uploads.

1. Install dependencies from the repo root:
   ```bash
   npm install
   ```
2. Create `.env` in the repo root:
   ```env
   JWT_SECRET=change-me
   JWT_EXPIRES_IN=7d
   AWS_REGION=ap-southeast-2
   AWS_ACCESSKEYID=<access key used to create site buckets>
   AWS_SECRETACCESSKEY=<secret key>
   ```
3. Start the API and UI:
   ```bash
   node packages/orchestrator/main.js
   ```
4. In a second terminal, start the worker:
   ```bash
   node packages/workers/main.js
   ```
5. Open http://localhost:3000, create an account, add a project and click **Deploy**.

The database is created automatically at `data/buildengine.db`, and build workspaces go in `tmp/`.

### Configuration (`packages/shared/config.js`)

| Setting | Default | Env override |
|---|---|---|
| API port | `3000` | — |
| Default build image | `node:20-bullseye` | `DEFAULT_BUILD_IMAGE` |
| Default build command | `npm install && npm run build` | `DEFAULT_BUILD_COMMAND` |
| Clone timeout | 2 min | `CLONE_TIMEOUT_MS` |
| Build timeout | 5 min | `BUILD_TIMEOUT_MS` |
| Build container memory | 1 GB | `CONTAINER_MEMORY_BYTES` |
| Output folders tried | `dist`, `build`, `out` | — |

## API

All routes except `/health` and `/auth/*` need a session cookie or `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/signup` | `{ name, email, passwd }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, passwd }` → `{ token, user }` |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Clear the session |
| GET | `/projects` | Your projects |
| POST | `/projects` | `{ user_id, name, repo_url, build_command?, build_image?, output_dir?, spa_fallback? }` |
| GET | `/projects/:id` | One project |
| DELETE | `/projects/:id` | Delete a project |
| GET | `/projects/:id/deployments` | A project's deployments |
| POST | `/deploy/:id` | Queue a deployment → `{ deploymentId, status }` |
| GET | `/deployments/:id` | One deployment |
| GET | `/deployments/:id/logs` | Build logs; `?format=json`, `?stream=stdout\|stderr\|system` |

## Tests

Tests use Node's built-in test runner, with no extra dependencies. Each run copies the repo to a
temporary folder and starts the orchestrator from there, so your real database is never touched.

```bash
JWT_SECRET=test-secret npm test
```

| File | Covers |
|---|---|
| `tests/syntax.test.js` | Every JS file in `packages/` parses |
| `tests/api.test.js` | Auth, projects, deploy queue, deployments and logs against a running server |
| `tests/models.test.js` | Job queue claim, ready/failed results, commit SHA, live deployment, build logs |

Port 3000 must be free while the tests run.

## CI/CD

| Workflow | Runs on | What it does |
|---|---|---|
| `ci.yml` | PRs to `dev`, called by CD | `npm ci` + `npm test` on Node 22 and 24 |
| `infra-ci.yml` | PRs/pushes touching `infra/**`, called by CD | `terraform fmt`/`validate`, tflint, shellcheck, Trivy; on PRs a `terraform plan` posted as a comment |
| `cd.yml` | Push to `dev`, manual | Tests + infra checks → `terraform apply` → package → upload to S3 → deploy through SSM → `/health` smoke test |

Deploys use GitHub OIDC (no AWS keys stored in GitHub) and AWS SSM

## Infrastructure (`infra/`)

Terraform creates one EC2 instance (Amazon Linux 2023) running the orchestrator and worker as
systemd services behind nginx:

- A VPC, public subnet and security group (HTTP only; SSH optional and off by default)
- An **Elastic IP**, so the address survives instance replacement
- A separate **encrypted EBS volume** for SQLite, with **daily snapshots** (DLM, 7 kept)
- An S3 bucket for release artifacts
- An IAM role for SSM access, app secrets (SSM Parameter Store) and reading releases
- IMDSv2 enforced, with hop limit 1 so build containers can't read instance credentials

### One-time setup

1. Bootstrap the state bucket, OIDC provider and GitHub roles (run locally with admin credentials):
   ```bash
   cd infra/bootstrap && terraform init && terraform apply && terraform output github_variables
   ```
   Keep `infra/bootstrap/terraform.tfstate` safe; it's local state and isn't committed.
2. In GitHub → Settings → Secrets and variables → Actions:
   - **Variables:** `AWS_REGION`, `TF_STATE_BUCKET`, `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`, optional `JWT_EXPIRES_IN`
   - **Secrets:** `JWT_SECRET`, `SITES_AWS_ACCESS_KEY_ID`, `SITES_AWS_SECRET_ACCESS_KEY`
3. In GitHub → Settings → Environments, create `production`. Allow deployments from `dev` only, and optionally require a reviewer.
4. Push to `dev`.


## Project structure

```
buildEngine/
├── packages/
│   ├── orchestrator/   # Express API, routes, auth middleware, frontend (public/)
│   ├── workers/        # build loop, Docker runner, S3 upload, process cleanup
│   └── shared/         # config, SQLite db + schema, models
├── tests/              # node:test suites + sandbox helper
├── infra/              # Terraform (main stack + bootstrap), user_data, deploy script
└── .github/workflows/  # ci.yml, infra-ci.yml, cd.yml
```
