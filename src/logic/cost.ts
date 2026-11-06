import { LINES } from "../data/tripData";
import type { CostGroup, CostLine, TripState } from "../types";

export const BUDGET_MAX = 8_000_000;

export function lineVal(l: CostLine, state: TripState): number | null {
  return state.val[l.id] != null ? state.val[l.id] : l.v;
}

export function lineActive(l: CostLine, state: TripState): boolean {
  if (l.hotel) return l.hotel === state.keep || state.keep === "both";
  if (l.opt) return Boolean(state.on[l.id]);
  return true;
}

export function dayMeals(d: number, state: TripState): number | null {
  let sum = 0;
  let has = false;
  for (const l of LINES) {
    if (l.day === d && l.g === "Ăn uống") {
      const val = lineVal(l, state);
      if (val != null) {
        sum += val;
        has = true;
      }
    }
  }
  return has ? sum : null;
}

export interface CostSummary {
  total: number;
  byGroup: Record<CostGroup, number>;
  missing: string[];
  budget: number;
  pct: number;
  perPerson: number;
}

export function calculateCostSummary(state: TripState): CostSummary {
  const groups: CostGroup[] = ["Đã đặt", "Ước tính", "Ăn uống"];
  const byGroup: Record<CostGroup, number> = {
    "Đã đặt": 0,
    "Ước tính": 0,
    "Ăn uống": 0,
  };
  const missing: string[] = [];
  let total = 0;

  for (const g of groups) {
    let sub = 0;
    for (const l of LINES.filter((x) => x.g === g)) {
      const active = lineActive(l, state);
      const v = lineVal(l, state);
      if (active && v != null) sub += v;
      if (active && v == null && !l.opt) missing.push(l.n);
    }
    byGroup[g] = sub;
    total += sub;
  }

  return {
    total,
    byGroup,
    missing,
    budget: BUDGET_MAX,
    pct: Math.min(100, (total / BUDGET_MAX) * 100),
    perPerson: total / 2,
  };
}
