import { PACK, TODO } from "../data/tripData";
import type { PlanVariant, TripState, WeatherCache } from "../types";

export const STORAGE_KEY = "dalat-trip-v7";
export const WEATHER_CACHE_KEY = "dalat-trip-weather-v1";
export const SYNC_PREFIX = "dl1.";

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
      todo: parsed.todo || base.todo,
      pack: parsed.pack || {},
      thr: typeof parsed.thr === "number" ? parsed.thr : 60,
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

export function loadWeatherCache(): WeatherCache | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WeatherCache>;
    if (
      !parsed ||
      !Array.isArray(parsed.days) ||
      parsed.days.length === 0 ||
      typeof parsed.forecast !== "boolean" ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }
    return {
      days: parsed.days,
      forecast: parsed.forecast,
      years: typeof parsed.years === "number" ? parsed.years : undefined,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveWeatherCache(cache: WeatherCache): void {
  try {
    // Do not overwrite a cached real forecast with multi-year climate averages
    if (!cache.forecast) {
      const existing = loadWeatherCache();
      if (existing?.forecast) return;
    }
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

interface SyncPayloadV1 {
  v: 1;
  d?: string[];
  t?: number[];
  p?: number[];
  r?: number;
  val?: Record<string, number>;
  on?: string[];
  k?: "faru" | "tala" | "both";
  vr?: PlanVariant;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "===".slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSyncState(state: TripState): string {
  const doneKeys = Object.keys(state.done).filter((k) => state.done[k]);
  const todoIdxs: number[] = [];
  for (let i = 0; i < TODO.length; i++) {
    if (state.todo[i]) todoIdxs.push(i);
  }
  const packIdxs: number[] = [];
  for (let i = 0; i < PACK.length; i++) {
    if (state.pack[i]) packIdxs.push(i);
  }
  const onKeys = Object.keys(state.on).filter((k) => state.on[k]);
  const valEntries: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.val)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      valEntries[k] = v;
    }
  }

  const payload: SyncPayloadV1 = {
    v: 1,
    d: doneKeys.length ? doneKeys : undefined,
    t: todoIdxs,
    p: packIdxs.length ? packIdxs : undefined,
    r: state.thr !== 60 ? state.thr : undefined,
    val: Object.keys(valEntries).length ? valEntries : undefined,
    on: onKeys.length ? onKeys : undefined,
    k: state.keep !== "faru" ? state.keep : undefined,
    vr: state.variant !== "base" ? state.variant : undefined,
  };

  return `${SYNC_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

function extractToken(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const syncMatch = /[?&]sync=([^&#\s]+)/.exec(trimmed);
  const candidate = syncMatch ? decodeURIComponent(syncMatch[1]) : trimmed;

  if (candidate.startsWith(SYNC_PREFIX)) {
    return candidate.slice(SYNC_PREFIX.length);
  }
  return candidate;
}

export function decodeSyncState(rawInput: string): TripState | null {
  const token = extractToken(rawInput);
  if (!token) return null;

  try {
    const json = fromBase64Url(token);
    const parsed = JSON.parse(json) as Partial<SyncPayloadV1>;
    if (!parsed || parsed.v !== 1) return null;

    const next = createDefaultState();

    if (Array.isArray(parsed.d)) {
      for (const k of parsed.d) {
        if (typeof k === "string" && k) next.done[k] = true;
      }
    }

    if (Array.isArray(parsed.t)) {
      next.todo = {};
      for (const idx of parsed.t) {
        if (typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < TODO.length) {
          next.todo[idx] = true;
        }
      }
    }

    if (Array.isArray(parsed.p)) {
      for (const idx of parsed.p) {
        if (typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < PACK.length) {
          next.pack[idx] = true;
        }
      }
    }

    if (typeof parsed.r === "number" && parsed.r >= 20 && parsed.r <= 90) {
      next.thr = parsed.r;
    }

    if (parsed.val && typeof parsed.val === "object") {
      for (const [k, v] of Object.entries(parsed.val)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
          next.val[k] = v;
        }
      }
    }

    if (Array.isArray(parsed.on)) {
      for (const k of parsed.on) {
        if (typeof k === "string" && k) next.on[k] = true;
      }
    }

    if (parsed.k === "faru" || parsed.k === "tala" || parsed.k === "both") {
      next.keep = parsed.k;
    }

    if (parsed.vr === "base" || parsed.vr === "swap") {
      next.variant = parsed.vr;
    }

    return next;
  } catch {
    return null;
  }
}

export function mergeTripStates(current: TripState, incoming: TripState): TripState {
  const done: Record<string, boolean> = { ...current.done };
  for (const [k, v] of Object.entries(incoming.done)) {
    if (v) done[k] = true;
  }

  const todo: Record<number, boolean> = { ...current.todo };
  for (let i = 0; i < TODO.length; i++) {
    todo[i] = Boolean(current.todo[i] || incoming.todo[i]);
  }

  const pack: Record<number, boolean> = { ...current.pack };
  for (let i = 0; i < PACK.length; i++) {
    if (incoming.pack[i]) pack[i] = true;
  }

  const on: Record<string, boolean> = { ...current.on };
  for (const [k, v] of Object.entries(incoming.on)) {
    if (v) on[k] = true;
  }

  return {
    done,
    todo,
    pack,
    thr: incoming.thr,
    val: { ...current.val, ...incoming.val },
    on,
    keep: incoming.keep,
    variant: incoming.variant,
  };
}

export function buildSyncUrl(state: TripState, baseHref?: string): string {
  const code = encodeSyncState(state);
  try {
    const u = new URL(baseHref ?? window.location.href);
    u.searchParams.set("sync", code);
    return u.toString();
  } catch {
    return `?sync=${encodeURIComponent(code)}`;
  }
}
