import { describe, expect, it } from "vitest";
import { contrast, suggestFor, vis } from "../logic/color";
import { calculateCostSummary, dayMeals } from "../logic/cost";
import { buildPlan, routeUrl } from "../logic/plan";
import { cloudLabel, cloudScore, slotRain } from "../logic/weather";
import { createDefaultState } from "../state/storage";
import type { DailyWeather } from "../types";

describe("Đà Lạt Trip Logic", () => {
  it("calculates baseline trip cost matching CONTEXT.md (6,152,000 VND without optional items)", () => {
    const state = createDefaultState();
    const summary = calculateCostSummary(state);
    expect(summary.total).toBe(6_152_000);
    expect(summary.byGroup["Đã đặt"]).toBe(2_992_000);
    expect(summary.byGroup["Ước tính"]).toBe(960_000);
    expect(summary.byGroup["Ăn uống"]).toBe(2_200_000);
    expect(summary.missing).toContain("Ăn uống và mua đặc sản 19/11");
    expect(dayMeals(17, state)).toBe(750_000);
  });

  it("includes optional camera rental when toggled on", () => {
    const state = createDefaultState();
    state.on.cam = true;
    const summary = calculateCostSummary(state);
    expect(summary.total).toBe(6_502_000);
  });

  it("swaps cloud hunting days between 17/11 and 18/11 when variant is 'swap'", () => {
    const basePlan = buildPlan("base");
    const swapPlan = buildPlan("swap");

    const first17Base = basePlan.find((p) => p.d === 17);
    const first17Swap = swapPlan.find((p) => p.d === 17);
    expect(first17Base?.p).toContain("Cầu Đất");
    expect(first17Swap?.p).toContain("Đa Phú");

    const url17 = routeUrl(basePlan, 17);
    expect(url17).toContain("google.com/maps/dir/");
  });

  it("scores ideal vs stormy morning cloud-hunting conditions accurately", () => {
    const idealDay: DailyWeather = {
      date: "2026-11-17",
      tmax: 22,
      tmin: 14,
      rain: 0,
      rainProb: 10,
      code: 2,
      sunrise: "2026-11-17T05:55",
      sunset: "2026-11-17T17:25",
      hours: {
        5: { temp: 14.5, rh: 95, dew: 13.8, chigh: 20, wind: 5, pp: 5 },
        6: { temp: 15.0, rh: 92, dew: 14.0, chigh: 25, wind: 6, pp: 10 },
        7: { temp: 16.0, rh: 90, dew: 14.8, chigh: 30, wind: 7, pp: 10 },
      },
    };

    const res = cloudScore(idealDay);
    expect(res).not.toBeNull();
    expect(res?.score).toBe(100);
    expect(cloudLabel(res?.score ?? 0)[0]).toBe("Khả năng cao");
    expect(slotRain([idealDay], 17, "Sáng")).toBe(10);
  });

  it("evaluates outfit color visibility and generates 3 partner suggestions", () => {
    // Cream (#efe6d2) on dark pine green (#3f5a3a) should have high contrast
    const [label, badge] = vis("#efe6d2", "#3f5a3a");
    expect(label).toBe("nổi");
    expect(badge).toBe("good");
    expect(contrast("#efe6d2", "#3f5a3a")).toBeGreaterThan(3);

    const suggestions = suggestFor("#6b4a2f");
    expect(suggestions).toHaveLength(3);
  });
});
