# NeonDeploy — frontend for the buildEngine orchestrator

Pure HTML + Tailwind (CDN) + vanilla JS — no build step. Served by the orchestrator itself
(`express.static` on this folder in `packages/orchestrator/main.js`).

## Run it

```bash
node packages/orchestrator/main.js   # API + this UI on http://localhost:3000
node packages/workers/main.js        # builds queued deployments
```

Open http://localhost:3000.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Landing page |
| `login.html` | Sign in / sign up (`POST /auth/login`, `/auth/signup`) |
| `projects.html` | Your projects, status from latest deployment, create-project modal |
| `project.html` | Project workspace: Overview · Deployments (Details popup with live build logs) · Settings (+ placeholder tabs) |
| `activity.html` | Feed derived from your projects' deployment history |
| `docs.html` | Live list of routes used / routes still missing |

## Architecture

```
config.js  →  base URL, endpoint map, list of routes the backend doesn't have yet
api.js     →  fetch wrapper + helpers that unwrap { message, result } and normalise rows
ui.js      →  nav, session guard, toasts, modals, formatters, API Settings panel
pages/     →  one file per screen
```

## Backend routes used

```
POST   /auth/signup               { name, email, passwd } → { token, user }
POST   /auth/login                { email, passwd }       → { token, user }
POST   /auth/logout
GET    /auth/me                   → { user }
GET    /projects                  → { result: [Project] }
POST   /projects                  { user_id, name, repo_url, build_command?, build_image?, output_dir?, spa_fallback? }
GET    /projects/:id              → { result: Project }
DELETE /projects/:id
GET    /projects/:id/deployments  → { result: [Deployment] }
POST   /deploy/:id                → { deploymentId, status }
GET    /deployments/:id           → { result: Deployment }
GET    /deployments/:id/logs      ?format=json[&stream=stdout|stderr|system] → [{ ts, stream, chunk }]
GET    /health
```

## Not available yet (UI shows a placeholder)

```
PATCH  /projects/:id                 edit build settings
POST   /deployments/:id/rollback     rollback
GET|POST /projects/:id/domains, DELETE /domains/:id
GET|PUT  /projects/:id/env
GET    /projects/:id/analytics
```

When one of these is added to the backend, add it to `ENDPOINTS` in `js/config.js`,
remove it from `MISSING_ROUTES`, and replace the matching placeholder in `js/pages/project.js`.
