import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "gee.theme";
const listeners = new Set<() => void>();
const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let pref: ThemePref = typeof window === "undefined" ? "system" : readPref();
/** El panel de administración siempre va en claro. */
let forceLight = false;

export const resolved = () => (pref === "system" ? (media?.matches ? "dark" : "light") : pref);

function apply() {
  if (typeof document === "undefined") return;
  const dark = !forceLight && resolved() === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#ffffff");
  listeners.forEach((l) => l());
}

media?.addEventListener("change", () => pref === "system" && apply());

export function setTheme(next: ThemePref) {
  pref = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* almacenamiento bloqueado: el cambio dura hasta recargar */
  }
  apply();
}

/** Alterna entre claro y oscuro partiendo de lo que se ve ahora. */
export function toggleTheme() {
  setTheme(resolved() === "dark" ? "light" : "dark");
}

export function setForceLight(v: boolean) {
  if (forceLight === v) return;
  forceLight = v;
  apply();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useTheme() {
  return useSyncExternalStore(subscribe, () => (!forceLight && resolved() === "dark" ? "dark" : "light"));
}
