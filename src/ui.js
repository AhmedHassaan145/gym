/**
 * ui.js — small UI primitives: toast, modal, confirm
 */
import { icon } from "./icons.js";

let toastStack = null;

function getToastStack() {
  if (!toastStack) {
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    document.body.appendChild(toastStack);
  }
  return toastStack;
}

export function toast(message, type = "info", duration = 2600) {
  const stack = getToastStack();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const iconName = type === "success" ? "check" : type === "error" ? "x" : "info";
  el.innerHTML = `${icon(iconName)}<span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 220);
  }, duration);
}

/** Escape user text before injecting into innerHTML */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Open a modal. Returns the modal element; caller wires up inner buttons.
 * options: { title, subtitle, bodyHTML, footerHTML, onMount }
 */
export function openModal({ title, subtitle = "", bodyHTML = "", footerHTML = "", onMount }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="modal-sub">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        <button class="btn-icon-ghost" data-modal-close aria-label="Close">${icon("x")}</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ""}
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.closest("[data-modal-close]")) close();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  });
  if (onMount) onMount(backdrop, close);
  return { backdrop, close };
}

/**
 * Confirmation dialog. Returns a Promise<boolean>.
 */
export function confirmDialog({ title, message, confirmText = "Confirm", cancelText = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      subtitle: message,
      footerHTML: `
        <button class="btn ghost" data-cancel>${escapeHtml(cancelText)}</button>
        <button class="btn ${danger ? "danger" : "primary"}" data-confirm>${escapeHtml(confirmText)}</button>`,
      onMount: (root, doClose) => {
        root.querySelector("[data-cancel]").addEventListener("click", () => { doClose(); resolve(false); });
        root.querySelector("[data-confirm]").addEventListener("click", () => { doClose(); resolve(true); });
      },
    });
  });
}

/**
 * Prompt dialog with a single text input. Returns Promise<string|null>.
 */
export function promptDialog({ title, message = "", placeholder = "", initialValue = "", confirmText = "Save" }) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      subtitle: message,
      bodyHTML: `<input class="input" data-prompt-input placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(initialValue)}" />`,
      footerHTML: `
        <button class="btn ghost" data-cancel>Cancel</button>
        <button class="btn primary" data-confirm>${escapeHtml(confirmText)}</button>`,
      onMount: (root, doClose) => {
        const input = root.querySelector("[data-prompt-input]");
        input.focus();
        input.select();
        const submit = () => { doClose(); resolve(input.value); };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
        root.querySelector("[data-cancel]").addEventListener("click", () => { doClose(); resolve(null); });
        root.querySelector("[data-confirm]").addEventListener("click", submit);
      },
    });
  });
}
