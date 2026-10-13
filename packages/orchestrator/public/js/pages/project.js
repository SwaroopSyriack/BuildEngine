/* ============================================================
   pages/project.js — single project workspace.
   Tabs: overview | deployments | domains | env | analytics | settings
   ============================================================ */

(function () {
  const id = UI.qs("id");
  const body = document.getElementById("tab-body");
  const mobileTabs = document.getElementById("mobile-tabs");

  const TABS = [
    ["overview", "Overview"],
    ["deployments", "Deployments"],
    ["domains", "Domains"],
    ["env", "Environment"],
    ["analytics", "Analytics"],
    ["settings", "Settings"],
  ];

  let project = null;
  let tab = location.hash.replace("#", "") || "overview";
  let poll;

  UI.mountNav("projects");

  if (!id) {
    body.innerHTML = UI.errorState("No project id in the URL. Open a project from the dashboard.", () => (location.href = "projects.html"));
    return;
  }

  const isBusy = (s) => s === "building" || s === "queued";
  const repoLabel = (repo) => (repo || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\.git$/, "");

  /* ================= header / rail ================= */

  function paintChrome() {
    const p = project;
    document.title = `NeonDeploy — ${p.name}`;
    document.getElementById("rail-name").textContent = p.name;
    document.getElementById("rail-branch").textContent = repoLabel(p.repo);
    document.getElementById("hdr-name").textContent = p.name;
    document.getElementById("hdr-status").textContent = UI.statusLabel(p.status);
    document.getElementById("hdr-status").className = UI.statusTextClass(p.status);
    document.getElementById("hdr-pip").className = `status-pip status-${p.status}`;

    const urlEl = document.getElementById("hdr-url");
    const visit = document.getElementById("hdr-visit");
    if (p.url) {
      urlEl.href = p.url;
      urlEl.innerHTML = `${UI.escape(p.url.replace(/^https?:\/\//, ""))} <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span>`;
      visit.href = p.url;
      visit.classList.remove("hidden");
    } else {
      urlEl.removeAttribute("href");
      urlEl.textContent = "No live deployment yet";
      visit.classList.add("hidden");
    }
  }

  function paintTabs() {
    document.querySelectorAll(".rail-item").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.className = `rail-item w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
        on ? "text-primary bg-secondary-container" : "text-secondary hover:text-primary hover:bg-surface-container-high"
      }`;
    });
    mobileTabs.innerHTML = TABS.map(
      ([k, label]) =>
        `<button data-tab="${k}" class="whitespace-nowrap pb-3 px-1 ${
          k === tab ? "text-primary border-b-2 border-primary-container" : "text-secondary hover:text-primary"
        }">${label}</button>`
    ).join("");
    mobileTabs.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  }

  function go(next) {
    tab = next;
    history.replaceState(null, "", `#${next}`);
    paintTabs();
    renderTab();
  }

  document.querySelectorAll(".rail-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  window.addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (h && h !== tab) go(h); });

  /* ================= shared bits ================= */

  const statusRow = (label, value, extraClass = "text-primary") =>
    `<div class="min-w-0"><span class="font-label-sm text-label-sm text-secondary block mb-1">${label}</span>
       <span class="font-code-md text-code-md ${extraClass} block truncate">${value}</span></div>`;

  function depBadge(status) {
    return `<span class="inline-flex items-center gap-2 font-code-md text-[11px] ${UI.statusTextClass(status)}">
        <span class="status-pip status-${status}"></span>${UI.statusLabel(status)}</span>`;
  }

  /* ================= tab: overview ================= */

  function renderOverview() {
    const p = project;
    const d = p.latest;
    const busy = isBusy(p.status);
    body.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Preview -->
        <div class="lg:col-span-8 bg-panel rounded-xl neon-border overflow-hidden flex flex-col h-[420px]">
          <div class="p-4 border-b border-hairline flex justify-between items-center bg-ink">
            <span class="font-label-sm text-label-sm text-secondary">Live Deployment Preview</span>
            <span class="font-code-md text-code-md text-secondary">${UI.escape(p.live ? p.live.id : "")}</span>
          </div>
          <div class="flex-1 relative bg-ink overflow-hidden">
            <div class="absolute inset-0 grid-bg opacity-20"></div>
            <iframe id="prev-frame" class="w-full h-full relative z-10 bg-white" title="Deployment preview" referrerpolicy="no-referrer"></iframe>
            <div id="prev-fallback" class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center px-6">
              <span class="material-symbols-outlined ${p.stale ? "text-error" : "text-secondary"}" style="font-size:44px">${p.stale ? "warning" : busy ? "sync" : p.status === "failed" ? "error" : p.url ? "captive_portal" : "rocket_launch"}</span>
              <div>
                <p class="text-primary mb-1">${p.stale ? "Build looks stalled" : busy ? "Build in progress" : p.status === "failed" ? "Last build failed" : p.url ? "Live preview" : "Not deployed yet"}</p>
                <p class="text-secondary font-code-md text-[12px] max-w-sm">${
                  p.stale ? `This build has been running since ${UI.timeAgo(d.startedAt || d.createdAt)} without finishing. The worker may have crashed or hung — check its logs, then redeploy.`
                  : busy ? "The preview appears once a deployment is ready. The worker (packages/workers) must be running to pick it up."
                  : p.status === "failed" ? UI.escape(d?.errorMessage || "Check the deployment details in the Deployments tab.")
                  : p.url ? UI.escape(p.url)
                  : "Hit “Deploy Now” to queue the first build."
                }</p>
              </div>
              ${p.url ? `<a href="${UI.escape(p.url)}" target="_blank" rel="noopener" class="btn-secondary">Open in new tab</a>` : ""}
            </div>
          </div>
        </div>

        <!-- Side column -->
        <div class="lg:col-span-4 flex flex-col gap-6">
          <div class="bg-panel rounded-xl neon-border p-5 flex flex-col gap-4">
            <div>
              <span class="font-label-sm text-label-sm text-secondary block mb-1">Status</span>
              <div class="flex items-center gap-2">
                <span class="status-pip status-${p.status}"></span>
                <span class="font-headline-md ${UI.statusTextClass(p.status)}" style="font-size:18px">${UI.statusLabel(p.status)}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-hairline">
              ${statusRow("Latest deploy", UI.escape(d ? d.id : "—"))}
              ${statusRow("Commit", UI.escape(d?.commitSha || "—"))}
            </div>
            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-hairline">
              ${statusRow("Build time", UI.escape(d?.duration || "—"))}
              ${statusRow("Output dir", UI.escape(p.outputDir || "auto"))}
            </div>
            <div class="pt-4 border-t border-hairline space-y-4">
              ${statusRow("Build command", UI.escape(p.buildCommand || "default"), "text-secondary")}
              ${statusRow("Build image", UI.escape(p.buildImage || "default"), "text-secondary")}
              ${statusRow("Repository", UI.escape(p.repo || "—"), "text-secondary")}
            </div>
          </div>
        </div>

        <!-- Recent deployments -->
        <div class="lg:col-span-12 bg-panel rounded-xl neon-border overflow-hidden">
          <div class="p-4 border-b border-hairline flex items-center justify-between bg-ink">
            <span class="font-label-sm text-label-sm text-secondary">Recent Deployments</span>
            <button class="font-code-md text-[12px] text-secondary hover:text-primary-container" onclick="location.hash='deployments'">View all →</button>
          </div>
          <div id="ov-deps" class="divide-y divide-hairline"></div>
        </div>
      </div>`;

    const frame = document.getElementById("prev-frame");
    const fallback = document.getElementById("prev-fallback");
    if (p.url && !busy) {
      frame.src = p.url;
      frame.addEventListener("load", () => fallback.classList.add("hidden"));
    } else {
      frame.classList.add("hidden");
    }

    const host = document.getElementById("ov-deps");
    const items = p.deployments.slice(0, 4);
    host.innerHTML = items.length
      ? items.map(depRow).join("")
      : `<div class="p-6 text-center text-secondary font-code-md text-code-md">No deployments yet.</div>`;
    wireDepRows(host);
  }

  /* ================= tab: deployments ================= */

  function depRow(d) {
    const current = project.live && project.live.id === d.id;
    const when = d.finishedAt || d.startedAt || d.createdAt;
    return `
      <div class="p-4 flex flex-wrap items-center gap-4 hover:bg-surface-container/40 transition-colors">
        <div class="w-28 flex-none">${depBadge(d.status)}</div>
        <div class="min-w-0 flex-1">
          <div class="text-primary truncate">${UI.escape(d.id)}
            ${current ? `<span class="ml-2 font-code-md text-[10px] text-primary-container">LIVE</span>` : ""}</div>
          <div class="font-code-md text-[11px] ${d.status === "failed" || d.stale ? "text-error" : "text-secondary"} truncate">
            ${UI.escape(
              d.status === "failed" && d.errorMessage ? d.errorMessage
              : d.stale ? `Stalled — no update since ${UI.timeAgo(d.startedAt || d.createdAt)}; check the worker logs`
              : [d.commitSha, d.buildImage].filter(Boolean).join(" • ") || "—"
            )}
          </div>
        </div>
        <div class="font-code-md text-[11px] text-secondary w-16 text-right">${UI.escape(d.duration || "")}</div>
        <div class="font-code-md text-[11px] text-secondary w-24 text-right">${UI.timeAgo(when)}</div>
        <div class="flex gap-2">
          <button class="btn-secondary !py-1 !px-3 text-[12px]" data-details="${UI.escape(d.id)}">Details</button>
          ${d.url ? `<a class="btn-secondary !py-1 !px-3 text-[12px]" href="${UI.escape(d.url)}" target="_blank" rel="noopener">Visit</a>` : ""}
        </div>
      </div>`;
  }

  function wireDepRows(scope) {
    scope.querySelectorAll("[data-details]").forEach((b) =>
      b.addEventListener("click", () => detailsModal(b.dataset.details))
    );
  }

  function detailsModal(depId) {
    UI.modal(
      `<div class="p-6">
         <div class="flex items-start justify-between mb-4">
           <div>
             <h3 class="font-headline-md text-headline-md text-primary">Deployment</h3>
             <span class="font-code-md text-[11px] text-secondary">${UI.escape(depId)}</span>
           </div>
           <button data-close class="material-symbols-outlined text-secondary hover:text-primary">close</button>
         </div>
         <div class="terminal max-h-48 overflow-auto" id="dep-out">Loading…</div>

         <div class="flex flex-wrap items-center justify-between gap-3 mt-5 mb-2">
           <div class="flex items-center gap-2">
             <span class="font-label-sm text-label-sm text-secondary">Build Logs</span>
             <span id="log-live" class="hidden items-center gap-1 font-code-md text-[10px] text-primary-container">
               <span class="status-pip status-building"></span>LIVE
             </span>
           </div>
           <select id="log-stream" class="field !w-auto !py-1 text-[12px]">
             <option value="">All streams</option>
             <option value="stdout">stdout</option>
             <option value="stderr">stderr</option>
             <option value="system">system</option>
           </select>
         </div>
         <div class="terminal h-80" id="log-out">Loading…</div>

         <div class="flex justify-end gap-3 mt-5">
           <button class="btn-secondary" id="log-copy">Copy logs</button>
           <button class="btn-primary" data-close>Close</button>
         </div>
       </div>`,
      {
        onMount: async (root) => {
          const out = root.querySelector("#dep-out");
          const logOut = root.querySelector("#log-out");
          const live = root.querySelector("#log-live");
          const streamEl = root.querySelector("#log-stream");
          const STREAM_CLASS = { system: "log-ok", stderr: "log-error", stdout: "log-info" };
          let lines = [];
          let logTimer;

          const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour12: false }) : "");

          async function loadLogs() {
            clearTimeout(logTimer);
            if (!root.isConnected) return; // modal closed
            const atBottom = logOut.scrollHeight - logOut.scrollTop - logOut.clientHeight < 40;
            try {
              const [rows, d] = await Promise.all([Api.getLogs(depId, streamEl.value), Api.getDeployment(depId)]);
              if (!root.isConnected) return;
              // A chunk can hold several lines; give each its own row with the chunk's time.
              lines = rows.flatMap((r) =>
                r.chunk.replace(/\n$/, "").split("\n").map((text) => ({ time: clock(r.ts), stream: r.stream, text }))
              );
              logOut.innerHTML = lines.length
                ? lines
                    .map((l) => `<div><span class="log-time">${UI.escape(l.time)}</span><span class="${STREAM_CLASS[l.stream] || "log-info"}">${UI.escape(l.text)}</span></div>`)
                    .join("")
                : `<span class="log-time">${isBusy(d.status) ? "Waiting for the worker to write logs…" : "No logs for this deployment."}</span>`;
              if (atBottom) logOut.scrollTop = logOut.scrollHeight;

              // Keep following the build while it's running.
              const running = isBusy(d.status) && !d.stale;
              live.classList.toggle("hidden", !running);
              live.classList.toggle("inline-flex", running);
              if (running) logTimer = setTimeout(loadLogs, 2500);
            } catch (e) {
              logOut.innerHTML = `<span class="log-error">${UI.escape(e.message)}</span>`;
            }
          }

          streamEl.addEventListener("change", () => { logOut.scrollTop = 0; loadLogs().then(() => (logOut.scrollTop = logOut.scrollHeight)); });
          root.querySelector("#log-copy").addEventListener("click", () => {
            navigator.clipboard?.writeText(lines.map((l) => `${l.time} [${l.stream}] ${l.text}`).join("\n"));
            UI.toast("Logs copied to clipboard");
          });
          loadLogs().then(() => (logOut.scrollTop = logOut.scrollHeight));

          try {
            const d = await Api.getDeployment(depId);
            const rows = [
              ["status", UI.statusLabel(d.status), d.status === "failed" ? "log-error" : "log-ok"],
              ["repo", d.repoUrl],
              ["build command", d.buildCommand],
              ["build image", d.buildImage],
              ["commit", d.commitSha],
              ["worker", d.claimedBy],
              ["created", d.createdAt && new Date(d.createdAt).toLocaleString()],
              ["started", d.startedAt && new Date(d.startedAt).toLocaleString()],
              ["finished", d.finishedAt && new Date(d.finishedAt).toLocaleString()],
              ["duration", d.duration],
              ["output dir", d.outputDir],
              ["storage", d.storagePath],
              ["error", d.errorMessage, "log-error"],
            ].filter(([, v]) => v);
            out.innerHTML = rows
              .map(([k, v, cls]) => `<div><span class="log-time">${UI.escape(k.padEnd(14))}</span><span class="${cls || "log-info"}">${UI.escape(v)}</span></div>`)
              .join("");
          } catch (e) {
            out.innerHTML = `<span class="log-error">${UI.escape(e.message)}</span>`;
          }
        },
      }
    );
  }

  function renderDeployments() {
    const items = project.deployments;
    body.innerHTML = `
      <div class="bg-panel rounded-xl neon-border overflow-hidden">
        <div class="p-4 border-b border-hairline flex items-center justify-between bg-ink">
          <span class="font-label-sm text-label-sm text-secondary">All Deployments</span>
          <button class="btn-primary !py-1.5 !px-4 text-[13px]" id="dep-new">New Deployment</button>
        </div>
        <div id="dep-list" class="divide-y divide-hairline">${
          items.length
            ? items.map(depRow).join("")
            : `<div class="p-10 text-center text-secondary font-code-md text-code-md">No deployments yet — hit “New Deployment”.</div>`
        }</div>
      </div>`;
    document.getElementById("dep-new").addEventListener("click", triggerDeploy);
    wireDepRows(document.getElementById("dep-list"));
  }

  /* ================= tabs without backend routes ================= */

  function renderDomains() {
    body.innerHTML = UI.notAvailable("Custom domains", Config.MISSING_ROUTES.domains);
  }

  function renderEnv() {
    body.innerHTML = UI.notAvailable("Environment variables", Config.MISSING_ROUTES.env);
  }

  function renderAnalytics() {
    body.innerHTML = UI.notAvailable("Analytics", Config.MISSING_ROUTES.analytics);
  }

  /* ================= tab: settings ================= */

  function renderSettings() {
    const p = project;
    const ro = (label, value) =>
      `<div><label class="field-label">${label}</label><input class="field opacity-70" value="${UI.escape(value || "")}" placeholder="default" disabled/></div>`;
    body.innerHTML = `
      <div class="space-y-6 max-w-3xl">
        <div class="bg-panel rounded-xl neon-border p-6">
          <h3 class="font-headline-md text-headline-md text-primary mb-1">General</h3>
          <p class="text-secondary font-code-md text-[12px] mb-6">Build configuration for this project. Editing isn't available yet — the backend has no <span class="text-on-surface-variant">${UI.escape(Config.MISSING_ROUTES.updateProject.replace(/\s+/g, " "))}</span> route.</p>
          <div class="space-y-4">
            ${ro("Project name", p.name)}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${ro("Repository", p.repo)}
              ${ro("Build image", p.buildImage)}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${ro("Build command", p.buildCommand)}
              ${ro("Output directory", p.outputDir)}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${ro("SPA fallback", p.spaFallback ? "enabled" : "disabled")}
              ${ro("Project id", p.id)}
            </div>
          </div>
        </div>

        <div class="bg-panel rounded-xl border border-error-container p-6">
          <h3 class="font-headline-md text-headline-md text-error mb-1">Danger Zone</h3>
          <p class="text-secondary font-code-md text-[12px] mb-5">Deleting a project removes it permanently. This cannot be undone.</p>
          <button class="btn-danger" id="set-delete">Delete this project</button>
        </div>
      </div>`;

    document.getElementById("set-delete").addEventListener("click", async () => {
      const ok = await UI.confirm(`"${p.name}" will be permanently removed.`, {
        title: "Delete project?",
        confirmLabel: "Delete forever",
      });
      if (!ok) return;
      try {
        await Api.deleteProject(id);
        UI.toast("Project deleted");
        setTimeout(() => (location.href = "projects.html"), 600);
      } catch (ex) {
        UI.toast(
          ex.status === 500 && p.deployments.length
            ? "Delete failed — the backend can't delete a project that still has deployments yet."
            : ex.message,
          "error"
        );
      }
    });
  }

  /* ================= actions ================= */

  async function triggerDeploy() {
    try {
      const res = await Api.deploy(id);
      UI.toast(`Deployment ${res.deploymentId} queued`);
      await refresh();
    } catch (e) {
      UI.toast(e.message, "error");
    }
  }

  document.getElementById("rail-deploy").addEventListener("click", triggerDeploy);
  document.getElementById("hdr-redeploy").addEventListener("click", triggerDeploy);

  /* ================= lifecycle ================= */

  function renderTab() {
    if (!project) return;
    ({
      overview: renderOverview,
      deployments: renderDeployments,
      domains: renderDomains,
      env: renderEnv,
      analytics: renderAnalytics,
      settings: renderSettings,
    }[tab] || renderOverview)();
  }

  async function refresh() {
    const prev = project;
    project = await Api.getProject(id);
    paintChrome();
    // Don't rebuild the settings form / iframe on background polls unless something changed.
    const changed = !prev || JSON.stringify(prev.deployments) !== JSON.stringify(project.deployments);
    if (changed || !["overview", "settings"].includes(tab)) renderTab();
    schedulePoll();
  }

  function schedulePoll() {
    clearTimeout(poll);
    if (!project) return;
    const busy = project.deployments.filter((d) => isBusy(d.status));
    if (busy.length) {
      // Keep checking stalled builds too (the worker may still finish), just less often.
      const delay = busy.every((d) => d.stale) ? 30000 : 4000;
      poll = setTimeout(() => refresh().catch(() => {}), delay);
    }
  }

  (async function init() {
    body.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8 h-[420px] skeleton rounded-xl"></div>
        <div class="lg:col-span-4 h-[420px] skeleton rounded-xl"></div>
      </div>`;
    paintTabs();
    try {
      await refresh();
    } catch (e) {
      if (e.status === 404) {
        body.innerHTML = UI.errorState("This project doesn't exist (or was deleted).", () => (location.href = "projects.html"));
      } else {
        body.innerHTML = UI.errorState(e.message, () => location.reload());
      }
    }
  })();
})();
