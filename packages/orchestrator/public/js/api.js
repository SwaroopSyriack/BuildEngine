/* ============================================================
   api.js — the single gateway every page uses to talk to the
   buildEngine orchestrator.
   ------------------------------------------------------------
   Low level:   Api.call("getProject", { params: { id } })
   High level:  Api.listProjects(), Api.getProject(id), Api.createProject(form), ...

   The backend wraps payloads as { message, result } and uses snake_case
   input / camelCase output (see packages/orchestrator/serialize.js).
   The helpers below unwrap that and turn backend rows into the shapes
   the pages render, so pages never deal with raw responses.
   ============================================================ */

const USER_KEY = "neondeploy.user";

// Calls that are allowed to come back 401 without bouncing to the login page.
const AUTH_KEYS = new Set(["login", "signup", "me", "logout", "health"]);

const Api = {
  async call(key, { params = {}, query = {}, body = null, signal } = {}) {
    const endpoint = Config.ENDPOINTS[key];
    if (!endpoint) throw new Error(`Unknown endpoint key: "${key}"`);

    const cfg = Config.get();
    if (!cfg.baseUrl) throw new Error("No API base URL configured. Open API Settings and add one.");

    let url = Config.url(endpoint.path, params);
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;

    const headers = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (cfg.token) headers["Authorization"] = `Bearer ${cfg.token}`;

    let res;
    try {
      res = await fetch(url, {
        method: endpoint.method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal,
      });
    } catch (netErr) {
      throw new Error(`Can't reach the API at ${cfg.baseUrl} — is the orchestrator running?`);
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

    if (!res.ok) {
      // `messsage` (sic) is what POST /auth/signup sends on a 400.
      const msg = (data && (data.message || data.messsage || data.error)) || `${res.status} ${res.statusText}`;
      if (res.status === 401 && !AUTH_KEYS.has(key)) Api.handleUnauthorized();
      const err = new Error(String(msg).trim());
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  },

  /* ---------------- session ---------------- */

  user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch (_) { return null; }
  },

  saveSession({ token, user }) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user || null)); } catch (_) {}
    if (token) Config.set({ token });
  },

  clearSession() {
    try { localStorage.removeItem(USER_KEY); } catch (_) {}
    Config.set({ token: "" });
  },

  handleUnauthorized() {
    Api.clearSession();
    if (!/login\.html$/.test(location.pathname)) {
      location.href = `login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search + location.hash)}`;
    }
  },

  async login(email, passwd) {
    const res = await Api.call("login", { body: { email, passwd } });
    Api.saveSession(res);
    return res.user;
  },

  async signup(name, email, passwd) {
    const res = await Api.call("signup", { body: { name, email, passwd } });
    Api.saveSession(res);
    return res.user;
  },

  async logout() {
    try { await Api.call("logout"); } catch (_) { /* cookie may already be gone */ }
    Api.clearSession();
  },

  /** Verifies the session with GET /auth/me and refreshes the cached user. */
  async me() {
    const res = await Api.call("me");
    try { localStorage.setItem(USER_KEY, JSON.stringify(res.user)); } catch (_) {}
    return res.user;
  },

  /* ---------------- normalizers ---------------- */

  /** SQLite datetime('now') is UTC without a zone ("2026-10-03 10:00:00"). */
  ts(v) {
    if (!v) return null;
    const s = String(v);
    return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z";
  },

  duration(startIso, endIso) {
    if (!startIso || !endIso) return "";
    const s = Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  },

  /** The worker writes the public site URL into storage_path once a build is ready. */
  siteUrl(d) {
    return /^https?:\/\//.test(d.storagePath || "") ? d.storagePath : Config.siteUrl(d.id);
  },

  isStale(sinceIso) {
    const mins = Number(Config.get().staleBuildMinutes) || 10;
    return !!sinceIso && Date.now() - new Date(sinceIso).getTime() > mins * 60_000;
  },

  toDeployment(d) {
    const createdAt = Api.ts(d.createdAt);
    const startedAt = Api.ts(d.startedAt);
    const finishedAt = Api.ts(d.finishedAt);
    // Backend statuses: pending | building | ready | failed
    const status = d.status === "pending" ? "queued" : d.status;
    return {
      id: d.id,
      projectId: d.projectId,
      status,
      repoUrl: d.repoUrl,
      buildCommand: d.buildCommand,
      buildImage: d.buildImage,
      commitSha: d.commitSha ? String(d.commitSha).slice(0, 7) : "",
      claimedBy: d.claimedBy,
      outputDir: d.outputDir,
      storagePath: d.storagePath,
      errorMessage: d.errorMessage,
      createdAt,
      startedAt,
      finishedAt,
      duration: Api.duration(startedAt, finishedAt),
      url: status === "ready" ? Api.siteUrl(d) : "",
      stale: status === "building" && Api.isStale(startedAt || createdAt),
    };
  },

  /** Project row + its deployments → what the dashboard / workspace render. */
  toProject(p, deployments = []) {
    const deps = deployments
      .map(Api.toDeployment)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latest = deps[0] || null;
    const live = deps.find((d) => d.status === "ready") || null;
    return {
      id: p.id,
      userId: p.user_id,
      name: p.name,
      repo: p.repoUrl,
      buildCommand: p.buildCommand,
      buildImage: p.buildImage,
      outputDir: p.outputDir,
      spaFallback: p.spaFallback,
      createdAt: Api.ts(p.createdAt),
      status: latest ? latest.status : "none",
      stale: !!(latest && latest.stale),
      updatedAt: latest ? latest.createdAt : Api.ts(p.createdAt),
      latest,
      live,
      url: live ? live.url : "",
      deployments: deps,
    };
  },

  /* ---------------- projects ---------------- */

  async listProjects() {
    const res = await Api.call("listProjects");
    const me = Api.user();
    let rows = res.result || [];
    // GET /projects returns every project in the DB; show only this user's.
    if (me && me.user_id != null) rows = rows.filter((p) => String(p.user_id) === String(me.user_id));
    return Promise.all(
      rows.map(async (p) => {
        let deps = [];
        try { deps = (await Api.call("listDeployments", { params: { id: p.id } })).result || []; } catch (_) {}
        return Api.toProject(p, deps);
      })
    );
  },

  async getProject(id) {
    const [proj, deps] = await Promise.all([
      Api.call("getProject", { params: { id } }),
      Api.call("listDeployments", { params: { id } }),
    ]);
    return Api.toProject(proj.result, deps.result || []);
  },

  async createProject({ name, repoUrl, buildCommand, buildImage, outputDir, spaFallback }) {
    let me = Api.user();
    if (!me || me.user_id == null) me = await Api.me();
    const res = await Api.call("createProject", {
      body: {
        user_id: me.user_id,
        name,
        repo_url: repoUrl,
        build_command: buildCommand || undefined,
        build_image: buildImage || undefined,
        output_dir: outputDir || undefined,
        spa_fallback: spaFallback,
      },
    });
    return Api.toProject(res.result, []);
  },

  async deleteProject(id) {
    return Api.call("deleteProject", { params: { id } });
  },

  /* ---------------- deployments ---------------- */

  /** Queues a new deployment → { deploymentId, status }. */
  async deploy(projectId) {
    return Api.call("createDeployment", { params: { id: projectId } });
  },

  async getDeployment(id) {
    const res = await Api.call("getDeployment", { params: { id } });
    return Api.toDeployment(res.result);
  },

  /* ---------------- activity (derived) ----------------
     There is no /activity route, so the feed is built from the
     user's projects and their deployment history. */
  async activity() {
    const projects = await Api.listProjects();
    const items = [];
    projects.forEach((p) => {
      items.push({ type: "project", text: `Project ${p.name} created`, meta: p.repo, at: p.createdAt, href: `project.html?id=${encodeURIComponent(p.id)}` });
      p.deployments.forEach((d) => {
        const verb = { queued: "queued", building: "building", ready: "deployed", failed: "failed" }[d.status] || d.status;
        items.push({
          type: d.status === "failed" ? "error" : d.status === "ready" ? "deploy" : "build",
          text: `${p.name} — deployment ${verb}`,
          meta: d.status === "failed" && d.errorMessage ? `${d.id} • ${d.errorMessage}` : d.id,
          at: d.finishedAt || d.startedAt || d.createdAt,
          href: `project.html?id=${encodeURIComponent(p.id)}#deployments`,
        });
      });
    });
    return items.sort((a, b) => new Date(b.at) - new Date(a.at));
  },

  /** Quick reachability probe used by the API Settings modal. */
  async ping(baseUrl) {
    const url = `${baseUrl.replace(/\/$/, "")}${Config.ENDPOINTS.health.path}`;
    const started = performance.now();
    const res = await fetch(url, { headers: { Accept: "application/json" }, credentials: "include" });
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - started) };
  },
};

window.Api = Api;
