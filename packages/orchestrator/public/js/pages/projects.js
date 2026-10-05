/* ============================================================
   pages/projects.js — the project list / dashboard grid.
   ============================================================ */

(function () {
  const grid = document.getElementById("projects-grid");
  const strip = document.getElementById("stat-strip");
  const qEl = document.getElementById("filter-q");
  const statusEl = document.getElementById("filter-status");

  let view = localStorage.getItem("neondeploy.view") || "grid";
  let all = [];

  UI.mountNav("projects");

  /* ---------------- rendering ---------------- */

  const gradient = (seed) => {
    // Deterministic accent per project so cards feel distinct without images.
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `linear-gradient(135deg, hsl(${h} 45% 12%) 0%, #0D0D0D 60%), radial-gradient(circle at 30% 20%, rgba(239,255,0,.10), transparent 55%)`;
  };

  const repoLabel = (repo) => (repo || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\.git$/, "");
  const isBusy = (s) => s === "building" || s === "queued";
  const isActive = (p) => isBusy(p.status) && !p.stale;

  function statusChip(status) {
    return `<div class="absolute top-3 right-3 flex items-center gap-2 bg-ink/80 backdrop-blur px-2 py-1 rounded border border-hairline">
        <div class="status-pip status-${status}"></div>
        <span class="font-code-md text-[10px] ${UI.statusTextClass(status)} uppercase tracking-wider">${UI.statusLabel(status)}</span>
      </div>`;
  }

  function lastLine(p) {
    if (!p.latest) return { icon: "schedule", text: "No deployments yet", danger: false };
    if (p.status === "failed") return { icon: "error", text: p.latest.errorMessage || `${p.latest.id} failed`, danger: true };
    if (p.stale) return { icon: "warning", text: `Stalled — building since ${UI.timeAgo(p.latest.startedAt)}`, danger: true };
    return { icon: "commit", text: p.latest.commitSha ? `${p.latest.id} • ${p.latest.commitSha}` : p.latest.id, danger: false };
  }

  function cardHtml(p) {
    const busy = isActive(p);
    const line = lastLine(p);
    return `
      <a href="project.html?id=${encodeURIComponent(p.id)}"
         class="bg-panel border border-hairline rounded-xl overflow-hidden neon-border-hover transition-all duration-300 group flex flex-col h-full">
        <div class="h-32 relative border-b border-hairline overflow-hidden" style="background:${gradient(p.id)}">
          <div class="absolute inset-0 grid-bg opacity-[0.18] group-hover:opacity-30 transition-opacity"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="material-symbols-outlined text-secondary/60 group-hover:text-primary-container transition-colors" style="font-size:40px">rocket_launch</span>
          </div>
          ${statusChip(p.status)}
          <span class="absolute bottom-3 left-3 font-code-md text-[10px] text-secondary border border-hairline bg-ink/70 px-2 py-0.5 rounded">${UI.escape(p.buildImage || "default image")}</span>
        </div>

        <div class="p-5 flex-grow flex flex-col">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="font-headline-md text-headline-md text-primary truncate">${UI.escape(p.name)}</h3>
            <span class="material-symbols-outlined text-secondary group-hover:text-primary-container transition-colors" style="font-size:18px">arrow_outward</span>
          </div>
          <span class="font-code-md text-label-sm text-secondary truncate mb-4 block">${UI.escape(repoLabel(p.repo))}</span>

          <div class="mt-auto space-y-3">
            <div class="flex items-center gap-2 ${line.danger ? "text-error" : "text-secondary"} font-code-md text-[11px]">
              <span class="material-symbols-outlined" style="font-size:14px">${line.icon}</span>
              <span class="truncate">${UI.escape(line.text)}</span>
            </div>
            <div class="flex items-center justify-between text-secondary font-code-md text-[11px] pt-3 border-t border-hairline">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined ${busy ? "animate-spin" : ""}" style="font-size:14px">${busy ? "sync" : "schedule"}</span>
                ${busy ? "In progress" : UI.timeAgo(p.updatedAt)}
              </span>
              <span>${p.deployments.length} deploy${p.deployments.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
      </a>`;
  }

  function rowHtml(p) {
    const busy = isActive(p);
    return `
      <a href="project.html?id=${encodeURIComponent(p.id)}"
         class="col-span-full bg-panel border border-hairline rounded-lg px-5 py-4 flex items-center gap-4 neon-border-hover transition-all">
        <div class="status-pip status-${p.status}"></div>
        <span class="material-symbols-outlined text-secondary hidden sm:block" style="font-size:20px">rocket_launch</span>
        <div class="min-w-0 flex-1">
          <div class="text-primary truncate">${UI.escape(p.name)}</div>
          <div class="font-code-md text-[11px] text-secondary truncate">${UI.escape(repoLabel(p.repo))}</div>
        </div>
        <div class="hidden md:block font-code-md text-[11px] text-secondary truncate max-w-[220px]">${UI.escape(lastLine(p).text)}</div>
        <div class="font-code-md text-[11px] text-secondary w-24 text-right">${busy ? "In progress" : UI.timeAgo(p.updatedAt)}</div>
        <span class="material-symbols-outlined text-secondary" style="font-size:18px">chevron_right</span>
      </a>`;
  }

  function renderStats(items) {
    const count = (s) => items.filter((p) => p.status === s).length;
    const stats = [
      { label: "Total projects", value: items.length, icon: "folder" },
      { label: "Ready", value: count("ready"), icon: "check_circle" },
      { label: "Building", value: count("building") + count("queued"), icon: "sync" },
      { label: "Failed", value: count("failed"), icon: "error", danger: true },
    ];
    strip.innerHTML = stats
      .map(
        (s) => `<div class="card p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="font-code-md text-[11px] text-secondary uppercase tracking-wider">${s.label}</span>
            <span class="material-symbols-outlined ${s.danger && s.value ? "text-error" : "text-secondary"}" style="font-size:16px">${s.icon}</span>
          </div>
          <div class="font-headline-md text-headline-md ${s.danger && s.value ? "text-error" : "text-primary"}">${s.value}</div>
        </div>`
      )
      .join("");
  }

  // The backend has no ?q= / ?status= filters, so filtering happens here.
  function filtered() {
    const q = qEl.value.trim().toLowerCase();
    const st = statusEl.value;
    return all.filter((p) => {
      if (st && st !== "all" && p.status !== st) return false;
      if (q && !`${p.name} ${p.repo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function render() {
    const items = filtered();
    grid.className =
      view === "grid"
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        : "grid grid-cols-1 gap-3";

    if (!items.length) {
      grid.innerHTML = all.length
        ? UI.emptyState("No projects match", "Adjust the filters above.")
        : UI.emptyState(
            "No projects yet",
            "Create your first project to get started.",
            `<button class="btn-primary mx-auto" onclick="document.getElementById('btn-new').click()">Create New Project</button>`
          );
      return;
    }
    grid.innerHTML = items.map(view === "grid" ? cardHtml : rowHtml).join("");
  }

  /* ---------------- data ---------------- */

  async function load({ quiet = false } = {}) {
    if (!quiet) grid.innerHTML = UI.skeletonCards(6);
    try {
      all = await Api.listProjects();
      renderStats(all);
      render();
    } catch (e) {
      if (quiet) return;
      strip.innerHTML = "";
      grid.className = "grid grid-cols-1";
      grid.innerHTML = UI.errorState(e.message, () => load());
    }
  }

  /* ---------------- create project ---------------- */

  function newProjectModal() {
    UI.modal(
      `<div class="p-6">
        <div class="flex items-start justify-between mb-1">
          <h3 class="font-headline-md text-headline-md text-primary">Create New Project</h3>
          <button data-close class="material-symbols-outlined text-secondary hover:text-primary">close</button>
        </div>
        <p class="text-secondary font-code-md text-code-md mb-6">Connect a public Git repository — we'll build it and queue the first deployment.</p>

        <form id="np-form" class="space-y-4">
          <div>
            <label class="field-label">Project name</label>
            <input id="np-name" class="field" placeholder="marketing-site" required
                   pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" title="Lowercase letters, digits and hyphens (a valid subdomain label)"/>
            <p class="text-secondary font-code-md text-[11px] mt-1.5">Lowercase letters, digits and hyphens only.</p>
          </div>
          <div>
            <label class="field-label">Git repository URL</label>
            <input id="np-repo" class="field" placeholder="https://github.com/username/repository.git" required/>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="field-label">Build command</label>
              <input id="np-build" class="field" placeholder="npm install && npm run build"/>
            </div>
            <div>
              <label class="field-label">Output directory</label>
              <input id="np-out" class="field" placeholder="auto (dist / build / out)"/>
            </div>
          </div>
          <div>
            <label class="field-label">Build image</label>
            <input id="np-image" class="field" placeholder="node:20-bullseye"/>
          </div>
          <label class="flex items-center gap-3 text-secondary font-code-md text-[12px]">
            <input type="checkbox" id="np-spa" checked class="w-4 h-4 rounded border-hairline bg-ink text-neon focus:ring-0 focus:ring-offset-0"/>
            SPA fallback (serve index.html for unknown paths)
          </label>
          <div id="np-error" class="text-error font-code-md text-code-md hidden"></div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" data-close class="btn-secondary">Cancel</button>
            <button type="submit" id="np-submit" class="btn-primary">Deploy Project</button>
          </div>
        </form>
      </div>`,
      {
        onMount(root, close) {
          const nameEl = root.querySelector("#np-name");
          nameEl.focus();
          nameEl.addEventListener("input", () => {
            const pos = nameEl.selectionStart;
            nameEl.value = nameEl.value.toLowerCase().replace(/[\s_]+/g, "-");
            nameEl.setSelectionRange(pos, pos);
          });

          root.querySelector("#np-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = root.querySelector("#np-submit");
            const err = root.querySelector("#np-error");
            err.classList.add("hidden");
            btn.disabled = true;
            btn.textContent = "Creating…";
            let p;
            try {
              p = await Api.createProject({
                name: nameEl.value.trim(),
                repoUrl: root.querySelector("#np-repo").value.trim(),
                buildCommand: root.querySelector("#np-build").value.trim(),
                buildImage: root.querySelector("#np-image").value.trim(),
                outputDir: root.querySelector("#np-out").value.trim(),
                spaFallback: root.querySelector("#np-spa").checked,
              });
            } catch (ex) {
              err.textContent = ex.message;
              err.classList.remove("hidden");
              btn.disabled = false;
              btn.textContent = "Deploy Project";
              return;
            }
            close();
            try {
              await Api.deploy(p.id);
              UI.toast(`"${p.name}" created — deployment queued`);
            } catch (ex) {
              UI.toast(`"${p.name}" created, but queuing the deployment failed: ${ex.message}`, "error");
            }
            load();
          });
        },
      }
    );
  }

  /* ---------------- wiring ---------------- */

  document.getElementById("btn-new").addEventListener("click", newProjectModal);
  document.getElementById("btn-refresh").addEventListener("click", () => load());

  qEl.addEventListener("input", render);
  statusEl.addEventListener("change", render);

  document.querySelectorAll(".view-btn").forEach((btn) => {
    const on = btn.dataset.view === view;
    btn.classList.toggle("bg-hairline", on);
    btn.classList.toggle("text-primary", on);
    btn.classList.toggle("text-secondary", !on);
    btn.addEventListener("click", () => {
      view = btn.dataset.view;
      localStorage.setItem("neondeploy.view", view);
      document.querySelectorAll(".view-btn").forEach((b) => {
        b.classList.toggle("bg-hairline", b === btn);
        b.classList.toggle("text-primary", b === btn);
        b.classList.toggle("text-secondary", b !== btn);
      });
      render();
    });
  });

  // Live-refresh while anything is mid-build.
  setInterval(() => {
    if (all.some(isActive)) load({ quiet: true });
  }, 5000);

  UI.requireSession().then(() => load()).catch((e) => {
    if (e.status !== 401 && e.status !== 500) load();
  });
})();
