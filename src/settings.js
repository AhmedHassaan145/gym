/**
 * settings.js — preferences, data export/import, reset
 */
import { getState, getSettings, updateSettings, exportData, replaceState, resetState, validateImport } from "./store.js";
import { icon } from "./icons.js";
import { toast, confirmDialog, escapeHtml } from "./ui.js";
import { setTheme } from "./theme.js";

export function renderSettings(mount, router) {
  const s = getSettings();

  mount.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-title">Settings</div>
          <div class="page-sub">Preferences and data management</div>
        </div>
      </div>

      <section class="card">
        <div class="section-title" style="margin-bottom:14px">Preferences</div>
        <div class="stack" style="gap:16px">
          <div class="row between">
            <div><div style="font-weight:600">Weight unit</div><div class="muted small">Used across exercises and history</div></div>
            <select class="select" id="set-unit" style="width:auto">
              <option value="kg" ${s.unit === "kg" ? "selected" : ""}>KG</option>
              <option value="lb" ${s.unit === "lb" ? "selected" : ""}>LB</option>
            </select>
          </div>
          <div class="row between">
            <div><div style="font-weight:600">Theme</div><div class="muted small">Dark or light appearance</div></div>
            <select class="select" id="set-theme" style="width:auto">
              <option value="dark" ${s.theme === "dark" ? "selected" : ""}>Dark</option>
              <option value="light" ${s.theme === "light" ? "selected" : ""}>Light</option>
            </select>
          </div>
          <div class="row between">
            <div><div style="font-weight:600">Default rep range</div><div class="muted small">Used when adding new exercises</div></div>
            <div class="row" style="gap:6px">
              <input class="input num" type="number" min="1" max="100" id="set-repmin" value="${s.defaultRepMin}" style="width:70px" />
              <span class="muted">–</span>
              <input class="input num" type="number" min="1" max="100" id="set-repmax" value="${s.defaultRepMax}" style="width:70px" />
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="section-title" style="margin-bottom:14px">Your data</div>
        <div class="stack" style="gap:14px">
          <div class="row between">
            <div><div style="font-weight:600">Export to JSON</div><div class="muted small">Download a backup of all your data</div></div>
            <button class="btn ghost" id="export">${icon("download")} Export</button>
          </div>
          <div class="row between">
            <div><div style="font-weight:600">Import from JSON</div><div class="muted small">Restore a backup. Replaces current data.</div></div>
            <button class="btn ghost" id="import">${icon("upload")} Import</button>
            <input type="file" id="import-file" accept="application/json,.json" hidden />
          </div>
          <div class="divider"></div>
          <div class="row between">
            <div><div style="font-weight:600;color:var(--danger)">Reset all data</div><div class="muted small">Erase everything and start over</div></div>
            <button class="btn danger" id="reset">${icon("trash")} Reset</button>
          </div>
        </div>
      </section>

      <section class="card flat">
        <div class="section-title" style="margin-bottom:10px">About</div>
        <p class="muted small">Plate is a minimalist gym tracker. All your data lives locally in your browser. Nothing is uploaded to a server. Export a backup regularly if you want to keep your data when switching devices or clearing your browser.</p>
      </section>
    </div>`;

  wire(mount, router);
}

function wire(mount, router) {
  const s = getSettings();

  mount.querySelector("#set-unit").addEventListener("change", (e) => {
    updateSettings({ unit: e.target.value });
    toast("Unit updated", "success");
  });

  mount.querySelector("#set-theme").addEventListener("change", (e) => {
    updateSettings({ theme: e.target.value });
    setTheme(e.target.value);
    toast("Theme updated", "success");
  });

  mount.querySelector("#set-repmin").addEventListener("change", (e) => {
    const v = clampInt(e.target.value, 1, 100, 8);
    updateSettings({ defaultRepMin: v });
  });
  mount.querySelector("#set-repmax").addEventListener("change", (e) => {
    const v = clampInt(e.target.value, 1, 100, 12);
    updateSettings({ defaultRepMax: v });
  });

  mount.querySelector("#export").addEventListener("click", () => {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup exported", "success");
  });

  const fileInput = mount.querySelector("#import-file");
  mount.querySelector("#import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const err = validateImport(obj);
      if (err) { toast(`Invalid file: ${err}`, "error"); return; }
      const ok = await confirmDialog({
        title: "Import this data?",
        message: "Your current data will be replaced with the contents of this file.",
        confirmText: "Replace",
        danger: true,
      });
      if (!ok) return;
      replaceState(obj);
      toast("Data imported", "success");
      setTheme(getSettings().theme);
      router.navigate("/");
    } catch {
      toast("Could not read file. Make sure it's a valid JSON backup.", "error");
    } finally {
      fileInput.value = "";
    }
  });

  mount.querySelector("#reset").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Reset everything?",
      message: "This permanently erases all your workouts, exercises, and settings. This cannot be undone.",
      confirmText: "Erase all", danger: true,
    });
    if (!ok) return;
    const ok2 = await confirmDialog({
      title: "Are you absolutely sure?",
      message: "Last chance — all data will be gone.",
      confirmText: "Yes, erase", danger: true,
    });
    if (!ok2) return;
    resetState();
    toast("All data cleared", "success");
    router.navigate("/");
  });
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
