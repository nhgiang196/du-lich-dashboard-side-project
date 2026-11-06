import { PLAN_BASE, SWAP17, SWAP18 } from "../data/tripData";
import type { PlanItem, PlanVariant } from "../types";

export function buildPlan(variant: PlanVariant): PlanItem[] {
  if (variant === "swap") {
    return PLAN_BASE.filter((p) => p.d < 17).concat(
      SWAP17,
      SWAP18,
      PLAN_BASE.filter((p) => p.d > 18),
    );
  }
  return PLAN_BASE;
}

export function pk(p: PlanItem): string {
  return `${p.d}|${p.b}|${p.a}`;
}

export function queryWithCity(loc: string): string {
  return /Đà Lạt|Dalat|Da Lat|Thủ Dầu Một/i.test(loc) ? loc : `${loc} Đà Lạt`;
}

export function mapUrl(loc: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryWithCity(loc))}`;
}

export function routeUrl(plan: PlanItem[], day: number): string | null {
  const stops: string[] = [];
  for (const p of plan) {
    if (p.d === day && p.p && !stops.includes(p.p)) {
      stops.push(p.p);
    }
  }
  if (stops.length < 2) return null;
  const mid = stops.slice(1, -1).slice(0, 8);
  const origin = encodeURIComponent(queryWithCity(stops[0]));
  const dest = encodeURIComponent(queryWithCity(stops[stops.length - 1]));
  const waypoints = mid.length
    ? `&waypoints=${encodeURIComponent(mid.map(queryWithCity).join("|"))}`
    : "";
  return `https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&origin=${origin}&destination=${dest}${waypoints}`;
}
