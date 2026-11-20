/**
 * main.js — app entry point
 * Hash-based router + app shell (top nav, mobile bottom nav, FAB).
 */
import "./style.css";
import { initTheme } from "./src/theme.js";
import { getState } from "./src/store.js";
import { icon } from "./src/icons.js";

initTheme();

const NAV = [
  { root: "", label: "Home", icon: "dashboard" },
  { root: "split", label: "Split", icon: "layers" },
  { root: "workout", label: "Workout", icon: "dumbbell" },
  { root: "history", label: "History", icon: "history" },
  { root: "analytics", label: "Progress", icon: "chart" },
  { root: "settings", label: "Settings", icon: "settings" },
];

const app = document.getElementById("app");
let mainEl = app;

function buildShell() {
  app.innerHTML = `
    <header class="app-header">
      <a class="app-brand" href="#/"><span class="dot"></span> Plate</a>
      <nav class="app-nav" id="app-nav"></nav>
    </header>
    <main class="app-main" id="app-main"></main>
    <nav class="app-footer-nav"><ul id="app-footer-nav"></ul></nav>
    <button class="fab" id="fab-start" title="Start workout" aria-label="Start workout">${icon("play")}</button>`;

  const navEl = app.querySelector("#app-nav");
  const footEl = app.querySelector("#app-footer-nav");
  NAV.forEach((n) => {
    const a = document.createElement("a");
    a.className = "nav-link";
    a.href = `#/${n.root}`;
    a.dataset.root = n.root;
    a.innerHTML = `${icon(n.icon)}<span>${n.label}</span>`;
    navEl.appendChild(a);

    const li = document.createElement("li");
    const a2 = a.cloneNode(true);
    li.appendChild(a2);
    footEl.appendChild(li);
  });

  app.querySelector("#fab-start").addEventListener("click", () => go("workout"));
  mainEl = app.querySelector("#app-main");
}

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";
  return { path: hash, parts: hash.split("/").filter(Boolean) };
}

function navigate(path) {
  const clean = path.replace(/^\//, "");
  if (location.hash !== `#/${clean}`) location.hash = `/${clean}`;
  else render();
}
function go(root) { navigate(root); }

async function render() {
  const { parts } = parseHash();
  const onboarded = getState().onboarded;

  if (!onboarded) {
    app.innerHTML = "";
    mainEl = app;
    const mod = await import("./src/onboarding.js");
    mod.renderOnboarding(app);
    return;
  }

  if (!app.querySelector(".app-header")) buildShell();

  const root = parts[0] || "";
  if (root !== "workout") (await import("./src/workout.js")).cleanup?.();

  if (root === "") (await import("./src/dashboard.js")).renderDashboard(mainEl, { go });
  else if (root === "split") (await import("./src/split.js")).renderSplit(mainEl, { go });
  else if (root === "workout") (await import("./src/workout.js")).renderWorkout(mainEl, { go });
  else if (root === "history") {
    const m = await import("./src/history.js");
    parts[1] ? m.renderHistoryDetail(mainEl, { go }, parts[1]) : m.renderHistory(mainEl, { go });
  }
  else if (root === "analytics") (await import("./src/analytics.js")).renderAnalytics(mainEl, { go });
  else if (root === "settings") (await import("./src/settings.js")).renderSettings(mainEl, { go });
  else (await import("./src/dashboard.js")).renderDashboard(mainEl, { go });

  updateActiveNav(root);
  window.scrollTo(0, 0);
}

function updateActiveNav(root) {
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("active", a.dataset.root === root);
  });
}

window.addEventListener("hashchange", render);
window.addEventListener("route", (e) => {
  const p = e.detail?.path || "/";
  location.hash = p;
});

render();
