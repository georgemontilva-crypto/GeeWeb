import { useSyncExternalStore } from "react";

export type CartLine = { variantId: number; quantity: number };
type State = { lines: CartLine[]; open: boolean };

const KEY = "gee.cart.v1";
const MAX_QTY = 20;

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => Number.isInteger(l?.variantId) && Number.isInteger(l?.quantity) && l.quantity > 0)
      .map((l) => ({ variantId: l.variantId, quantity: Math.min(MAX_QTY, l.quantity) }));
  } catch {
    return [];
  }
}

let state: State = { lines: typeof localStorage === "undefined" ? [] : load(), open: false };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.lines) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.lines));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) set({ lines: load() });
  });
}

export const cart = {
  add(variantId: number, quantity = 1) {
    const found = state.lines.find((l) => l.variantId === variantId);
    const lines = found
      ? state.lines.map((l) =>
          l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l,
        )
      : [...state.lines, { variantId, quantity: Math.min(MAX_QTY, quantity) }];
    set({ lines, open: true });
  },
  setQuantity(variantId: number, quantity: number) {
    if (quantity <= 0) return cart.remove(variantId);
    set({
      lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    });
  },
  remove(variantId: number) {
    set({ lines: state.lines.filter((l) => l.variantId !== variantId) });
  },
  clear() {
    set({ lines: [] });
  },
  open() {
    set({ open: true });
  },
  close() {
    set({ open: false });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useCart() {
  const s = useSyncExternalStore(subscribe, () => state);
  return { ...s, count: s.lines.reduce((n, l) => n + l.quantity, 0) };
}
