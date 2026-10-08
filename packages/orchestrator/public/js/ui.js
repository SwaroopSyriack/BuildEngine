/* ============================================================
   ui.js — shared chrome: nav, toasts, modals, formatters,
   and the API Settings panel (gear icon in the top nav).
   ============================================================ */

const UI = {
  /* ---------------- formatters ---------------- */
  timeAgo(iso) {
    if (!iso) return "—";
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  },

  statusLabel(s) {
    return ({ ready: "Ready", building: "Building", failed: "Failed", queued: "Queued", canceled: "Canceled", none: "Not deployed" })[s] || s;
  },

  statusTextClass(s) {
    return s === "failed" ? "text-error" : s === "canceled" || s === "none" ? "text-secondary" : "text-primary";
  },

  escape(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  /* ---------------- toasts ---------------- */
  toast(message, type = "info") {
    let stack = document.getElementById("toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "error" : ""}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 300);
    }, 3600);
  },

  /* ---------------- modal ---------------- */
  modal(html, { onMount } = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal-panel">${html}</div>`;
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";

    const close = () => {
      backdrop.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };

    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    document.addEventListener("keydown", onKey);

    if (onMount) onMount(backdrop, close);
    return close;
  },

  confirm(message, { title = "Are you sure?", confirmLabel = "Confirm", danger = true } = {}) {
    return new Promise((resolve) => {
      this.modal(
        `<div class="p-6">
           <h3 class="font-headline-md text-headline-md text-primary mb-2">${this.escape(title)}</h3>
           <p class="text-secondary font-body-md text-body-md mb-6">${this.escape(message)}</p>
           <div class="flex justify-end gap-3">
             <button class="btn-secondary" data-close>Cancel</button>
             <button class="${danger ? "btn-danger" : "btn-primary"}" data-confirm>${this.escape(confirmLabel)}</button>
           </div>
         </div>`,
        {
          onMount(root, close) {
            root.querySelector("[data-confirm]").addEventListener("click", () => { close(); resolve(true); });
            root.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => resolve(false)));
            root.addEventListener("click", (e) => { if (e.target === root) resolve(false); });
          },
        }
      );
    });
  },

  /* ---------------- top navigation ---------------- */
  /** Renders the shared nav into #app-nav. `active` = projects | activity | docs */
  mountNav(active = "projects") {
    const host = document.getElementById("app-nav");
    if (!host) return;
    const user = Api.user();
    const item = (key, label, href) =>
      `<a href="${href}" class="${
        active === key
          ? "text-primary border-b-2 border-primary-container pb-1"
          : "text-secondary hover:text-primary transition-colors duration-200"
      } font-body-md text-body-md cursor-pointer">${label}</a>`;

    host.innerHTML = `
      <nav class="bg-surface w-full top-0 sticky z-50 border-b border-outline-variant">
        <div class="flex justify-between items-center h-16 px-gutter max-w-container-max mx-auto">
          <div class="flex items-center gap-8">
            <a href="projects.html" class="font-headline-md text-headline-md font-bold text-primary tracking-tighter">NeonDeploy</a>
            <div class="hidden md:flex gap-6 items-center">
              ${item("projects", "Projects", "projects.html")}
              ${item("activity", "Activity", "activity.html")}
              ${item("docs", "Docs", "docs.html")}
            </div>
          </div>
          <div class="flex items-center gap-4">
            <button id="nav-settings" title="API Settings"
              class="material-symbols-outlined text-secondary hover:text-primary transition-colors cursor-pointer">settings</button>
            <div class="relative">
              <button id="nav-avatar" class="w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-outline-variant block">
                <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user?.email || "neondeploy")}&backgroundColor=131313"
                     alt="Profile" class="w-full h-full object-cover"/>
              </button>
              <div id="nav-menu" class="hidden absolute right-0 mt-2 w-56 bg-panel border border-hairline rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-hairline">
                  <div class="text-primary text-sm truncate">${this.escape(user?.name || "Guest")}</div>
                  <div class="text-secondary font-code-md text-[11px] truncate">${this.escape(user?.email || "not signed in")}</div>
                </div>
                <a href="projects.html" class="block px-4 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-container">Projects</a>
                <button id="nav-settings-2" class="w-full text-left px-4 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-container">API Settings</button>
                <button id="nav-logout" class="w-full text-left px-4 py-2 text-sm text-error hover:bg-surface-container">Sign out</button>
              </div>
            </div>
          </div>
        </div>
      </nav>`;

    host.querySelector("#nav-settings").addEventListener("click", () => this.settingsModal());
    host.querySelector("#nav-settings-2").addEventListener("click", () => this.settingsModal());

    const menu = host.querySelector("#nav-menu");
    host.querySelector("#nav-avatar").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });
    document.addEventListener("click", () => menu.classList.add("hidden"));

    host.querySelector("#nav-logout").addEventListener("click", async () => {
      await Api.logout();
      location.href = "login.html";
    });
  },

  /** Confirms the session with GET /auth/me; sends the user to login if it's gone. */
  async requireSession() {
    try {
      return await Api.me();
    } catch (e) {
      if (e.status === 401 || e.status === 500) Api.handleUnauthorized();
      throw e;
    }
  },

  /* ---------------- API settings panel ---------------- */
  settingsModal() {
    const c = Config.get();
    const html = `
      <div class="p-6">
        <div class="flex items-start justify-between mb-1">
          <h3 class="font-headline-md text-headline-md text-primary">API Settings</h3>
          <button data-close class="material-symbols-outlined text-secondary hover:text-primary">close</button>
        </div>
        <p class="text-secondary font-code-md text-code-md mb-6">Where the buildEngine orchestrator is running. Defaults to this page's own origin.</p>

        <div class="space-y-4">
          <div>
            <label class="field-label">API base URL</label>
            <input id="cfg-url" class="field" placeholder="http://localhost:3000" value="${this.escape(c.baseUrl)}"/>
            <p class="text-secondary font-code-md text-[11px] mt-1.5">Endpoints are appended to this, e.g. <span class="text-on-surface-variant">/projects</span>.</p>
          </div>
          <div>
            <label class="field-label">Bearer token <span class="text-[10px] opacity-60">(set automatically on sign in)</span></label>
            <input id="cfg-token" class="field" type="password" placeholder="eyJhbGciOi…" value="${this.escape(c.token)}"/>
          </div>
          <div>
            <label class="field-label">Site URL template</label>
            <input id="cfg-site" class="field" placeholder="http://{deploymentId}.s3-website-REGION.amazonaws.com" value="${this.escape(c.siteUrlTemplate)}"/>
          </div>
        </div>

        <div class="mt-5 p-4 rounded-lg border border-hairline bg-ink">
          <div class="font-code-md text-[11px] text-secondary mb-2">EXPECTED ROUTES</div>
          <div class="font-code-md text-[11px] text-on-surface-variant grid grid-cols-1 gap-1 max-h-32 overflow-auto">
            ${Object.entries(Config.ENDPOINTS)
              .map(([k, e]) => `<div><span class="text-neon">${e.method}</span> ${this.escape(e.path)}</div>`)
              .join("")}
          </div>
        </div>

        <div id="cfg-ping" class="mt-4 font-code-md text-code-md"></div>

        <div class="flex flex-wrap justify-between gap-3 mt-6">
          <button id="cfg-test" class="btn-secondary">Test connection</button>
          <div class="flex gap-3">
            <button data-close class="btn-secondary">Cancel</button>
            <button id="cfg-save" class="btn-primary">Save</button>
          </div>
        </div>
      </div>`;

    this.modal(html, {
      onMount: (root, close) => {
        const urlEl = root.querySelector("#cfg-url");
        const tokEl = root.querySelector("#cfg-token");
        const siteEl = root.querySelector("#cfg-site");
        const pingEl = root.querySelector("#cfg-ping");

        root.querySelector("#cfg-test").addEventListener("click", async () => {
          const base = urlEl.value.trim();
          if (!base) { pingEl.innerHTML = `<span class="text-error">Enter a base URL first.</span>`; return; }
          pingEl.innerHTML = `<span class="text-secondary">Contacting ${UI.escape(base)}…</span>`;
          try {
            const r = await Api.ping(base);
            pingEl.innerHTML = r.ok
              ? `<span class="log-ok">✓ Reachable — HTTP ${r.status} in ${r.ms}ms</span>`
              : `<span class="text-error">✗ Responded with HTTP ${r.status}</span>`;
          } catch (e) {
            pingEl.innerHTML = `<span class="text-error">✗ ${UI.escape(e.message)} (likely CORS or a wrong URL)</span>`;
          }
        });

        root.querySelector("#cfg-save").addEventListener("click", () => {
          Config.set({
            baseUrl: urlEl.value.trim(),
            token: tokEl.value.trim(),
            siteUrlTemplate: siteEl.value.trim(),
          });
          UI.toast("Settings saved — reloading");
          close();
          setTimeout(() => location.reload(), 400);
        });
      },
    });
  },

  /* ---------------- misc helpers ---------------- */
  qs(name) {
    return new URLSearchParams(location.search).get(name);
  },

  skeletonCards(n = 6) {
    return Array.from({ length: n })
      .map(() => `<div class="card overflow-hidden"><div class="h-32 skeleton"></div><div class="p-5 space-y-3"><div class="h-5 w-1/2 skeleton"></div><div class="h-3 w-2/3 skeleton"></div><div class="h-3 w-1/3 skeleton"></div></div></div>`)
      .join("");
  },

  errorState(message, retryFn) {
    const id = "err_" + Math.random().toString(36).slice(2, 7);
    setTimeout(() => {
      const btn = document.getElementById(id);
      if (btn && retryFn) btn.addEventListener("click", retryFn);
    });
    return `<div class="col-span-full card p-10 text-center">
        <span class="material-symbols-outlined text-error" style="font-size:40px">cloud_off</span>
        <h3 class="font-headline-md text-headline-md text-primary mt-3 mb-2">Couldn't load data</h3>
        <p class="text-secondary font-code-md text-code-md max-w-md mx-auto mb-6">${this.escape(message)}</p>
        <div class="flex justify-center gap-3">
          <button id="${id}" class="btn-secondary">Retry</button>
          <button class="btn-primary" onclick="UI.settingsModal()">Open API Settings</button>
        </div>
      </div>`;
  },

  /** Placeholder for screens whose backend route doesn't exist yet. */
  notAvailable(title, route) {
    return `<div class="col-span-full card p-12 text-center">
        <span class="material-symbols-outlined text-secondary" style="font-size:40px">construction</span>
        <h3 class="font-headline-md text-headline-md text-primary mt-3 mb-2">${this.escape(title)} isn't available yet</h3>
        <p class="text-secondary font-code-md text-code-md max-w-md mx-auto">The backend doesn't expose this route yet:</p>
        <p class="font-code-md text-code-md text-on-surface-variant mt-2">${this.escape(route)}</p>
      </div>`;
  },

  emptyState(title, message, actionHtml = "") {
    return `<div class="col-span-full card p-12 text-center">
        <span class="material-symbols-outlined text-secondary" style="font-size:40px">inbox</span>
        <h3 class="font-headline-md text-headline-md text-primary mt-3 mb-2">${this.escape(title)}</h3>
        <p class="text-secondary font-code-md text-code-md max-w-md mx-auto mb-6">${this.escape(message)}</p>
        ${actionHtml}
      </div>`;
  },
};

window.UI = UI;
