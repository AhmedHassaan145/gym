/**
 * dashboard.js — home overview
 */
import { getState, getExercises, getHistory, getSplit } from "./store.js";
import { recommend, summary, Status } from "./progression.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";
import { fmtWeightUnit, fmtRepRange, relativeDate, greeting, unitLabel } from "./format.js";

const STATUS_META = {
  [Status.READY]: { label: "Ready to increase", cls: "ready", icon: "arrowUp" },
  [Status.IMPROVING]: { label: "Improving", cls: "improving", icon: "trendUp" },
  [Status.MAINTAINING]: { label: "Maintaining", cls: "maintaining", icon: "scale" },
  [Status.ATTENTION]: { label: "Needs attention", cls: "attention", icon: "flag" },
  [Status.NEW]: { label: "New", cls: "maintaining", icon: "sparkle" },
};

export function renderDashboard(mount, router) {
  const state = getState();
  const exercises = getExercises();
  const history = getHistory();
  const split = getSplit();

  const totalWorkouts = history.length;
  const totalExercises = exercises.length;
  const lastRec = history[0] || null;

  // Next suggested day: the day after the last completed day in split order
  const nextDay = pickNextDay(split, state.lastWorkoutDayId);

  // Status summary
  const sum = summary(exercises, history);

  // Exercises ready to increase
  const readyExercises = exercises
    .map((ex) => ({ ex, rec: recommend(ex, history) }))
    .filter((r) => r.rec.status === Status.READY);

  // Recent activity (latest 5)
  const recent = history.slice(0, 5);

  mount.innerHTML = `
    <div class="page">
      <section class="hero">
        <div>
          <div class="greet">${greeting()}</div>
          <h1>Ready to train.</h1>
        </div>
        <div class="row wrap" style="gap:12px">
          ${nextDay ? `<span class="next-day">${icon("arrowRight")} Next: ${escapeHtml(nextDay.name)}</span>` : ""}
          <button class="btn primary lg" id="dash-start">${icon("play")} Start Workout</button>
        </div>
      </section>

      <div class="grid cols-4">
        <div class="stat-card"><span class="stat-label">Workouts</span><span class="stat-value">${totalWorkouts}</span></div>
        <div class="stat-card"><span class="stat-label">Exercises</span><span class="stat-value">${totalExercises}</span></div>
        <div class="stat-card"><span class="stat-label">Split</span><span class="stat-value" style="font-size:1.05rem;line-height:1.3">${escapeHtml(split.name)}</span></div>
        <div class="stat-card"><span class="stat-label">Last workout</span><span class="stat-value" style="font-size:1rem">${lastRec ? relativeDate(lastRec.date) : "—"}</span></div>
      </div>

      <section>
        <div class="section-title" style="margin-bottom:12px">Progression overview</div>
        <div class="progress-summary">
          <div class="progress-pill ready"><span class="num">${sum.ready || 0}</span><span class="lbl">Ready</span></div>
          <div class="progress-pill improving"><span class="num">${sum.improving || 0}</span><span class="lbl">Improving</span></div>
          <div class="progress-pill maintaining"><span class="num">${sum.maintaining || 0}</span><span class="lbl">Maintaining</span></div>
          <div class="progress-pill attention"><span class="num">${sum.attention || 0}</span><span class="lbl">Attention</span></div>
        </div>
      </section>

      ${readyExercises.length ? `
        <section>
          <div class="section-title" style="margin-bottom:12px">Ready for a weight increase</div>
          <div class="stack">
            ${readyExercises.map(({ ex, rec }) => `
              <div class="card pad-sm row between">
                <div>
                  <div style="font-weight:600">${escapeHtml(ex.name)}</div>
                  <div class="muted small">${escapeHtml(dayName(split, ex.dayId))} · ${fmtRepRange(ex.repMin, ex.repMax)} reps</div>
                </div>
                <div class="row" style="gap:12px">
                  <span class="badge"><span class="dim">${rec.lastWeight != null ? fmtWeightUnit(rec.lastWeight) : "—"}</span></span>
                  <span class="badge accent">${icon("arrowUp")} ${fmtWeightUnit(rec.recommendedWeight)}</span>
                </div>
              </div>`).join("")}
          </div>
        </section>` : ""}

      <section>
        <div class="section-title" style="margin-bottom:12px">Recent activity</div>
        ${recent.length ? `
          <div class="stack">
            ${recent.map((r) => `
              <div class="card pad-sm row between hover" data-history="${r.id}">
                <div>
                  <div style="font-weight:600">${escapeHtml(r.dayName)}</div>
                  <div class="muted small">${relativeDate(r.date)} · ${(r.exercises || []).length} exercises</div>
                </div>
                ${icon("arrowRight")}
              </div>`).join("")}
          </div>` : `
          <div class="card empty">
            <div class="icon-wrap">${icon("history")}</div>
            <h3>No workouts yet</h3>
            <p>Hit "Start Workout" to log your first session. Your history and progression will show up here.</p>
          </div>`}
      </section>
    </div>`;

  mount.querySelector("#dash-start").addEventListener("click", () => {
    router.navigate("/workout");
  });

  mount.querySelectorAll("[data-history]").forEach((el) => {
    el.addEventListener("click", () => router.navigate(`/history/${el.dataset.history}`));
  });
}

function pickNextDay(split, lastDayId) {
  if (!split.days.length) return null;
  if (!lastDayId) return split.days[0];
  const idx = split.days.findIndex((d) => d.id === lastDayId);
  if (idx === -1) return split.days[0];
  return split.days[(idx + 1) % split.days.length];
}

function dayName(split, dayId) {
  const d = split.days.find((x) => x.id === dayId);
  return d ? d.name : "—";
}
