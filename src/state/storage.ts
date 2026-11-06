import { TODO } from "../data/tripData";
import type { TripState } from "../types";

export const STORAGE_KEY = "dalat-trip-v7";

export function createDefaultState(): TripState {
  const defaultTodo: Record<number, boolean> = {};
  for (let i = 0; i < TODO.length; i++) {
    defaultTodo[i] = true;
  }
  return {
    done: {},
    todo: defaultTodo,
    pack: {},
    thr: 60,
    val: {},
    on: {},
    keep: "faru",
    variant: "base",
  };
}

export function loadState(): TripState {
  const base = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<TripState>;
    return {
      done: parsed.done || {},
      todo: parsed.todo || {},
      pack: parsed.pack || {},
      thr: parsed.thr || 60,
      val: parsed.val || {},
      on: parsed.on || {},
      keep: parsed.keep || "faru",
      variant: parsed.variant || "base",
    };
  } catch {
    return base;
  }
}

export function saveState(state: TripState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}
