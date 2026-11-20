/**
 * workout.js — active workout logging session
 */
import { getSplit, getExercises, getHistory, addHistory, setLastWorkoutDayId, getSettings } from "./store.js";
import { recommend } from "./progression.js";
import { uid } from "./uid.js";
import { icon } from "./icons.js";
import { toast, confirmDialog, escapeHtml } from "./ui.js";
import { fmtWeightUnit, fmtRepRange, fmtDuration, unitLabel } from "./format.js";

let session = null; // { dayId, dayName, startedAt, exercises: [{exerciseId, name, skipped, notes, sets:[{weight,reps,done}]}] }
let timerInterval = null;

export function renderWorkout(mount, router) {
  const split = getSplit();

  // Resume or pick a day
  let dayId = sessionStorage.getItem("plate_active_day");
  const day = split.days.find((d) => d.id === dayId) || split.days[0];

  if (!day) {
    mount.innerHTML = `<div class="page"><div class="card empty"><div class="icon-wrap">${icon("layers")}</div><h3>No workout days</h3><p>Create a workout day in your split first.</p><button class="btn primary" id="go-split">Set up split</button></div></div>`;
    mount.querySelector("#go-split").addEventListener("click", () => router.navigate("/split"));
    return;
  }

  if (!session || session.dayId !== day.id) {
    session = buildSession(day);
  }
  startTimer(mount);
  draw(mount, router);
}

function buildSession(day) {
  const exercises = getExercises().filter((e) => e.dayId === day.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const history = getHistory();
  return {
    dayId: day.id,
    dayName: day.name,
    startedAt: Date.now(),
    exercises: exercises.map((ex) => {
      const rec = recommend(ex, history);
      const startWeight = rec.recommendedWeight || ex.weight;
      return {
        exerciseId: ex.id,
        name: ex.name,
        targetSets: ex.sets,
        repMin: ex.repMin,
        repMax: ex.repMax,
        unit: ex.unit,
        skipped: false,
        notes: "",
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          weight: i === 0 ? startWeight : "",
          reps: "",
          done: false,
        })),
      };
    }),
  };
}

function startTimer(mount) {
  stopTimer();
  timerInterval = setInterval(() => {
    const el = mount.querySelector("#aw-timer");
    if (el && session) el.textContent = fmtDuration(Math.floor((Date.now() - session.startedAt) / 1000));
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function draw(mount, router) {
  const settings = getSettings();
  mount.innerHTML = `
    <div class="page">
      <div class="aw-header">
        <div>
          <div class="muted small">Logging</div>
          <div style="font-weight:700;font-size:1.05rem">${escapeHtml(session.dayName)}</div>
        </div>
        <div class="row" style="gap:10px">
          <span class="aw-timer" id="aw-timer">00:00</span>
          <button class="btn ghost sm" id="aw-cancel">${icon("x")} Cancel</button>
          <button class="btn primary sm" id="aw-finish">${icon("check")} Finish</button>
        </div>
      </div>

      ${session.exercises.length ? `
        <div class="stack" id="aw-list">
          ${session.exercises.map((ex, i) => exerciseCard(ex, i, settings)).join("")}
        </div>` : `
        <div class="card empty">
          <div class="icon-wrap">${icon("dumbbell")}</div>
          <h3>No exercises on this day</h3>
          <p>Add exercises to this day in your split, then start a workout.</p>
          <button class="btn primary" id="go-split2">Edit split</button>
        </div>`}
    </div>`;

  if (!session.exercises.length) {
    mount.querySelector("#go-split2").addEventListener("click", () => router.navigate("/split"));
  }

  wireActions(mount, router);
}

function exerciseCard(ex, idx, settings) {
  const completedCount = ex.sets.filter((s) => s.done).length;
  const allDone = completedCount === ex.sets.length && ex.sets.length > 0;
  return `
    <div class="aw-exercise ${allDone ? "collapsed" : ""}" data-ex-idx="${idx}">
      <div class="aw-ex-head" data-toggle="${idx}">
        <span class="idx">${idx + 1}</span>
        <span class="name">${escapeHtml(ex.name)}</span>
        ${ex.skipped ? `<span class="badge warning">Skipped</span>` : allDone ? `<span class="badge success">${icon("check")} Done</span>` : `<span class="badge">${completedCount}/${ex.sets.length}</span>`}
        <button class="btn-icon-ghost" data-skip="${idx}" title="${ex.skipped ? "Unskip" : "Skip"}">${icon("skip")}</button>
      </div>
      ${ex.skipped ? "" : `
        <div class="aw-body">
          <div class="aw-rec ${ex.repMin > 0 ? "" : "warn"}">
            <span class="lbl">Target</span>
            <span class="val">${ex.targetSets} × ${fmtRepRange(ex.repMin, ex.repMax)}</span>
            <span class="dim">·</span>
            <span class="lbl">Start at</span>
            <span class="val">${fmtWeightUnit(ex.sets[0]?.weight || 0, ex.unit)}</span>
          </div>
          <div class="stack" id="sets-${idx}">
            ${ex.sets.map((s, si) => setRow(s, si, ex.unit)).join("")}
          </div>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button class="btn sm ghost" data-add-set="${idx}">${icon("plus")} Add set</button>
            <button class="btn sm ghost" data-del-set="${idx}">Remove last set</button>
          </div>
          <details style="margin-top:4px">
            <summary class="muted small" style="cursor:pointer">Notes</summary>
            <textarea class="textarea" data-notes="${idx}" placeholder="How did this exercise feel?" style="margin-top:8px">${escapeHtml(ex.notes || "")}</textarea>
          </details>
        </div>`}
    </div>`;
}

function setRow(s, si, unit) {
  return `
    <div class="set-row ${s.done ? "done" : ""}" data-set="${si}">
      <span class="set-no">${si + 1}</span>
      <div class="set-input-wrap">
        <span class="mini-label">${unit === "lb" ? "LB" : "KG"}</span>
        <input class="input num" type="number" step="0.5" min="0" placeholder="0" data-weight value="${s.weight}" />
      </div>
      <div class="set-input-wrap">
        <span class="mini-label">Reps</span>
        <input class="input num" type="number" min="0" placeholder="0" data-reps value="${s.reps}" />
      </div>
      <button class="set-check ${s.done ? "done" : ""}" data-check title="Mark complete">${icon("check")}</button>
    </div>`;
}

function wireActions(mount, router) {
  const list = mount.querySelector("#aw-list");
  if (!list) {
    mount.querySelector("#aw-cancel").addEventListener("click", () => cancelSession(router));
    mount.querySelector("#aw-finish").addEventListener("click", () => finish(mount, router));
    return;
  }

  list.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-toggle]");
    const skip = e.target.closest("[data-skip]");
    const check = e.target.closest("[data-check]");
    const addSet = e.target.closest("[data-add-set]");
    const delSet = e.target.closest("[data-del-set]");

    if (skip) {
      const i = Number(skip.dataset.skip);
      session.exercises[i].skipped = !session.exercises[i].skipped;
      draw(mount, router);
    } else if (check) {
      const setRow = check.closest("[data-set]");
      const i = Number(check.closest("[data-ex-idx]").dataset.exIdx);
      const si = Number(setRow.dataset.set);
      // require values
      const row = setRow;
      const w = row.querySelector("[data-weight]").value;
      const r = row.querySelector("[data-reps]").value;
      if (!w && !r) { toast("Enter weight or reps first", "error"); return; }
      const s = session.exercises[i].sets[si];
      s.weight = w === "" ? "" : Number(w);
      s.reps = r === "" ? "" : Number(r);
      s.done = !s.done;
      draw(mount, router);
    } else if (addSet) {
      const i = Number(addSet.dataset.addSet);
      const ex = session.exercises[i];
      const lastW = ex.sets.length ? ex.sets[ex.sets.length - 1].weight : "";
      ex.sets.push({ weight: lastW, reps: "", done: false });
      draw(mount, router);
    } else if (delSet) {
      const i = Number(delSet.dataset.delSet);
      const ex = session.exercises[i];
      if (ex.sets.length <= 1) { toast("At least one set is required", "error"); return; }
      ex.sets.pop();
      draw(mount, router);
    } else if (toggle && !e.target.closest("button") && !e.target.closest("input")) {
      const i = Number(toggle.dataset.toggle);
      const card = toggle.closest(".aw-exercise");
      card.classList.toggle("collapsed");
    }
  });

  list.addEventListener("input", (e) => {
    const w = e.target.closest("[data-weight]");
    const r = e.target.closest("[data-reps]");
    const notes = e.target.closest("[data-notes]");
    if (w || r) {
      const setRow = (w || r).closest("[data-set]");
      const card = (w || r).closest("[data-ex-idx]");
      const i = Number(card.dataset.exIdx);
      const si = Number(setRow.dataset.set);
      const s = session.exercises[i].sets[si];
      if (w) s.weight = w.value === "" ? "" : Number(w.value);
      if (r) s.reps = r.value === "" ? "" : Number(r.value);
    } else if (notes) {
      const i = Number(notes.dataset.notes);
      session.exercises[i].notes = notes.value;
    }
  });

  mount.querySelector("#aw-cancel").addEventListener("click", () => cancelSession(router));
  mount.querySelector("#aw-finish").addEventListener("click", () => finish(mount, router));
}

async function cancelSession(router) {
  const hasData = session.exercises.some((ex) => ex.sets.some((s) => s.weight || s.reps));
  if (hasData) {
    const ok = await confirmDialog({
      title: "Discard this workout?",
      message: "Any sets you've logged in this session will be lost.",
      confirmText: "Discard", danger: true,
    });
    if (!ok) return;
  }
  stopTimer();
  session = null;
  sessionStorage.removeItem("plate_active_day");
  router.navigate("/");
}

async function finish(mount, router) {
  const hasAny = session.exercises.some((ex) => !ex.skipped && ex.sets.some((s) => s.done || s.weight || s.reps));
  if (!hasAny) {
    toast("Log at least one set before finishing", "error");
    return;
  }
  const ok = await confirmDialog({
    title: "Finish workout?",
    message: "This session will be saved to your history.",
    confirmText: "Save workout",
  });
  if (!ok) return;

  const record = {
    id: uid("workout"),
    dayId: session.dayId,
    dayName: session.dayName,
    date: new Date().toISOString(),
    durationSec: Math.floor((Date.now() - session.startedAt) / 1000),
    exercises: session.exercises
      .filter((ex) => !ex.skipped)
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        notes: ex.notes,
        skipped: false,
        sets: ex.sets
          .filter((s) => s.weight !== "" || s.reps !== "")
          .map((s) => ({ weight: s.weight, reps: s.reps })),
      })),
  };
  addHistory(record);
  setLastWorkoutDayId(session.dayId);
  stopTimer();
  session = null;
  sessionStorage.removeItem("plate_active_day");
  toast("Workout saved!", "success");
  router.navigate(`/history/${record.id}`);
}

/** Called by router when leaving the workout view to keep timer tidy */
export function cleanup() {
  stopTimer();
}
