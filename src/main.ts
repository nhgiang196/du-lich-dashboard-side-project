import { setupInstallHint } from "./ui/installHint";
import "./style.css";
import { TABS } from "./data/tripData";
import {
  applyWeatherCache,
  cloudScore,
  findWeatherDay,
  loadClimate,
  loadForecast,
} from "./logic/weather";
import { type DalatSceneController, initDalatScene } from "./scene/dalatScene";
import {
  buildSyncUrl,
  decodeSyncState,
  encodeSyncState,
  loadState,
  loadWeatherCache,
  mergeTripStates,
  saveState,
  saveWeatherCache,
} from "./state/storage";
import type { TabId, TripState, WeatherState } from "./types";
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
  cached: false,
  note: "",
  err: "",
};

let sceneCtrl: DalatSceneController | null = null;
let lastWeatherFetchMs = 0;
const WEATHER_COOLDOWN_MS = 30_000;

function applyInitialWeatherCache(): void {
  const cached = loadWeatherCache();
  if (cached) {
    applyWeatherCache(weather, cached);
  }
}

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
      const u = new URL(window.location.href);
      u.hash = id;
      history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
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

function renderAllStatefulTabs(): void {
  renderPlan(ctx);
  renderOutfit(ctx);
  renderCost(ctx);
  renderTodo(ctx);
  renderWeather(ctx);
}

function replaceStateInPlace(next: TripState): void {
  state.done = next.done;
  state.todo = next.todo;
  state.pack = next.pack;
  state.thr = next.thr;
  state.val = next.val;
  state.on = next.on;
  state.keep = next.keep;
  state.variant = next.variant;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.getElementById("sync-input") as HTMLInputElement | null;
    if (input) {
      input.value = text;
      input.select();
    }
    return false;
  }
}

function setupSync(): void {
  const toggleBtn = document.getElementById("toggle-sync") as HTMLButtonElement | null;
  const panel = document.getElementById("sync-panel");
  const copyLinkBtn = document.getElementById("btn-copy-link") as HTMLButtonElement | null;
  const copyCodeBtn = document.getElementById("btn-copy-code") as HTMLButtonElement | null;
  const shareBtn = document.getElementById("btn-share-native") as HTMLButtonElement | null;
  const syncInput = document.getElementById("sync-input") as HTMLInputElement | null;
  const mergeBtn = document.getElementById("btn-sync-merge") as HTMLButtonElement | null;
  const replaceBtn = document.getElementById("btn-sync-replace") as HTMLButtonElement | null;
  const msgEl = document.getElementById("sync-msg");

  const setMsg = (text: string, isErr = false) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = isErr ? "hint err" : "hint";
  };

  const openPanel = (open: boolean) => {
    if (!panel || !toggleBtn) return;
    panel.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
    toggleBtn.className = open ? "on" : "";
  };

  toggleBtn?.addEventListener("click", () => {
    openPanel(Boolean(panel?.hidden));
  });

  if (shareBtn && typeof navigator.share === "function") {
    shareBtn.hidden = false;
    shareBtn.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: "Đà Lạt 16-19/11 · Đồng bộ trạng thái",
          text: `Mã đồng bộ Đà Lạt: ${encodeSyncState(state)}`,
          url: buildSyncUrl(state),
        });
      } catch {
        // User cancelled share sheet
      }
    });
  }

  copyLinkBtn?.addEventListener("click", async () => {
    const url = buildSyncUrl(state);
    const ok = await copyText(url);
    setMsg(
      ok
        ? "✅ Đã sao chép link đồng bộ! Gửi qua Zalo/tin nhắn cho người đi cùng."
        : "Đã điền link vào ô bên trên, hãy sao chép thủ công.",
    );
  });

  copyCodeBtn?.addEventListener("click", async () => {
    const code = encodeSyncState(state);
    const ok = await copyText(code);
    setMsg(
      ok
        ? "✅ Đã sao chép mã ngắn! Người đi cùng chỉ cần dán mã này vào ô bên trên."
        : "Đã điền mã vào ô bên trên, hãy sao chép thủ công.",
    );
  });

  const applyFromInput = (mode: "merge" | "replace") => {
    const raw = syncInput?.value ?? "";
    const decoded = decodeSyncState(raw);
    if (!decoded) {
      setMsg("Mã hoặc link đồng bộ không hợp lệ. Hãy kiểm tra lại.", true);
      return;
    }
    const next = mode === "merge" ? mergeTripStates(state, decoded) : decoded;
    replaceStateInPlace(next);
    saveState(state);
    renderAllStatefulTabs();
    if (syncInput) syncInput.value = "";
    setMsg(
      mode === "merge"
        ? "✅ Đã gộp chung trạng thái của 2 máy!"
        : "✅ Đã cập nhật trạng thái theo mã vừa nhập!",
    );
  };

  mergeBtn?.addEventListener("click", () => applyFromInput("merge"));
  replaceBtn?.addEventListener("click", () => applyFromInput("replace"));

  // Auto-detect ?sync=... parameter when opening a shared link
  if (window.location.search.includes("sync=")) {
    const incoming = decodeSyncState(window.location.search);
    if (incoming) {
      const merged = mergeTripStates(state, incoming);
      replaceStateInPlace(merged);
      saveState(state);
      openPanel(true);
      setMsg("✅ Đã tự động gộp trạng thái từ link chia sẻ của người đi cùng!");
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("sync");
        history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      } catch {
        // Ignore history errors
      }
    }
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "dalat-trip-v7") {
      replaceStateInPlace(loadState());
      renderAllStatefulTabs();
    }
  });
}

function setupNetworkStatus(): void {
  const badge = document.getElementById("net-status");
  const update = () => {
    if (!badge) return;
    badge.hidden = navigator.onLine;
  };
  update();
  window.addEventListener("online", () => {
    update();
    if (!weather.days || weather.cached) {
      void refreshWeather();
    }
  });
  window.addEventListener("offline", update);
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        const warmAssets = () => {
          const worker = reg.active || reg.waiting || reg.installing;
          if (!worker) return;
          const urls: string[] = [];
          document
            .querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
              'script[src], link[rel="stylesheet"][href]',
            )
            .forEach((el) => {
              const u = "src" in el ? el.src : el.href;
              if (u) urls.push(u);
            });
          if (urls.length) {
            worker.postMessage({ type: "CACHE_URLS", urls });
          }
        };
        if (reg.active) warmAssets();
        reg.addEventListener("updatefound", () => {
          reg.installing?.addEventListener("statechange", () => {
            if (reg.active) warmAssets();
          });
        });
      })
      .catch(() => {
        // Ignore service worker registration errors in unsupported environments
      });
  });
}

function syncSceneClouds(): void {
  const s17 = cloudScore(findWeatherDay(weather.days, 17));
  const s18 = cloudScore(findWeatherDay(weather.days, 18));
  const bestScore =
    s17 && s18 ? Math.max(s17.score, s18.score) : (s17?.score ?? s18?.score ?? null);
  sceneCtrl?.setCloudDensity(bestScore);
}

async function refreshWeather(): Promise<void> {
  const now = Date.now();
  if (weather.days && !weather.cached && now - lastWeatherFetchMs < WEATHER_COOLDOWN_MS) {
    renderWeather(ctx);
    return;
  }

  if (!navigator.onLine) {
    const cached = loadWeatherCache();
    if (cached) {
      applyWeatherCache(weather, cached);
      renderWeather(ctx);
      renderPlan(ctx);
      renderOutfit(ctx);
      syncSceneClouds();
      return;
    }
  }

  if (!weather.days) {
    weather.label = "Đang tải…";
    weather.err = "";
    renderWeather(ctx);
  }

  try {
    const days = await loadForecast();
    const nowIso = new Date().toISOString();
    lastWeatherFetchMs = Date.now();
    weather.days = days;
    weather.label = "Dự báo";
    weather.forecast = true;
    weather.cached = false;
    weather.savedAt = nowIso;
    weather.note = `Cập nhật ${new Date(nowIso).toLocaleString("vi-VN")}. Dự báo xa dễ thay đổi, xem lại gần ngày đi.`;
    weather.err = "";
    saveWeatherCache({ days, forecast: true, savedAt: nowIso });
  } catch {
    const cached = loadWeatherCache();
    if (cached?.forecast) {
      applyWeatherCache(weather, cached);
    } else {
      try {
        const r = await loadClimate();
        const nowIso = new Date().toISOString();
        lastWeatherFetchMs = Date.now();
        weather.days = r.days;
        weather.label = "Trung bình nhiều năm";
        weather.forecast = false;
        weather.cached = false;
        weather.savedAt = nowIso;
        weather.err = "";
        weather.note = `Chưa có dự báo thật cho các ngày này. Đang hiển thị trung bình ${r.years} năm gần nhất của đúng 16-19/11.`;
        saveWeatherCache({ days: r.days, forecast: false, years: r.years, savedAt: nowIso });
      } catch {
        if (cached) {
          applyWeatherCache(weather, cached);
        } else {
          weather.days = null;
          weather.label = "Lỗi";
          weather.forecast = false;
          weather.cached = false;
          weather.note = "";
          weather.err =
            "Không tải được dữ liệu thời tiết và chưa có bản lưu offline. Kiểm tra kết nối mạng rồi bấm Làm mới.";
        }
      }
    }
  }

  renderWeather(ctx);
  renderPlan(ctx);
  renderOutfit(ctx);
  syncSceneClouds();
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
  setupNetworkStatus();
  setupSync();
  setupInstallHint();
  applyInitialWeatherCache();
  const show = setupNav();
  initHeroScene();

  renderPlan(ctx);
  renderOutfit(ctx);
  renderBook();
  renderCost(ctx);
  renderAlt();
  renderTodo(ctx);
  renderWeather(ctx);
  syncSceneClouds();

  const hs = location.hash.slice(1) as TabId;
  show(/^(plan|weather|outfit|book|cost|alt|todo)$/.test(hs) ? hs : "plan");

  registerServiceWorker();
  void refreshWeather();
}

bootstrap();
