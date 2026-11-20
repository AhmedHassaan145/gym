/**
 * store.js — localStorage persistence layer
 * Separates settings, split config, exercise definitions, and workout history.
 */

const STORAGE_KEY = "plate_gym_tracker_v1";
const SCHEMA_VERSION = 1;

import { uid } from "./uid.js";

/** Default empty state for a fresh install */
function defaultState() {
  return {
    schema: SCHEMA_VERSION,
    onboarded: false,
    settings: {
      unit: "kg", // kg | lb
      theme: "dark", // dark | light
      defaultRepMin: 8,
      defaultRepMax: 12,
    },
    split: {
      id: uid("split"),
      name: "Custom",
      days: [], // [{ id, name }]
    },
    exercises: [], // [{ id, dayId, name, sets, repMin, repMax, weight, unit, increment, notes, order }]
    history: [], // [{ id, dayId, dayName, date, exercises: [{ name, exerciseId, sets: [{ weight, reps }], notes, skipped }] }]
    lastWorkoutDayId: null,
  };
}

/** Safe JSON parse */
function safeParse(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

let cache = null;

/** Load state from localStorage, fall back to defaults, merge missing keys */
export function loadState() {
  if (cache) return cache;
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  const base = defaultState();
  if (!parsed) {
    cache = base;
    return cache;
  }
  // shallow-deep merge to tolerate new fields added by later versions
  cache = {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    split: { ...base.split, ...(parsed.split || {}) },
    exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
  };
  return cache;
}

/** Persist current state to localStorage */
export function saveState() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error("Failed to save state:", err);
    throw new Error("Could not save data. Storage may be full.");
  }
}

/** Replace the entire state (used by import) and persist */
export function replaceState(newState) {
  cache = {
    ...defaultState(),
    ...newState,
    settings: { ...defaultState().settings, ...(newState.settings || {}) },
    split: { ...newState.split },
    exercises: Array.isArray(newState.exercises) ? newState.exercises : [],
    history: Array.isArray(newState.history) ? newState.history : [],
  };
  cache.schema = SCHEMA_VERSION;
  saveState();
}

/** Reset to empty defaults (used by "reset all data") */
export function resetState() {
  cache = defaultState();
  saveState();
}

/** Get a snapshot for export */
export function exportData() {
  return JSON.stringify(loadState(), null, 2);
}

/** Validate an imported object looks like our data shape */
export function validateImport(obj) {
  if (!obj || typeof obj !== "object") return "Root must be an object.";
  if (!obj.settings || typeof obj.settings !== "object") return "Missing or invalid settings.";
  if (!obj.split || typeof obj.split !== "object") return "Missing or invalid split.";
  if (!Array.isArray(obj.split.days)) return "split.days must be an array.";
  if (!Array.isArray(obj.exercises)) return "exercises must be an array.";
  if (!Array.isArray(obj.history)) return "history must be an array.";
  for (const d of obj.split.days) {
    if (typeof d.id !== "string" || typeof d.name !== "string") return "Each split day needs id + name.";
  }
  return null;
}

/* ---------- Convenience accessors ---------- */
export function getState() { return loadState(); }
export function getSettings() { return loadState().settings; }
export function getSplit() { return loadState().split; }
export function getExercises() { return loadState().exercises; }
export function getHistory() { return loadState().history; }

export function updateSettings(patch) {
  const s = loadState();
  s.settings = { ...s.settings, ...patch };
  saveState();
  return s.settings;
}

export function setSplit(split) {
  const s = loadState();
  s.split = split;
  saveState();
}

export function setExercises(exercises) {
  const s = loadState();
  s.exercises = exercises;
  saveState();
}

export function addExercise(ex) {
  const s = loadState();
  s.exercises.push(ex);
  saveState();
}

export function updateExercise(id, patch) {
  const s = loadState();
  const i = s.exercises.findIndex((e) => e.id === id);
  if (i >= 0) {
    s.exercises[i] = { ...s.exercises[i], ...patch };
    saveState();
  }
}

export function deleteExercise(id) {
  const s = loadState();
  s.exercises = s.exercises.filter((e) => e.id !== id);
  saveState();
}

export function addHistory(record) {
  const s = loadState();
  s.history.unshift(record);
  s.lastWorkoutDayId = record.dayId;
  saveState();
}

export function updateHistory(id, patch) {
  const s = loadState();
  const i = s.history.findIndex((h) => h.id === id);
  if (i >= 0) {
    s.history[i] = { ...s.history[i], ...patch };
    saveState();
  }
}

export function deleteHistory(id) {
  const s = loadState();
  s.history = s.history.filter((h) => h.id !== id);
  saveState();
}

export function setOnboarded(v) {
  const s = loadState();
  s.onboarded = !!v;
  saveState();
}

export function setLastWorkoutDayId(id) {
  const s = loadState();
  s.lastWorkoutDayId = id;
  saveState();
}
