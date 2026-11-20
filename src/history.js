/**
 * history.js — workout history list + detail view
 */
import { getHistory, deleteHistory, updateHistory, getSplit, getExercises } from "./store.js";
import { icon } from "./icons.js";
import { toast, confirmDialog, openModal, escapeHtml } from "./ui.js";
import { fmtDate, fmtDateTime, fmtDuration, fmtWeightUnit, relativeDate } from "./format.js";
import { uid } from "./uid.js";

export function renderHistory(mount, router) {
  const history = getHistory();
  mount.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-title">History</div>
          <div class="page-sub">${history.length} completed workout${history.length === 1 ? "" : "s"}</div>
        </div>
      </div>
      ${history.length ? `
        <div class="stack" id="hist-list">
          ${history.map((r) => `
            <div class="history-item" data-id="${r.id}">
              <div class="row" style="gap:14px;flex:1">
                <div class="date-col">
                  <span class="day-name">${escapeHtml(r.dayName)}</span>
                  <span class="date">${fmtDate(r.date)} · ${relativeDate(r.date)}</span>
                </div>
              </div>
              <div class="stats">
                ${(r.exercises || []).length} exercises · ${r.durationSec ? fmtDuration(r.durationSec) : "—"}
              </div>
              ${icon("arrowRight")}
            </div>`).join("")}
        </div>` : `
        <div class="card empty">
          <div class="icon-wrap">${icon("history")}</div>
          <h3>No history yet</h3>
          <p>Your completed workouts will appear here. Start one from the dashboard.</p>
        </div>`}
    </div>`;

  mount.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => router.navigate(`/history/${el.dataset.id}`));
  });
}

export function renderHistoryDetail(mount, router, id) {
  const rec = getHistory().find((h) => h.id === id);
  if (!rec) {
    mount.innerHTML = `<div class="page"><div class="card empty"><div class="icon-wrap">${icon("x")}</div><h3>Workout not found</h3><button class="btn primary" id="back">Back to history</button></div></div>`;
    mount.querySelector("#back").addEventListener("click", () => router.navigate("/history"));
    return;
  }

  mount.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <button class="btn-icon-ghost" id="back" style="margin-bottom:8px">${icon("arrowLeft")}</button>
          <div class="page-title">${escapeHtml(rec.dayName)}</div>
          <div class="page-sub">${fmtDateTime(rec.date)} · ${rec.durationSec ? fmtDuration(rec.durationSec) : "—"}</div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn ghost sm" id="edit">${icon("pencil")} Edit</button>
          <button class="btn ghost sm danger" id="delete">${icon("trash")} Delete</button>
        </div>
      </div>

      <div class="stack">
        ${(rec.exercises || []).map((ex, i) => `
          <div class="card">
            <div class="row between" style="margin-bottom:10px">
              <div style="font-weight:600">${i + 1}. ${escapeHtml(ex.name)}</div>
              ${ex.skipped ? `<span class="badge warning">Skipped</span>` : ""}
            </div>
            ${(ex.sets || []).length ? `
              <div class="stack" style="gap:6px">
                ${ex.sets.map((s, si) => `
                  <div class="row" style="gap:10px;font-variant-numeric:tabular-nums">
                    <span class="muted small" style="width:24px">${si + 1}.</span>
                    <span><strong>${fmtWeightUnit(s.weight)}</strong> × <strong>${s.reps || 0}</strong> reps</span>
                  </div>`).join("")}
              </div>` : `<p class="muted small">No sets logged.</p>`}
            ${ex.notes ? `<p class="small muted" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-soft)">${escapeHtml(ex.notes)}</p>` : ""}
          </div>`).join("")}
      </div>
    </div>`;

  mount.querySelector("#back").addEventListener("click", () => router.navigate("/history"));
  mount.querySelector("#edit").addEventListener("click", () => openEditWorkoutModal(mount, router, rec));
  mount.querySelector("#delete").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Delete this workout?",
      message: "This record will be permanently removed from your history.",
      confirmText: "Delete", danger: true,
    });
    if (!ok) return;
    deleteHistory(rec.id);
    toast("Workout deleted", "success");
    router.navigate("/history");
  });
}

/* ---------- Edit workout modal ---------- */
function openEditWorkoutModal(mount, router, rec) {
  const split = getSplit();
  
  // Create a mutable copy of the exercises data
  let editExercises = (rec.exercises || []).map(ex => ({
    exerciseId: ex.exerciseId || uid("ex_hist"),
    name: ex.name,
    notes: ex.notes || "",
    skipped: ex.skipped || false,
    sets: (ex.sets || []).map(s => ({ weight: s.weight, reps: s.reps }))
  }));
  
  const renderExerciseList = (root) => {
    const container = root.querySelector("#edit-exercises");
    container.innerHTML = editExercises.map((ex, i) => {
      const setsHTML = ex.sets.map((s, si) => `
        <div class="row" style="gap:8px;align-items:center">
          <span class="muted small" style="width:24px">${si + 1}.</span>
          <input class="input num" type="number" step="0.5" min="0" placeholder="0" data-ex="${i}" data-set="${si}" data-field="weight" value="${s.weight ?? ""}" style="width:80px" />
          <span class="muted">×</span>
          <input class="input num" type="number" min="0" placeholder="0" data-ex="${i}" data-set="${si}" data-field="reps" value="${s.reps ?? ""}" style="width:60px" />
          <span class="muted small">reps</span>
        </div>
      `).join("");
      
      return `
        <div class="card pad-sm" style="margin-bottom:12px" data-ex-idx="${i}">
          <div class="row between" style="margin-bottom:8px">
            <div class="row" style="gap:8px;align-items:center;flex:1">
              <span class="muted small">${i + 1}.</span>
              <input class="input" type="text" data-ex="${i}" data-field="name" value="${escapeHtml(ex.name)}" style="flex:1" placeholder="Exercise name" />
            </div>
            <button class="btn-icon-ghost danger" data-remove-ex="${i}" title="Remove exercise">${icon("trash")}</button>
          </div>
          <div class="stack" id="sets-${i}" style="gap:6px">
            ${setsHTML}
          </div>
          <div class="row" style="gap:8px;margin-top:8px">
            <button class="btn ghost sm" data-add-set="${i}">${icon("plus")} Add set</button>
          </div>
          <div class="field" style="margin-top:8px">
            <label class="label">Notes</label>
            <textarea class="textarea" data-ex="${i}" data-field="notes" placeholder="Exercise notes...">${escapeHtml(ex.notes)}</textarea>
          </div>
        </div>
      `;
    }).join("");
    
    // Re-attach event listeners
    attachExerciseListeners(root);
  };
  
  const attachExerciseListeners = (root) => {
    // Add set handlers
    root.querySelectorAll("[data-add-set]").forEach(btn => {
      btn.onclick = () => {
        const exIdx = Number(btn.dataset.addSet);
        const ex = editExercises[exIdx];
        if (!ex) return;
        ex.sets.push({ weight: "", reps: "" });
        renderExerciseList(root);
      };
    });
    
    // Remove exercise handlers
    root.querySelectorAll("[data-remove-ex]").forEach(btn => {
      btn.onclick = () => {
        const exIdx = Number(btn.dataset.removeEx);
        editExercises.splice(exIdx, 1);
        renderExerciseList(root);
      };
    });
    
    // Input handlers for name, notes, weight, reps
    root.querySelectorAll("[data-field]").forEach(input => {
      input.onchange = () => {
        const exIdx = Number(input.dataset.ex);
        const field = input.dataset.field;
        const value = input.value;
        const ex = editExercises[exIdx];
        if (!ex) return;
        
        if (field === "name" || field === "notes") {
          ex[field] = value;
        } else if (field === "weight" || field === "reps") {
          const setIdx = Number(input.dataset.set);
          if (!ex.sets[setIdx]) ex.sets[setIdx] = { weight: "", reps: "" };
          if (value !== "") {
            ex.sets[setIdx][field] = field === "weight" ? Number(value) : Number(value);
          } else {
            ex.sets[setIdx][field] = "";
          }
        }
      };
    });
  };
  
  const dayOptions = split.days.map(d => `<option value="${d.id}" ${d.id === rec.dayId ? "selected" : ""}>${escapeHtml(d.name)}</option>`).join("");
  
  const { close } = openModal({
    title: "Edit workout",
    bodyHTML: `
      <div class="stack" style="gap:16px">
        <div class="field">
          <label class="label">Date & Time</label>
          <input class="input" type="datetime-local" id="edit-date" value="${rec.date.slice(0, 16)}" />
        </div>
        <div class="field">
          <label class="label">Workout day</label>
          <select class="select" id="edit-day">${dayOptions}</select>
        </div>
        <div class="field">
          <label class="label">Duration (optional)</label>
          <input class="input num" type="number" min="0" id="edit-duration" placeholder="Seconds" value="${rec.durationSec || ""}" />
        </div>
        <div class="divider"></div>
        <div style="font-weight:600">Exercises</div>
        <div class="stack" id="edit-exercises"></div>
        <button class="btn ghost" id="add-exercise">${icon("plus")} Add exercise</button>
      </div>`,
    footerHTML: `
      <button class="btn ghost" data-cancel>Cancel</button>
      <button class="btn primary" data-save>Save changes</button>`,
    onMount: (root, doClose) => {
      root.querySelector("[data-cancel]").addEventListener("click", doClose);
      root.querySelector("[data-save]").addEventListener("click", () => saveEdit(root, rec, doClose, router));
      
      // Initial render
      renderExerciseList(root);
      
      // Add exercise handler
      root.querySelector("#add-exercise").addEventListener("click", () => {
        editExercises.push({
          exerciseId: uid("ex_hist"),
          name: "",
          notes: "",
          skipped: false,
          sets: [{ weight: "", reps: "" }]
        });
        renderExerciseList(root);
      });
    },
  });
}

function saveEdit(root, rec, doClose, router) {
  const date = root.querySelector("#edit-date").value;
  const dayId = root.querySelector("#edit-day").value;
  const durationSec = Number(root.querySelector("#edit-duration").value) || 0;
  
  if (!date) {
    toast("Please select a date", "error");
    return;
  }
  
  const day = getSplit().days.find(d => d.id === dayId);
  if (!day) {
    toast("Invalid workout day", "error");
    return;
  }
  
  // Collect exercises from editExercises (already in memory)
  // We need to access the editExercises array from the closure
  // Since it's in the outer function, we can't access it directly here
  // Instead, we'll read from the DOM
  const exerciseCards = root.querySelectorAll("#edit-exercises .card[data-ex-idx]");
  const exercises = [];
  
  for (const card of exerciseCards) {
    const exIdx = Number(card.dataset.exIdx);
    const nameInput = card.querySelector(`[data-ex="${exIdx}"][data-field="name"]`);
    const name = nameInput ? nameInput.value.trim() : "";
    
    if (!name) {
      toast("Exercise name cannot be empty", "error");
      return;
    }
    
    const notesInput = card.querySelector(`[data-ex="${exIdx}"][data-field="notes"]`);
    const notes = notesInput ? notesInput.value.trim() : "";
    
    const setRows = card.querySelectorAll(`[data-ex="${exIdx}"][data-set]`);
    const setsMap = {};
    
    setRows.forEach(input => {
      const setIdx = Number(input.dataset.set);
      const field = input.dataset.field;
      const value = input.value;
      if (!setsMap[setIdx]) setsMap[setIdx] = { weight: "", reps: "" };
      if (value !== "") setsMap[setIdx][field] = field === "weight" ? Number(value) : Number(value);
    });
    
    const sets = Object.keys(setsMap).map(k => setsMap[k]);
    
    // Find the original exerciseId if it exists
    const origEx = rec.exercises?.[exIdx];
    const exerciseId = origEx?.exerciseId || uid("ex_hist");
    
    exercises.push({
      exerciseId,
      name,
      notes,
      skipped: false,
      sets: sets.filter(s => s.weight !== "" || s.reps !== ""),
    });
  }
  
  if (exercises.length === 0) {
    toast("At least one exercise is required", "error");
    return;
  }
  
  updateHistory(rec.id, {
    date: new Date(date).toISOString(),
    dayId,
    dayName: day.name,
    durationSec,
    exercises,
  });
  
  doClose();
  toast("Workout updated", "success");
  router.navigate(`/history/${rec.id}`);
}
