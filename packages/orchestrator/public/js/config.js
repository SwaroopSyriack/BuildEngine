/* ============================================================
   config.js — ONE place to point the app at the backend.
   ------------------------------------------------------------
   Base URL / token can also be changed at runtime from the
   "API Settings" gear icon in the top nav (persists in localStorage).
   ============================================================ */

// The orchestrator (packages/orchestrator/main.js) serves this folder itself,
// so when the page is loaded over http(s) the API lives on the same origin.
// Opened some other way (file://), fall back to the orchestrator's default port.
const SAME_ORIGIN = /^https?:$/.test(location.protocol) ? location.origin : "http://localhost:3000";

const DEFAULTS = {
  baseUrl: SAME_ORIGIN,

  // Filled in automatically from the `token` returned by /auth/login and
  // /auth/signup, and sent as `Authorization: Bearer <token>`. The server also
  // sets an httpOnly `session` cookie; the header is what keeps auth working
  // when the page is served from a different origin (e.g. Live Server :5500).
  token: "",

  // Fallback URL for a ready deployment. The worker normally stores the site URL
  // in the deployment's `storage_path` (packages/workers/build.js) and that is used
  // first; this template only applies when storage_path isn't an http(s) URL.
  siteUrlTemplate: "http://{deploymentId}.s3-website-ap-southeast-2.amazonaws.com",

  // A deployment still "building" after this many minutes is flagged as stalled.
  // The worker allows up to 2 min to clone + 5 min for the container (shared/config.js).
  staleBuildMinutes: 10,
};

/* ------------------------------------------------------------
   Endpoint map — checked against packages/orchestrator/main.js
   and routes/*.js. `:id` placeholders are substituted at call time.
   ------------------------------------------------------------ */
const ENDPOINTS = {
  // ---- health ----
  health:           { method: "GET",    path: "/health" },

  // ---- auth (routes/auth.js) ----
  login:            { method: "POST",   path: "/auth/login" },   // body { email, passwd }
  signup:           { method: "POST",   path: "/auth/signup" },  // body { name, email, passwd }
  me:               { method: "GET",    path: "/auth/me" },
  logout:           { method: "POST",   path: "/auth/logout" },

  // ---- projects (routes/project.js, requires auth) ----
  listProjects:     { method: "GET",    path: "/projects" },
  createProject:    { method: "POST",   path: "/projects" },     // body { user_id, name, repo_url, build_command?, build_image?, output_dir?, spa_fallback? }
  getProject:       { method: "GET",    path: "/projects/:id" },
  deleteProject:    { method: "DELETE", path: "/projects/:id" },
  listDeployments:  { method: "GET",    path: "/projects/:id/deployments" },

  // ---- deployments ----
  // Inserts a 'pending' row; packages/workers/main.js must be running to build it.
  createDeployment: { method: "POST",   path: "/deploy/:id" },   // main.js
  getDeployment:    { method: "GET",    path: "/deployments/:id" },
  getLogs:          { method: "GET",    path: "/deployments/:id/logs" }, // ?format=json → [{ ts, stream, chunk }], optional ?stream=stdout|stderr|system

  // ---- users (routes/user.js) ----
  listUserProjects: { method: "GET",    path: "/users/:id/projects" },
};

/* Features the UI has screens for but the backend has no route for yet.
   Pages show a "not available yet" state for these instead of calling them. */
const MISSING_ROUTES = {
  updateProject: "PATCH  /projects/:id",
  rollback:      "POST   /deployments/:id/rollback",
  domains:       "GET|POST /projects/:id/domains, DELETE /domains/:id",
  env:           "GET|PUT /projects/:id/env",
  analytics:     "GET    /projects/:id/analytics",
};

const STORAGE_KEY = "neondeploy.config";

const Config = {
  ENDPOINTS,
  MISSING_ROUTES,
  DEFAULTS,

  /** Current effective settings (defaults merged with anything saved locally). */
  get() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) {}
    return { ...DEFAULTS, ...saved };
  },

  /** Persist a partial update, e.g. Config.set({ token: "" }). */
  set(patch) {
    const next = { ...this.get(), ...patch };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  },

  reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  },

  /** Build an absolute URL for an endpoint path + params. */
  url(path, params = {}) {
    const { baseUrl } = this.get();
    let p = path;
    Object.entries(params).forEach(([k, v]) => { p = p.replace(`:${k}`, encodeURIComponent(v)); });
    return `${(baseUrl || "").replace(/\/$/, "")}${p}`;
  },

  /** Public URL of a deployment's uploaded site. */
  siteUrl(deploymentId) {
    const t = this.get().siteUrlTemplate;
    return t && deploymentId ? t.replace("{deploymentId}", deploymentId) : "";
  },
};

window.Config = Config;
