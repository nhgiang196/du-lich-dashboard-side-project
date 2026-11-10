export type TimeSlot = "Sáng" | "Trưa" | "Chiều" | "Tối";
export type TabId = "plan" | "weather" | "outfit" | "book" | "cost" | "alt" | "todo";
export type PlanVariant = "base" | "swap";
export type BookingStatus = "todo" | "done" | "cancel" | "none";
export type CostGroup = "Đã đặt" | "Ước tính" | "Ăn uống";
export type CoupleConceptId = "tonal" | "bright" | "dark" | "chill" | "comfy";

export interface PlanItem {
  d: number;
  b: TimeSlot;
  t?: string;
  a: string;
  c: string;
  p: string;
  w?: number;
  pb?: string;
  m?: number;
  n?: string;
  o?: number;
}

export interface BookingItem {
  n: string;
  st: BookingStatus;
  date?: string;
  info: string;
  link?: string;
  est?: number;
  real?: number | null;
}

export interface CostLine {
  id: string;
  n: string;
  g: CostGroup;
  v: number | null;
  day?: number;
  opt?: number;
  hotel?: "tala" | "faru";
  s?: string;
}

export interface OutfitItem {
  d: number;
  b: TimeSlot;
  re?: RegExp;
  slot: string;
  me: string;
  you: string;
}

export interface PersonPalette {
  top: string;
  bottom: string;
  outer: string;
  main: string;
}

export interface CoupleConcept {
  id: CoupleConceptId;
  name: string;
  when: string;
  you: PersonPalette;
  partner: PersonPalette;
  shared: { n: string; c: string } | null;
  bg: string[];
  tip: string;
}

export interface BgPreset {
  n: string;
  c: string;
}

export interface HourlyWeather {
  temp: number;
  rh: number;
  dew: number;
  chigh: number;
  wind: number;
  pp: number;
  /** Lượng mưa gộp (median các model), mm/giờ */
  mm?: number;
}

export interface DailyWeather {
  date: string;
  tmax: number | null;
  tmin: number | null;
  rain: number | null;
  rainProb: number | null;
  code: number | null;
  sunrise: string | null;
  sunset: string | null;
  hours: Record<number, HourlyWeather> | null;
}

export interface WeatherCache {
  days: DailyWeather[];
  forecast: boolean;
  years?: number;
  savedAt: string;
}

export interface WeatherState {
  days: DailyWeather[] | null;
  label: string;
  forecast: boolean;
  cached?: boolean;
  savedAt?: string;
  note: string;
  err: string;
}

export interface CloudScoreResult {
  score: number;
  hum: number | null;
  spread: number | null;
  wind: number | null;
  rain: number;
  high: number | null;
}

export interface TripState {
  done: Record<string, boolean>;
  todo: Record<number, boolean>;
  pack: Record<number, boolean>;
  thr: number;
  val: Record<string, number>;
  on: Record<string, boolean>;
  keep: "faru" | "tala" | "both";
  variant: PlanVariant;
}
