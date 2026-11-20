/**
 * split.js — manage workout split: days (CRUD + reorder) and per-day exercises
 */
import {
  getSplit, setSplit, getExercises, setExercises,
  addExercise, updateExercise, deleteExercise, getSettings, updateSettings,
} from "./store.js";
import { SPLIT_PRESETS } from "./splits.js";
import { uid } from "./uid.js";
import { icon } from "./icons.js";
import { toast, openModal, confirmDialog, promptDialog, escapeHtml } from "./ui.js";
import { fmtRepRange, fmtWeightUnit, unitLabel } from "./format.js";

export function renderSplit(mount, router) {
  const split = getSplit();
  const exercises = getExercises();

  mount.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-title">Workout Split</div>
          <div class="page-sub">Current: ${escapeHtml(split.name)} · ${split.days.length} days</div>
        </div>
        <button class="btn ghost" id="change-split">${icon("repeat")} Change split</button>
      </div>

      <div class="stack" id="days-list"></div>

      <button class="btn ghost block" id="add-day">${icon("plus")} Add workout day</button>
    </div>`;

  renderDays(mount, router);
  wireTopButtons(mount, router);
}

function renderDays(mount, router) {
  const split = getSplit();
  const exercises = getExercises();
  const list = mount.querySelector("#days-list");
  if (!split.days.length) {
    list.innerHTML = `<div class="card empty"><div class="icon-wrap">${icon("layers")}</div><h3>No workout days</h3><p>Add a day to start assigning exercises.</p></div>`;
    return;
  }
  list.innerHTML = split.days.map((day, i) => {
    const dayEx = exercises
      .filter((e) => e.dayId === day.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return `
      <div class="card" data-day="${day.id}">
        <div class="row between" style="margin-bottom:14px">
          <div class="row" style="gap:10px">
            <span class="order">${i + 1}</span>
            <div>
              <div style="font-weight:600;font-size:1.05rem">${escapeHtml(day.name)}</div>
              <div class="muted small">${dayEx.length} exercise${dayEx.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div class="row">
            <button class="btn-icon-ghost" data-day-up="${day.id}" title="Move up">${icon("arrowUp")}</button>
            <button class="btn-icon-ghost" data-day-down="${day.id}" title="Move down">${icon("arrowUp")}</button>
            <button class="btn-icon-ghost" data-day-rename="${day.id}" title="Rename">${icon("pencil")}</button>
            <button class="btn-icon-ghost danger" data-day-delete="${day.id}" title="Delete">${icon("trash")}</button>
          </div>
        </div>
        ${dayEx.length ? `
          <div class="stack" id="ex-list-${day.id}">
            ${dayEx.map((ex, idx) => exerciseRow(ex, idx)).join("")}
          </div>` : `
          <div class="empty" style="padding:24px 12px">
            <p class="muted small">No exercises yet.</p>
          </div>`}
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm ghost" data-add-ex="${day.id}">${icon("plus")} Add exercise</button>
          <button class="btn sm primary" data-start-day="${day.id}">${icon("play")} Start workout</button>
        </div>
      </div>`;
  }).join("");

  // rotate the "move down" arrow
  split.days.forEach((day, i) => {
    const down = list.querySelector(`[data-day-down="${day.id}"] svg`);
    if (down) down.style.transform = "rotate(180deg)";
  });

  wireDayButtons(mount, router);
}

function exerciseRow(ex, idx) {
  return `
    <div class="exercise-row" data-ex="${ex.id}">
      <div class="head">
        <span class="handle" data-ex-up="${ex.id}" title="Move up">${icon("grip")}</span>
        <span class="handle" data-ex-down="${ex.id}" title="Move down">${icon("grip")}</span>
        <span class="muted small">${idx + 1}.</span>
        <span class="name">${escapeHtml(ex.name)}</span>
        <button class="btn-icon-ghost" data-ex-edit="${ex.id}" title="Edit">${icon("pencil")}</button>
        <button class="btn-icon-ghost danger" data-ex-delete="${ex.id}" title="Delete">${icon("trash")}</button>
      </div>
      <div class="muted small">
        ${ex.sets} sets · ${fmtRepRange(ex.repMin, ex.repMax)} reps · ${fmtWeightUnit(ex.weight, ex.unit)} · +${fmtIncrement(ex.increment, ex.unit)}
      </div>
    </div>`;
}

function fmtIncrement(inc, unit) {
  const n = Number(inc) || 2.5;
  return `${n} ${unitLabel(unit)}`;
}

function wireTopButtons(mount, router) {
  mount.querySelector("#add-day").addEventListener("click", async () => {
    const name = await promptDialog({
      title: "New workout day",
      placeholder: "e.g. Push, Pull, Legs",
      confirmText: "Add day",
    });
    if (!name || !name.trim()) return;
    const split = getSplit();
    split.days.push({ id: uid("day"), name: name.trim() });
    setSplit(split);
    renderDays(mount, router);
    toast("Day added", "success");
  });

  mount.querySelector("#change-split").addEventListener("click", () => openChangeSplit(mount, router));
}

function wireDayButtons(mount, router) {
  const list = mount.querySelector("#days-list");

  list.addEventListener("click", async (e) => {
    const up = e.target.closest("[data-day-up]");
    const down = e.target.closest("[data-day-down]");
    const rename = e.target.closest("[data-day-rename]");
    const del = e.target.closest("[data-day-delete]");
    const addEx = e.target.closest("[data-add-ex]");
    const startDay = e.target.closest("[data-start-day]");
    const exEdit = e.target.closest("[data-ex-edit]");
    const exDel = e.target.closest("[data-ex-delete]");
    const exUp = e.target.closest("[data-ex-up]");
    const exDown = e.target.closest("[data-ex-down]");

    if (up) { moveDay(up.dataset.dayUp, -1); renderDays(mount, router); }
    else if (down) { moveDay(down.dataset.dayDown, 1); renderDays(mount, router); }
    else if (rename) {
      const split = getSplit();
      const d = split.days.find((x) => x.id === rename.dataset.dayRename);
      const name = await promptDialog({ title: "Rename day", initialValue: d.name, confirmText: "Save" });
      if (name && name.trim()) {
        d.name = name.trim();
        setSplit(split);
        renderDays(mount, router);
        toast("Renamed", "success");
      }
    }
    else if (del) {
      const split = getSplit();
      const d = split.days.find((x) => x.id === del.dataset.dayDelete);
      const ok = await confirmDialog({
        title: "Delete day?",
        message: `"${d.name}" and its exercises will be removed. Your workout history is kept.`,
        confirmText: "Delete",
        danger: true,
      });
      if (!ok) return;
      split.days = split.days.filter((x) => x.id !== d.id);
      setSplit(split);
      // remove exercises belonging to this day
      const ex = getExercises().filter((e) => e.dayId !== d.id);
      setExercises(ex);
      renderDays(mount, router);
      toast("Day deleted", "success");
    }
    else if (addEx) {
      openExerciseEditor(addEx.dataset.addEx, null, mount, router);
    }
    else if (startDay) {
      sessionStorage.setItem("plate_active_day", startDay.dataset.startDay);
      router.navigate("/workout");
    }
    else if (exEdit) {
      const ex = getExercises().find((x) => x.id === exEdit.dataset.exEdit);
      openExerciseEditor(ex.dayId, ex, mount, router);
    }
    else if (exDel) {
      const ex = getExercises().find((x) => x.id === exDel.dataset.exDelete);
      const ok = await confirmDialog({
        title: "Delete exercise?",
        message: `"${ex.name}" will be removed from your split. History records are kept.`,
        confirmText: "Delete",
        danger: true,
      });
      if (!ok) return;
      deleteExercise(ex.id);
      renderDays(mount, router);
      toast("Exercise deleted", "success");
    }
    else if (exUp) {
      moveExercise(exUp.dataset.exUp, -1);
      renderDays(mount, router);
    }
    else if (exDown) {
      moveExercise(exDown.dataset.exDown, 1);
      renderDays(mount, router);
    }
  });
}

function moveDay(dayId, dir) {
  const split = getSplit();
  const i = split.days.findIndex((d) => d.id === dayId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= split.days.length) return;
  [split.days[i], split.days[j]] = [split.days[j], split.days[i]];
  setSplit(split);
}

function moveExercise(exId, dir) {
  const exercises = getExercises();
  const ex = exercises.find((e) => e.id === exId);
  if (!ex) return;
  const sibs = exercises.filter((e) => e.dayId === ex.dayId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const i = sibs.findIndex((e) => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return;
  const a = sibs[i], b = sibs[j];
  const tmp = a.order;
  a.order = b.order;
  b.order = tmp;
  updateExercise(a.id, { order: a.order });
  updateExercise(b.id, { order: b.order });
}

/* ---------- Exercise editor modal ---------- */
function openExerciseEditor(dayId, existing, mount, router) {
  const settings = getSettings();
  const ex = existing || {
    name: "", sets: 3, repMin: settings.defaultRepMin, repMax: settings.defaultRepMax,
    weight: 20, unit: settings.unit, increment: 2.5, notes: "", order: getExercises().filter((e) => e.dayId === dayId).length,
  };

  const { close } = openModal({
    title: existing ? "Edit exercise" : "Add exercise",
    bodyHTML: `
      <div class="field"><label class="label">Exercise name</label><input class="input" data-f="name" placeholder="e.g. Flat Bench Press" value="${escapeHtml(ex.name)}" /></div>
      <div class="exercise-meta">
        <div class="field"><label class="label">Sets</label><input class="input num" type="number" min="1" max="20" data-f="sets" value="${ex.sets}" /></div>
        <div class="field"><label class="label">Rep min</label><input class="input num" type="number" min="1" max="100" data-f="repMin" value="${ex.repMin}" /></div>
        <div class="field"><label class="label">Rep max</label><input class="input num" type="number" min="1" max="100" data-f="repMax" value="${ex.repMax}" /></div>
        <div class="field"><label class="label">Unit</label>
          <select class="select" data-f="unit">
            <option value="kg" ${ex.unit === "kg" ? "selected" : ""}>KG</option>
            <option value="lb" ${ex.unit === "lb" ? "selected" : ""}>LB</option>
          </select>
        </div>
        <div class="field"><label class="label">Starting weight</label><input class="input num" type="number" min="0" step="0.5" data-f="weight" value="${ex.weight}" /></div>
        <div class="field"><label class="label">Increment</label><input class="input num" type="number" min="0.25" step="0.25" data-f="increment" value="${ex.increment}" /></div>
      </div>
      <div class="field"><label class="label">Notes (optional)</label><textarea class="textarea" data-f="notes" placeholder="Form cues, tempo, rest time...">${escapeHtml(ex.notes || "")}</textarea></div>`,
    footerHTML: `
      ${existing ? `<button class="btn danger" data-ex-del>Delete</button>` : ""}
      <div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancel</button>
      <button class="btn primary" data-save>Save</button>`,
    onMount: (root, doClose) => {
      root.querySelector("[data-cancel]").addEventListener("click", doClose);
      root.querySelector("[data-save]").addEventListener("click", () => {
        const f = (k) => root.querySelector(`[data-f="${k}"]`).value;
        const name = f("name").trim();
        if (!name) { toast("Please enter an exercise name", "error"); return; }
        const payload = {
          name,
          sets: clampInt(f("sets"), 1, 20, 3),
          repMin: clampInt(f("repMin"), 1, 100, 8),
          repMax: clampInt(f("repMax"), 1, 100, 12),
          unit: f("unit"),
          weight: Math.max(0, Number(f("weight")) || 0),
          increment: Math.max(0.25, Number(f("increment")) || 2.5),
          notes: f("notes").trim(),
        };
        if (Number(payload.repMin) > Number(payload.repMax)) {
          toast("Rep min can't be higher than rep max", "error");
          return;
        }
        if (existing) {
          updateExercise(existing.id, payload);
          toast("Exercise updated", "success");
        } else {
          addExercise({ id: uid("ex"), dayId, ...payload, order: getExercises().filter((e) => e.dayId === dayId).length });
          toast("Exercise added", "success");
        }
        doClose();
        renderDays(mount, router);
      });
      if (existing) {
        root.querySelector("[data-ex-del]").addEventListener("click", async () => {
          const ok = await confirmDialog({
            title: "Delete exercise?",
            message: `"${existing.name}" will be removed from your split. History records are kept.`,
            confirmText: "Delete", danger: true,
          });
          if (!ok) return;
          deleteExercise(existing.id);
          doClose();
          renderDays(mount, router);
          toast("Exercise deleted", "success");
        });
      }
      root.querySelector("[data-f=name]").focus();
    },
  });
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/* ---------- Change split modal ---------- */
function openChangeSplit(mount, router) {
  const current = getSplit();
  const { close } = openModal({
    title: "Change workout split",
    subtitle: "Your exercise definitions and full history are preserved.",
    bodyHTML: `
      <div class="stack" id="preset-list">
        ${SPLIT_PRESETS.map((s) => `
          <button class="split-option ${s.name === current.name ? "selected" : ""}" data-preset="${s.key}" style="width:100%">
            <h4>${escapeHtml(s.name)}</h4>
            <p>${escapeHtml(s.description)}</p>
          </button>`).join("")}
      </div>
      <p class="muted small" style="margin-top:12px">Choosing a preset will replace your current days. Exercises tied to removed days will be detached but kept in history. Custom lets you start fresh with one day.</p>`,
    footerHTML: `<button class="btn ghost" data-cancel>Cancel</button>`,
    onMount: (root, doClose) => {
      root.querySelector("[data-cancel]").addEventListener("click", doClose);
      root.querySelector("#preset-list").addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-preset]");
        if (!btn) return;
        const preset = SPLIT_PRESETS.find((s) => s.key === btn.dataset.preset);
        const ok = await confirmDialog({
          title: `Switch to ${preset.name}?`,
          message: "Your current days will be replaced. Workout history is never deleted.",
          confirmText: "Switch split",
        });
        if (!ok) return;
        const days = preset.days.map((d) => ({ id: uid("day"), name: d.name }));
        setSplit({ id: uid("split"), name: preset.name, days });
        // detach exercises from removed days
        const dayIds = new Set(days.map((d) => d.id));
        setExercises(getExercises().map((ex) => dayIds.has(ex.dayId) ? ex : { ...ex, dayId: days[0]?.id || ex.dayId }));
        doClose();
        renderSplit(mount, router);
        toast("Split updated", "success");
      });
    },
  });
}
