CREATE TABLE IF NOT EXISTS users (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY,
  user_id             INTEGER NOT NULL,
  name                TEXT NOT NULL UNIQUE,
  repo_url            TEXT NOT NULL,
  build_command       TEXT,
  build_image         TEXT,
  output_dir          TEXT,
  spa_fallback        INTEGER NOT NULL DEFAULT 1,
  live_deployment_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (live_deployment_id) REFERENCES deployments(id),
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS deployments (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL,
  repo_url       TEXT NOT NULL,
  build_command  TEXT NOT NULL,
  build_image    TEXT NOT NULL,
  commit_sha     TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','building','ready','failed')),
  claimed_by     TEXT,
  claimed_at     TEXT,
  started_at     TEXT,
  finished_at    TEXT,
  output_dir     TEXT,
  storage_path   TEXT,
  error_message  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status  ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created ON deployments(created_at);

CREATE TABLE IF NOT EXISTS build_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  deployment_id  TEXT NOT NULL,
  ts             TEXT NOT NULL DEFAULT (datetime('now')),
  stream         TEXT NOT NULL CHECK (stream IN ('stdout','stderr','system')),
  chunk          TEXT NOT NULL,
  FOREIGN KEY (deployment_id) REFERENCES deployments(id)
);
CREATE INDEX IF NOT EXISTS idx_build_logs_deployment ON build_logs(deployment_id);
