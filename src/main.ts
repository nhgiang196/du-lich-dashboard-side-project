import "./style.css";
import { TABS } from "./data/tripData";
import { cloudScore, findWeatherDay, loadClimate, loadForecast } from "./logic/weather";
import { type DalatSceneController, initDalatScene } from "./scene/dalatScene";
import { loadState } from "./state/storage";
import type { TabId, WeatherState } from "./types";
import {
  type RenderContext,
  renderAlt,
  renderBook,
  renderCost,
  renderOutfit,
  renderPlan,
  renderTodo,
  renderWeather,
} from "./ui/renderTabs";

const state = loadState();
const weather: WeatherState = {
  days: null,
  label: "Đang tải…",
  forecast: false,
  note: "",
  err: "",
};

let sceneCtrl: DalatSceneController | null = null;

function updateCountdown(): void {
  const countEl = document.getElementById("count");
  if (!countEl) return;
  const left = Math.ceil((new Date("2026-11-16T00:00:00").getTime() - Date.now()) / 86_400_000);
  countEl.textContent =
    left > 0 ? `Còn ${left} ngày` : left > -4 ? "Đang trong chuyến đi" : "Chuyến đi đã qua";
}

function setupNav(): (id: TabId) => void {
  const nav = document.getElementById("nav");
  if (!nav) return () => {};

  const show = (id: TabId) => {
    for (const [tabId] of TABS) {
      const sec = document.getElementById(`s-${tabId}`);
      if (sec) sec.hidden = tabId !== id;
    }
    for (const child of Array.from(nav.children)) {
      const btn = child as HTMLButtonElement;
      btn.className = btn.dataset.t === id ? "on" : "";
    }
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      // Ignore history security errors in sandboxed iframes
    }
  };

  for (const [tabId, label] of TABS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.t = tabId;
    b.addEventListener("click", () => show(tabId));
    nav.appendChild(b);
  }

  return show;
}

const ctx: RenderContext = {
  state,
  weather,
  onRefreshWeather: () => {
    void refreshWeather();
  },
};

async function refreshWeather(): Promise<void> {
  weather.label = "Đang tải…";
  weather.err = "";
  renderWeather(ctx);

  try {
    const days = await loadForecast();
    weather.days = days;
    weather.label = "Dự báo";
    weather.forecast = true;
    weather.note = `Cập nhật ${new Date().toLocaleString("vi-VN")}. Dự báo xa dễ thay đổi, xem lại gần ngày đi.`;
    weather.err = "";
  } catch {
    try {
      const r = await loadClimate();
      weather.days = r.days;
      weather.label = "Trung bình nhiều năm";
      weather.forecast = false;
      weather.err = "";
      weather.note = `Chưa có dự báo thật cho các ngày này. Đang hiển thị trung bình ${r.years} năm gần nhất của đúng 16-19/11.`;
    } catch {
      weather.days = null;
      weather.label = "Lỗi";
      weather.forecast = false;
      weather.note = "";
      weather.err = "Không tải được dữ liệu thời tiết. Kiểm tra kết nối mạng rồi bấm Làm mới.";
    }
  }

  renderWeather(ctx);
  renderPlan(ctx);
  renderOutfit(ctx);

  // Sync 3D cloud density with morning cloud-hunting score if forecast is available
  const s17 = cloudScore(findWeatherDay(weather.days, 17));
  const s18 = cloudScore(findWeatherDay(weather.days, 18));
  const bestScore =
    s17 && s18 ? Math.max(s17.score, s18.score) : (s17?.score ?? s18?.score ?? null);
  sceneCtrl?.setCloudDensity(bestScore);
}

function initHeroScene(): void {
  const canvasHost = document.getElementById("scene-canvas");
  const toggleBtn = document.getElementById("toggle-3d") as HTMLButtonElement | null;
  if (!canvasHost) return;

  sceneCtrl = initDalatScene(canvasHost);
  toggleBtn?.addEventListener("click", () => {
    if (!sceneCtrl) return;
    const nextPaused = !sceneCtrl.isPaused();
    sceneCtrl.setPaused(nextPaused);
    toggleBtn.textContent = nextPaused ? "Chạy 3D" : "Tạm dừng 3D";
  });
}

function bootstrap(): void {
  updateCountdown();
  const show = setupNav();
  initHeroScene();

  renderPlan(ctx);
  renderOutfit(ctx);
  renderBook();
  renderCost(ctx);
  renderAlt();
  renderTodo(ctx);
  renderWeather(ctx);

  const hs = location.hash.slice(1) as TabId;
  show(/^(plan|weather|outfit|book|cost|alt|todo)$/.test(hs) ? hs : "plan");

  void refreshWeather();
}

bootstrap();
