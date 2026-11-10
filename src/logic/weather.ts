import { CLIMATE_YEARS, DAYS, LAT, LON, SLOTS, TZ } from "../data/tripData";
import type {
  CloudScoreResult,
  DailyWeather,
  HourlyWeather,
  TimeSlot,
  WeatherCache,
  WeatherState,
} from "../types";

export function formatSavedTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export function applyWeatherCache(weather: WeatherState, cache: WeatherCache): void {
  weather.days = cache.days;
  weather.forecast = cache.forecast;
  weather.cached = true;
  weather.savedAt = cache.savedAt;
  weather.err = "";
  const timeStr = formatSavedTime(cache.savedAt);
  if (cache.forecast) {
    weather.label = "Dự báo (đã lưu)";
    weather.note = `Đang xem bản lưu dự báo lúc ${timeStr} (dùng khi mất sóng / ngoại tuyến).`;
  } else {
    weather.label = "Trung bình nhiều năm (đã lưu)";
    weather.note = `Đang xem dữ liệu trung bình ${cache.years ?? 8} năm đã lưu lúc ${timeStr} (ngoại tuyến).`;
  }
}

export function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
}

export function weatherIcon(code: number | null): string {
  if (code == null) return "🌤️";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌥️";
}

export function cloudScore(day: DailyWeather | null | undefined): CloudScoreResult | null {
  if (!day || !day.hours) return null;
  const hs = [5, 6, 7].map((h) => day.hours?.[h]).filter((x): x is HourlyWeather => Boolean(x));
  if (!hs.length) return null;

  const hum = avg(hs.map((x) => x.rh).filter((v) => v != null));
  const spread = avg(hs.map((x) => x.temp - x.dew).filter((v) => !Number.isNaN(v)));
  const wind = avg(hs.map((x) => x.wind).filter((v) => v != null));
  const rain = Math.max(...hs.map((x) => x.pp || 0));
  const high = avg(hs.map((x) => x.chigh).filter((v) => v != null));

  let sc = 0;
  if (hum != null) sc += hum >= 90 ? 30 : hum >= 80 ? 20 : hum >= 70 ? 10 : 0;
  if (spread != null) sc += spread <= 1.5 ? 25 : spread <= 3 ? 12 : 0;
  if (wind != null) sc += wind <= 8 ? 20 : wind <= 15 ? 10 : 0;
  sc += rain <= 20 ? 15 : rain <= 40 ? 7 : 0;
  if (high != null) sc += high <= 50 ? 10 : 0;

  return { score: sc, hum, spread, wind, rain, high };
}

export function cloudLabel(sc: number): [string, "good" | "" | "warn"] {
  if (sc >= 70) return ["Khả năng cao", "good"];
  if (sc >= 45) return ["Trung bình", ""];
  return ["Thấp", "warn"];
}

export function findWeatherDay(days: DailyWeather[] | null, dayNum: number): DailyWeather | null {
  if (!days) return null;
  for (const d of days) {
    if (Number(d.date.slice(8)) === dayNum) return d;
  }
  return null;
}

export interface SlotRainInfo {
  /** Xác suất mưa (%) cao nhất trong khung giờ */
  prob: number;
  /** Tổng lượng mưa (mm) trong khung giờ, null nếu không có dữ liệu theo giờ */
  mm: number | null;
}

export function slotRainInfo(
  days: DailyWeather[] | null,
  dayNum: number,
  buoi: TimeSlot,
): SlotRainInfo | null {
  const w = findWeatherDay(days, dayNum);
  if (!w) return null;
  const r = SLOTS[buoi];
  if (w.hours && r) {
    const vals: number[] = [];
    let mm = 0;
    let hasMm = false;
    for (let h = r[0]; h <= r[1]; h++) {
      const hourData = w.hours[h];
      if (!hourData) continue;
      if (hourData.pp != null) vals.push(hourData.pp);
      if (hourData.mm != null) {
        mm += hourData.mm;
        hasMm = true;
      }
    }
    if (vals.length) return { prob: Math.max(...vals), mm: hasMm ? mm : null };
  }
  return w.rainProb == null ? null : { prob: w.rainProb, mm: null };
}

export function slotRain(
  days: DailyWeather[] | null,
  dayNum: number,
  buoi: TimeSlot,
): number | null {
  return slotRainInfo(days, dayNum, buoi)?.prob ?? null;
}

export function rainLevel(info: SlotRainInfo): [string, "" | "good" | "warn"] {
  const { prob, mm } = info;
  if (mm != null) {
    if (mm >= 8) return ["Mưa to", "warn"];
    if (mm >= 2) return ["Có mưa", "warn"];
    if (mm >= 0.3 || prob >= 40) return ["Ít mưa", ""];
    return ["Khô ráo", "good"];
  }
  if (prob >= 70) return ["Dễ mưa", "warn"];
  if (prob >= 40) return ["Có thể mưa", ""];
  return ["Ít khả năng mưa", "good"];
}

export function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const RAIN_MODELS = ["best_match", "ecmwf_ifs025", "gfs_seamless", "icon_seamless"];
const RAIN_HOUR_MM = 0.2;

interface RainModelsResponse {
  hourly?: { time: string[] } & Record<string, (number | null)[] | string[]>;
}

/** Gộp lượng mưa theo giờ từ nhiều model: mm = median, pp = % model đồng thuận có mưa. */
export function mergeRainModels(
  time: string[],
  series: (number | null)[][],
): Record<string, { mm: number; pp: number }> {
  const out: Record<string, { mm: number; pp: number }> = {};
  for (let k = 0; k < time.length; k++) {
    const vals = series.map((s) => s[k]).filter((v): v is number => v != null);
    if (!vals.length) continue;
    out[time[k]] = {
      mm: median(vals) ?? 0,
      pp: Math.round((vals.filter((v) => v >= RAIN_HOUR_MM).length / vals.length) * 100),
    };
  }
  return out;
}

async function loadRainConsensus(): Promise<Record<string, { mm: number; pp: number }> | null> {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=precipitation&models=${RAIN_MODELS.join(",")}&timezone=${encodeURIComponent(TZ)}&start_date=${DAYS[0]}&end_date=${DAYS[3]}`;
    const j = await fetchJson<RainModelsResponse>(u);
    const h = j.hourly;
    if (!h || !h.time) return null;
    const series = RAIN_MODELS.map(
      (m) => h[`precipitation_${m}`] as (number | null)[] | undefined,
    ).filter((x): x is (number | null)[] => Array.isArray(x));
    if (series.length < 2) return null;
    return mergeRainModels(h.time as string[], series);
  } catch {
    return null;
  }
}

interface OpenMeteoForecastResponse {
  daily?: {
    time?: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max: (number | null)[];
    weathercode: (number | null)[];
    sunrise: (string | null)[];
    sunset: (string | null)[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    cloud_cover_high: number[];
    wind_speed_10m: number[];
    precipitation_probability: number[];
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export async function loadForecast(): Promise<DailyWeather[]> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,sunrise,sunset&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,cloud_cover_high,wind_speed_10m,precipitation_probability&timezone=${encodeURIComponent(TZ)}&start_date=${DAYS[0]}&end_date=${DAYS[3]}`;

  const [j, rainMap] = await Promise.all([
    fetchJson<OpenMeteoForecastResponse>(u),
    loadRainConsensus(),
  ]);
  const daily = j.daily;
  const times = daily?.time;
  if (!daily || !times || !times.length) {
    throw new Error("none");
  }
  const H = j.hourly || {
    time: [],
    temperature_2m: [],
    relative_humidity_2m: [],
    dew_point_2m: [],
    cloud_cover_high: [],
    wind_speed_10m: [],
    precipitation_probability: [],
  };

  return times.map((date, i) => {
    const hours: Record<number, HourlyWeather> = {};
    for (let k = 0; k < H.time.length; k++) {
      const ts = H.time[k];
      if (ts.slice(0, 10) === date) {
        const hour = Number.parseInt(ts.slice(11, 13), 10);
        const rc = rainMap?.[ts];
        hours[hour] = {
          temp: H.temperature_2m[k],
          rh: H.relative_humidity_2m[k],
          dew: H.dew_point_2m[k],
          chigh: H.cloud_cover_high[k],
          wind: H.wind_speed_10m[k],
          pp: rc ? rc.pp : H.precipitation_probability[k],
          ...(rc ? { mm: rc.mm } : {}),
        };
      }
    }
    let rainProb = daily.precipitation_probability_max[i];
    let rainSum = daily.precipitation_sum[i];
    if (rainMap) {
      const day = Object.entries(hours).filter(([h]) => Number(h) >= 6 && Number(h) <= 21);
      const pps = day.map(([, v]) => v.pp);
      if (pps.length) rainProb = Math.round(Math.max(avg(pps) ?? 0, 0));
      rainSum = Object.values(hours).reduce((a, v) => a + (v.mm ?? 0), 0);
    }
    return {
      date,
      tmax: daily.temperature_2m_max[i],
      tmin: daily.temperature_2m_min[i],
      rain: rainSum,
      rainProb,
      code: daily.weathercode[i],
      sunrise: daily.sunrise[i],
      sunset: daily.sunset[i],
      hours,
    };
  });
}

export async function loadClimate(): Promise<{ years: number; days: DailyWeather[] }> {
  const reqs = CLIMATE_YEARS.map((y) => {
    const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset&timezone=${encodeURIComponent(TZ)}&start_date=${y}-11-16&end_date=${y}-11-19`;
    return fetchJson<OpenMeteoForecastResponse>(u).catch(() => null);
  });

  const list = await Promise.all(reqs);
  const ok = list.filter((x): x is OpenMeteoForecastResponse => Boolean(x));
  if (!ok.length) throw new Error("none");

  return {
    years: ok.length,
    days: DAYS.map((date, i) => {
      const tx: number[] = [];
      const tn: number[] = [];
      const rn: number[] = [];
      let wet = 0;
      let sr: string | null = null;
      let ss: string | null = null;

      for (const j of ok) {
        const d = j.daily;
        if (!d || !d.time || d.time[i] == null) continue;
        const maxVal = d.temperature_2m_max[i];
        const minVal = d.temperature_2m_min[i];
        const rainVal = d.precipitation_sum[i];
        if (maxVal != null) tx.push(maxVal);
        if (minVal != null) tn.push(minVal);
        if (rainVal != null) {
          rn.push(rainVal);
          if (rainVal >= 1) wet++;
        }
        sr = d.sunrise[i];
        ss = d.sunset[i];
      }

      return {
        date,
        tmax: avg(tx),
        tmin: avg(tn),
        rain: avg(rn),
        rainProb: rn.length ? (wet / rn.length) * 100 : null,
        code: null,
        sunrise: sr,
        sunset: ss,
        hours: null,
      };
    }),
  };
}
