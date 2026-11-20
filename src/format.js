/**
 * format.js — display helpers
 */
import { getSettings } from "./store.js";

export function unitLabel(unit) {
  return unit === "lb" ? "LB" : "KG";
}

export function fmtWeight(w) {
  const n = Number(w);
  if (!isFinite(n)) return "—";
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  return s;
}

export function fmtWeightUnit(w, unit) {
  const u = unit || getSettings().unit;
  return `${fmtWeight(w)} ${unitLabel(u)}`;
}

export function fmtRepRange(min, max) {
  if (min && max) return `${min}–${max}`;
  if (min) return `${min}+`;
  if (max) return `≤${max}`;
  return "—";
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function relativeDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night session";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
