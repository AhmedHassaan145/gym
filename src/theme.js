/**
 * theme.js — apply theme attribute on <html>
 */
import { getSettings } from "./store.js";

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
}

export function initTheme() {
  setTheme(getSettings().theme);
}
