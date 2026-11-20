/**
 * analytics.js — per-exercise progress: weight/reps charts + best lifts + est 1RM
 * Uses Chart.js loaded via CDN (no framework).
 */
import { getExercises, getHistory } from "./store.js";
import { exerciseHistory, estimate1RM } from "./progression.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";
import { fmtWeightUnit, fmtDate } from "./format.js";

let chartRefs = [];
let selectedExId = null;

export function renderAnalytics(mount, router) {
  const exercises = getExercises();
  selectedExId = selectedExId && exercises.find((e) => e.id === selectedExId) ? selectedExId : (exercises[0]?.id || null);

  mount.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-title">Progress</div>
          <div class="page-sub">Weight, reps, and estimated 1RM over time</div>
        </div>
      </div>

      ${exercises.length ? `
        <div class="ex-pick" id="ex-pick">
          ${exercises.map((e) => `
            <button class="chip ${e.id === selectedExId ? "active" : ""}" data-ex="${e.id}">${escapeHtml(e.name)}</button>`).join("")}
        </div>
        <div id="ex-detail"></div>` : `
        <div class="card empty">
          <div class="icon-wrap">${icon("chart")}</div>
          <h3>No exercises to analyze</h3>
          <p>Add exercises to your split and log a few workouts to see your progress here.</p>
        </div>`}
    </div>`;

  if (exercises.length) {
    mount.querySelector("#ex-pick").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ex]");
      if (!btn) return;
      selectedExId = btn.dataset.ex;
      mount.querySelectorAll("#ex-pick .chip").forEach((c) => c.classList.toggle("active", c.dataset.ex === selectedExId));
      drawDetail(mount);
    });
    drawDetail(mount);
  }
}

function drawDetail(mount) {
  const exercises = getExercises();
  const history = getHistory();
  const ex = exercises.find((e) => e.id === selectedExId);
  const wrap = mount.querySelector("#ex-detail");
  if (!ex) { wrap.innerHTML = ""; return; }

  const hist = exerciseHistory(history, ex.id); // oldest-first
  if (chartRefs.length) { chartRefs.forEach(c => c.destroy()); chartRefs = []; }

  if (!hist.length) {
    wrap.innerHTML = `<div class="card empty"><div class="icon-wrap">${icon("chart")}</div><h3>No data yet</h3><p>Log this exercise in a workout to see your progression.</p></div>`;
    return;
  }

  const labels = hist.map((h) => fmtDate(h.record.date));
  const maxWeights = hist.map((h) => Math.max(...h.sets.map((s) => Number(s.weight) || 0)));
  const topReps = hist.map((h) => Math.max(...h.sets.map((s) => Number(s.reps) || 0)));
  const est1RMs = hist.map((h) => {
    let best = 0;
    for (const s of h.sets) {
      const e = estimate1RM(Number(s.weight) || 0, Number(s.reps) || 0);
      if (e > best) best = e;
    }
    return best;
  });
  const bestWeight = Math.max(...maxWeights);
  const bestReps = Math.max(...topReps);
  const best1RM = Math.max(...est1RMs);
  const totalSets = hist.reduce((acc, h) => acc + h.sets.length, 0);

  wrap.innerHTML = `
    <div class="kv-list" style="margin-bottom:16px">
      <div class="kv"><span class="k">Best weight</span><span class="v">${fmtWeightUnit(bestWeight)}</span></div>
      <div class="kv"><span class="k">Best reps</span><span class="v">${bestReps}</span></div>
      <div class="kv"><span class="k">Est. 1RM</span><span class="v">${fmtWeightUnit(best1RM)}</span></div>
      <div class="kv"><span class="k">Sessions</span><span class="v">${hist.length}</span></div>
    </div>

    <div class="chart-wrap" style="margin-bottom:14px">
      <div class="section-title" style="margin-bottom:10px">Weight progression</div>
      <canvas id="chart-weight" height="200"></canvas>
    </div>
    <div class="chart-wrap" style="margin-bottom:14px">
      <div class="section-title" style="margin-bottom:10px">Top reps per session</div>
      <canvas id="chart-reps" height="200"></canvas>
    </div>
    <div class="chart-wrap">
      <div class="section-title" style="margin-bottom:10px">Estimated 1RM (Epley)</div>
      <canvas id="chart-1rm" height="200"></canvas>
    </div>`;

  drawChart(mount, "chart-weight", labels, maxWeights, "Weight", "#c6f135");
  drawChart(mount, "chart-reps", labels, topReps, "Reps", "#60a5fa");
  drawChart(mount, "chart-1rm", labels, est1RMs, "1RM", "#fbbf24");
}

function drawChart(mount, canvasId, labels, data, label, color) {
  const canvas = mount.querySelector(`#${canvasId}`);
  if (!canvas || !window.Chart) return;
  const ctx = canvas.getContext("2d");
  const c = new window.Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "22",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa6b1" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#9aa6b1" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
      },
    },
  });
  chartRefs.push(c);
}
