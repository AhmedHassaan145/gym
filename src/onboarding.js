/**
 * onboarding.js — first-run setup: choose split, optional sample exercises
 */
import { SPLIT_PRESETS, SAMPLE_EXERCISES } from "./splits.js";
import { getSplit, setSplit, setExercises, setOnboarded, updateSettings } from "./store.js";
import { uid } from "./uid.js";
import { escapeHtml } from "./ui.js";
import { icon } from "./icons.js";

let selectedKey = null;
let wantSamples = true;

export function renderOnboarding(mount) {
  selectedKey = null;
  wantSamples = true;
  mount.innerHTML = `
    <div class="onboard">
      <div class="onboard-card">
        <div class="onboard-logo"><span class="dot"></span> Plate</div>
        <h1 style="font-size:1.5rem;margin-bottom:8px">Welcome. Let's set up your training split.</h1>
        <p class="muted" style="margin-bottom:24px">Pick a structure for your week. You can change it, rename days, or build a custom split anytime.</p>

        <div class="split-grid" id="split-grid"></div>

        <label style="display:flex;align-items:center;gap:10px;margin:24px 0;padding:14px 16px;border:1px solid var(--border-soft);border-radius:12px;background:var(--bg-1);cursor:pointer">
          <input type="checkbox" id="sample-check" checked style="width:18px;height:18px;accent-color:var(--accent)" />
          <span>
            <strong>Add a few sample exercises</strong><br>
            <span class="muted small">Optional starter set on your first day. You can edit or remove them later.</span>
          </span>
        </label>

        <button class="btn primary block lg" id="onboard-start" disabled>Start training</button>
      </div>
    </div>`;

  const grid = mount.querySelector("#split-grid");
  grid.innerHTML = SPLIT_PRESETS.map((s) => `
    <button class="split-option" data-key="${s.key}">
      <h4>${escapeHtml(s.name)}</h4>
      <p>${escapeHtml(s.description)}</p>
    </button>`).join("");

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".split-option");
    if (!btn) return;
    selectedKey = btn.dataset.key;
    grid.querySelectorAll(".split-option").forEach((b) => b.classList.toggle("selected", b === btn));
    mount.querySelector("#onboard-start").disabled = false;
  });

  mount.querySelector("#sample-check").addEventListener("change", (e) => {
    wantSamples = e.target.checked;
  });

  mount.querySelector("#onboard-start").addEventListener("click", () => {
    if (!selectedKey) return;
    finishOnboarding(selectedKey, wantSamples);
  });
}

function finishOnboarding(key, samples) {
  const preset = SPLIT_PRESETS.find((s) => s.key === key);
  const days = preset.days.map((d) => ({ id: uid("day"), name: d.name }));
  setSplit({ id: uid("split"), name: preset.name, days });

  const exercises = [];
  if (samples && days.length > 0) {
    SAMPLE_EXERCISES.forEach((s, i) => {
      exercises.push({
        id: uid("ex"),
        dayId: days[0].id,
        name: s.name,
        sets: s.sets,
        repMin: 8,
        repMax: 12,
        weight: s.weight,
        unit: "kg",
        increment: s.increment,
        notes: "",
        order: i,
      });
    });
  }
  setExercises(exercises);
  setOnboarded(true);
  window.dispatchEvent(new CustomEvent("route", { detail: { path: "/" } }));
}
