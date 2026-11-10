import { beforeEach, describe, expect, it } from "vitest";
import { BOOK } from "../data/tripData";
import { contrast, suggestFor, vis } from "../logic/color";
import { BUDGET_MAX, calculateCostSummary, dayMeals, lineActive } from "../logic/cost";
import { buildPlan, queryWithCity, routeUrl } from "../logic/plan";
import { applyWeatherCache, cloudLabel, cloudScore, mergeRainModels, slotRain } from "../logic/weather";
import { shouldShowInstallHint } from "../ui/installHint";
import {
  buildSyncUrl,
  createDefaultState,
  decodeSyncState,
  encodeSyncState,
  loadWeatherCache,
  mergeTripStates,
  saveWeatherCache,
} from "../state/storage";
import type { CostLine, DailyWeather, WeatherState } from "../types";

const memoryStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, val: string) => {
    memoryStore.set(key, val);
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  clear: () => {
    memoryStore.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  configurable: true,
  writable: true,
});

describe("Đà Lạt Trip Logic", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("calculates baseline trip cost and per-person split (5,872,000 VND / 2 = 2,936,000 VND)", () => {
    const state = createDefaultState();
    const summary = calculateCostSummary(state);
    expect(summary.total).toBe(5_872_000);
    expect(summary.perPerson).toBe(2_936_000);
    expect(summary.byGroup["Đã đặt"]).toBe(2_992_000);
    expect(summary.byGroup["Ước tính"]).toBe(680_000);
    expect(summary.byGroup["Ăn uống"]).toBe(2_200_000);
    expect(summary.missing).toContain("Ăn uống và mua đặc sản 19/11");
    expect(dayMeals(17, state)).toBe(750_000);
  });

  it("handles custom cost overrides, optional items, hotel filter, and budget cap", () => {
    const state = createDefaultState();
    state.on.cam = true;
    state.val.m19 = 648_000;

    const summary = calculateCostSummary(state);
    expect(summary.total).toBe(6_870_000);
    expect(summary.perPerson).toBe(3_435_000);
    expect(summary.missing).toHaveLength(0);
    expect(dayMeals(19, state)).toBe(648_000);

    // Over-budget cap at 100%
    state.val.m19 = 2_500_000;
    const overSummary = calculateCostSummary(state);
    expect(overSummary.total).toBeGreaterThan(BUDGET_MAX);
    expect(overSummary.pct).toBe(100);

    // Hotel active filter
    const talaLine: CostLine = { id: "tala", n: "Tala", g: "Đã đặt", v: 782_000, hotel: "tala" };
    expect(lineActive(talaLine, state)).toBe(false);
    state.keep = "both";
    expect(lineActive(talaLine, state)).toBe(true);
  });

  it("includes updated itinerary locations and swaps cloud hunting days accurately", () => {
    const basePlan = buildPlan("base");
    const swapPlan = buildPlan("swap");

    const first17Base = basePlan.find((p) => p.d === 17);
    const first17Swap = swapPlan.find((p) => p.d === 17);
    expect(first17Base?.p).toContain("Cầu Đất");
    expect(first17Swap?.p).toContain("Đa Phú");

    // Verify newly updated places from user's schedule
    expect(basePlan.some((p) => p.p.includes("Kim Ngoc Resort Cu Chi"))).toBe(true);
    expect(basePlan.some((p) => p.p.includes("Tanoshi"))).toBe(true);
    expect(basePlan.some((p) => p.p.includes("Nhà Của Thông"))).toBe(true);
    expect(basePlan.some((p) => p.p.includes("Đồi cỏ hồng Măng Lin"))).toBe(true);
    expect(basePlan.some((p) => p.p.includes("DEEM (ĐÊM) Cocktail Bar"))).toBe(true);
    expect(basePlan.some((p) => p.p.includes("Ở Đây Có Một Con Mèo"))).toBe(true);
    expect(basePlan.some((p) => p.p.includes("Bến xe Liên tỉnh Đà Lạt"))).toBe(true);

    // Củ Chi and Thủ Dầu Một should not have "Đà Lạt" appended
    expect(queryWithCity("Kim Ngoc Resort Cu Chi")).toBe("Kim Ngoc Resort Cu Chi");
    expect(queryWithCity("Thế Giới Di Động Chợ Cây Dừa Thủ Dầu Một")).toBe(
      "Thế Giới Di Động Chợ Cây Dừa Thủ Dầu Một",
    );
    expect(queryWithCity("Đồi cỏ hồng Măng Lin")).toBe("Đồi cỏ hồng Măng Lin Đà Lạt");

    // Verify updated booking statuses (early check-in 16/11 and dinner 17/11 are done)
    const early16 = BOOK.find((b) => b.n.includes("16/11") && b.n.includes("nhận phòng sớm"));
    const dinner17 = BOOK.find((b) => b.n.includes("ăn tối ngày 2"));
    expect(early16?.st).toBe("done");
    expect(dinner17?.st).toBe("done");

    const url17 = routeUrl(basePlan, 17);
    expect(url17).toContain("google.com/maps/dir/");
  });

  it("scores ideal, moderate, and poor morning cloud-hunting conditions accurately", () => {
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

    const idealRes = cloudScore(idealDay);
    expect(idealRes?.score).toBe(100);
    expect(cloudLabel(idealRes?.score ?? 0)).toEqual(["Khả năng cao", "good"]);

    const moderateDay: DailyWeather = {
      ...idealDay,
      date: "2026-11-18",
      hours: {
        5: { temp: 16.0, rh: 82, dew: 13.8, chigh: 60, wind: 12, pp: 25 },
        6: { temp: 16.5, rh: 82, dew: 14.3, chigh: 60, wind: 12, pp: 30 },
        7: { temp: 17.0, rh: 82, dew: 14.8, chigh: 60, wind: 12, pp: 20 },
      },
    };
    const modRes = cloudScore(moderateDay);
    expect(modRes?.score).toBe(49);
    expect(cloudLabel(modRes?.score ?? 0)).toEqual(["Trung bình", ""]);

    const stormyDay: DailyWeather = {
      ...idealDay,
      hours: {
        5: { temp: 18.0, rh: 65, dew: 13.0, chigh: 90, wind: 22, pp: 75 },
        6: { temp: 18.5, rh: 65, dew: 13.5, chigh: 95, wind: 25, pp: 80 },
      },
    };
    const stormyRes = cloudScore(stormyDay);
    expect(stormyRes?.score).toBe(0);
    expect(cloudLabel(stormyRes?.score ?? 0)).toEqual(["Thấp", "warn"]);
    expect(cloudScore({ ...idealDay, hours: null })).toBeNull();
  });

  it("computes slotRain per time slot and evaluates Plan B threshold", () => {
    const dayWithAfternoonRain: DailyWeather = {
      date: "2026-11-16",
      tmax: 23,
      tmin: 15,
      rain: 4.5,
      rainProb: 70,
      code: 61,
      sunrise: "2026-11-16T05:55",
      sunset: "2026-11-16T17:25",
      hours: {
        6: { temp: 15, rh: 90, dew: 14, chigh: 20, wind: 5, pp: 15 },
        9: { temp: 19, rh: 78, dew: 15, chigh: 30, wind: 8, pp: 25 },
        15: { temp: 21, rh: 85, dew: 18, chigh: 70, wind: 12, pp: 65 },
        16: { temp: 20, rh: 88, dew: 18, chigh: 80, wind: 14, pp: 75 },
        19: { temp: 17, rh: 90, dew: 15, chigh: 50, wind: 6, pp: 40 },
      },
    };

    const days = [dayWithAfternoonRain];
    expect(slotRain(days, 16, "Sáng")).toBe(25);
    expect(slotRain(days, 16, "Chiều")).toBe(75);
    expect(slotRain(days, 16, "Tối")).toBe(40);

    // At default threshold 60%, Afternoon (75%) triggers Plan B, Morning (25%) does not
    const state = createDefaultState();
    expect((slotRain(days, 16, "Chiều") ?? 0) >= state.thr).toBe(true);
    expect((slotRain(days, 16, "Sáng") ?? 0) >= state.thr).toBe(false);

    // If threshold is lowered to 35%, Evening (40%) also triggers Plan B
    state.thr = 35;
    expect((slotRain(days, 16, "Tối") ?? 0) >= state.thr).toBe(true);

    // Fallback to daily rainProb when hours is null (climate average)
    const climateDay: DailyWeather = { ...dayWithAfternoonRain, hours: null, rainProb: 52 };
    expect(slotRain([climateDay], 16, "Sáng")).toBe(52);
  });

  it("evaluates outfit color visibility and generates 3 partner suggestions", () => {
    const [label, badge] = vis("#efe6d2", "#3f5a3a");
    expect(label).toBe("nổi");
    expect(badge).toBe("good");
    expect(contrast("#efe6d2", "#3f5a3a")).toBeGreaterThan(3);

    const suggestions = suggestFor("#6b4a2f");
    expect(suggestions).toHaveLength(3);
  });

  it("caches last forecast for offline viewing and protects forecast from climate overwrite", () => {
    const sampleDay: DailyWeather = {
      date: "2026-11-17",
      tmax: 23,
      tmin: 15,
      rain: 0.2,
      rainProb: 15,
      code: 1,
      sunrise: "2026-11-17T05:55",
      sunset: "2026-11-17T17:25",
      hours: {
        6: { temp: 15, rh: 94, dew: 14.2, chigh: 15, wind: 4, pp: 10 },
      },
    };

    saveWeatherCache({
      days: [sampleDay],
      forecast: true,
      savedAt: "2026-11-15T14:00:00.000Z",
    });

    // Attempting to save non-forecast climate average should not overwrite real forecast cache
    saveWeatherCache({
      days: [{ ...sampleDay, hours: null }],
      forecast: false,
      years: 8,
      savedAt: "2026-11-15T15:00:00.000Z",
    });

    const cached = loadWeatherCache();
    expect(cached).not.toBeNull();
    expect(cached?.forecast).toBe(true);
    expect(cached?.days[0].hours?.[6]?.rh).toBe(94);

    const weatherState: WeatherState = {
      days: null,
      label: "Đang tải…",
      forecast: false,
      note: "",
      err: "",
    };
    if (cached) applyWeatherCache(weatherState, cached);
    expect(weatherState.cached).toBe(true);
    expect(weatherState.label).toBe("Dự báo (đã lưu)");
    expect(weatherState.forecast).toBe(true);
  });

  it("encodes, decodes, and merges trip state across 2 devices via sync code or URL", () => {
    const personA = createDefaultState();
    personA.done["16|Sáng|Đến Đà Lạt"] = true;
    personA.pack[0] = true;
    personA.val.m19 = 450_000;
    personA.variant = "swap";
    personA.thr = 55;

    const code = encodeSyncState(personA);
    expect(code.startsWith("dl1.")).toBe(true);

    const shareUrl = buildSyncUrl(personA, "https://dalat-trip.vercel.app/#plan");
    expect(shareUrl).toContain("sync=dl1.");

    const decodedFromCode = decodeSyncState(code);
    const decodedFromUrl = decodeSyncState(shareUrl);
    expect(decodedFromCode).toEqual(personA);
    expect(decodedFromUrl).toEqual(personA);

    const personB = createDefaultState();
    personB.done["16|Tối|Ăn tối lẩu mực lá é"] = true;
    personB.pack[2] = true;
    personB.on.cam = true;

    const merged = mergeTripStates(personB, personA);
    expect(merged.done["16|Sáng|Đến Đà Lạt"]).toBe(true);
    expect(merged.done["16|Tối|Ăn tối lẩu mực lá é"]).toBe(true);
    expect(merged.pack[0]).toBe(true);
    expect(merged.pack[2]).toBe(true);
    expect(merged.on.cam).toBe(true);
    expect(merged.val.m19).toBe(450_000);
    expect(merged.variant).toBe("swap");
    expect(merged.thr).toBe(55);
  });
});

describe("installHint", () => {
  const safari = {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    platform: "iPhone",
    maxTouchPoints: 5,
    standalone: false,
  };
  it("shows on iOS Safari first visit", () => {
    expect(shouldShowInstallHint(safari, false)).toBe(true);
  });
  it("hides when seen, standalone, or non-Safari", () => {
    expect(shouldShowInstallHint(safari, true)).toBe(false);
    expect(shouldShowInstallHint({ ...safari, standalone: true }, false)).toBe(false);
    expect(shouldShowInstallHint({ ...safari, userAgent: `${safari.userAgent} CriOS/120` }, false)).toBe(false);
    expect(shouldShowInstallHint({ ...safari, userAgent: "Windows Chrome", platform: "Win32" }, false)).toBe(false);
  });
});

describe("rain consensus", () => {
  it("merges models by median and agreement", () => {
    const r = mergeRainModels(["t0", "t1"], [[0, 1], [0, 3], [0.5, 0]]);
    expect(r.t0.mm).toBe(0);
    expect(r.t0.pp).toBe(33);
    expect(r.t1.mm).toBe(1);
    expect(r.t1.pp).toBe(67);
  });
});
