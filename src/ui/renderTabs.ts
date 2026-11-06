import {
  ALT,
  BGS,
  BOOK,
  COUPLE,
  DOW,
  LINES,
  OUTFIT,
  PACK,
  PALETTE,
  RULES,
  TODO,
} from "../data/tripData";
import { contrast, hexToHsl, suggestFor, vis } from "../logic/color";
import { calculateCostSummary, dayMeals, lineActive, lineVal } from "../logic/cost";
import { buildPlan, mapUrl, pk, routeUrl } from "../logic/plan";
import { cloudLabel, cloudScore, findWeatherDay, slotRain, weatherIcon } from "../logic/weather";
import { saveState } from "../state/storage";
import type {
  BgPreset,
  CoupleConcept,
  CoupleConceptId,
  DailyWeather,
  OutfitItem,
  PersonPalette,
  PlanItem,
  TimeSlot,
  TripState,
  WeatherState,
} from "../types";

export function vnd(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")} đ`;
}

export function esc(s: unknown): string {
  return String(s).replace(/[&<>"]/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return map[c] || c;
  });
}

export function fmtDate(iso: string): { day: string; dow: string } {
  const d = new Date(`${iso}T00:00:00`);
  return {
    day: `${d.getDate()}/${d.getMonth() + 1}`,
    dow: DOW[d.getDay()],
  };
}

function hhmm(s: string | null): string {
  return s ? s.slice(11, 16) : "–";
}

function r0(x: number | null): string | number {
  return x == null ? "–" : Math.round(x);
}

function bgBy(name: string): BgPreset {
  for (const b of BGS) {
    if (b.n === name) return b;
  }
  return BGS[0];
}

function coupleBy(id: CoupleConceptId | null): CoupleConcept | null {
  if (!id) return null;
  for (const c of COUPLE) {
    if (c.id === id) return c;
  }
  return null;
}

function conceptOf(o: OutfitItem): CoupleConceptId | null {
  if (o.d === 15 || o.d === 19) return "comfy";
  if (o.d === 16) return o.b === "Sáng" && /4h/.test(o.slot) ? "comfy" : "tonal";
  if (o.d === 17) return o.b === "Sáng" ? "bright" : "dark";
  if (o.d === 18) return /săn mây/i.test(o.slot) ? "bright" : "chill";
  return null;
}

function outfitFor(p: PlanItem): OutfitItem | null {
  for (const o of OUTFIT) {
    if (o.d === p.d && o.b === p.b && (!o.re || o.re.test(`${p.a} ${p.p}`))) {
      return o;
    }
  }
  return null;
}

function outfitLine(p: PlanItem): string {
  const o = outfitFor(p);
  if (!o) return "";
  const cc = coupleBy(conceptOf(o));
  return cc ? `<br><span class="badge">${esc(cc.name)}</span>` : "";
}

function sw(c: string, lab: string): string {
  return `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;font-size:.7rem;color:var(--muted);text-align:center"><i style="width:30px;height:30px;border-radius:8px;background:${c};border:1px solid var(--line);display:block"></i>${lab}</span>`;
}

function mannequin(title: string, p: PersonPalette): string {
  return `<div><div class="hint" style="margin-bottom:4px">${title}</div><div style="display:flex;gap:6px">${sw(p.outer, "Khoác")}${sw(p.top, "Áo")}${sw(p.bottom, "Quần")}</div></div>`;
}

function coupleCards(): string {
  let h = "<h2>Phối màu cặp đôi theo concept</h2>";
  for (const c of COUPLE) {
    h +=
      `<div class="card"><b>${esc(c.name)}</b> <span class="hint">${esc(c.when)}</span>` +
      `<div style="display:flex;flex-wrap:wrap;gap:18px;margin:10px 0">${mannequin("Bạn", c.you)}${mannequin("Người đi cùng", c.partner)}` +
      (c.shared
        ? `<div><div class="hint" style="margin-bottom:4px">Món chung</div>${sw(c.shared.c, c.shared.n)}</div>`
        : "") +
      "</div>" +
      c.bg
        .map((n) => {
          const b = bgBy(n);
          const a = vis(c.you.main, b.c);
          const p = vis(c.partner.main, b.c);
          return (
            `<div class="row"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${b.c};border:1px solid var(--line);vertical-align:-1px"></i> Nền ${esc(b.n)}</span>` +
            `<span>Bạn <span class="badge ${a[1]}">${a[0]}</span> Người đi cùng <span class="badge ${p[1]}">${p[0]}</span></span></div>`
          );
        })
        .join("") +
      `<div class="hint" style="margin-top:6px">${esc(c.tip)}</div></div>`;
  }
  return h;
}

const toolState = { col: "#6b4a2f", bg: 1 };

function renderCoupleTool(): void {
  const el = document.getElementById("coupleTool");
  if (!el) return;
  const bg = BGS[toolState.bg];
  const mine = vis(toolState.col, bg.c);

  let h =
    '<div class="hint" style="margin-bottom:6px">1. Chọn màu chủ đạo của bạn:</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
    PALETTE.map(
      (c) =>
        `<button type="button" data-col="${c[1]}" style="display:inline-flex;align-items:center;gap:6px;${
          toolState.col === c[1]
            ? "border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)"
            : ""
        }"><i style="width:16px;height:16px;border-radius:50%;background:${c[1]};border:1px solid var(--line);display:inline-block"></i>${c[0]}</button>`,
    ).join("") +
    '</div><div class="hint" style="margin:10px 0 6px">2. Chọn nền nơi chụp:</div><select id="toolBg">' +
    BGS.map(
      (b, i) => `<option value="${i}"${i === toolState.bg ? " selected" : ""}>${b.n}</option>`,
    ).join("") +
    "</select>" +
    ` <span class="badge ${mine[1]}">Bạn: ${mine[0]}</span>` +
    '<div class="hint" style="margin:10px 0 6px">3. Gợi ý cho người đi cùng:</div>';

  for (const s of suggestFor(toolState.col)) {
    const v = vis(s[1], bg.c);
    const cp = contrast(toolState.col, s[1]);
    const a = hexToHsl(toolState.col);
    const b = hexToHsl(s[1]);
    let hd = Math.abs(a[0] - b[0]);
    if (hd > 180) hd = 360 - hd;
    const twin = cp < 1.15 && hd < 20;

    h +=
      '<div class="card" style="margin:6px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      `<span style="display:inline-flex">${sw(toolState.col, "Bạn")}</span><span style="display:inline-flex">${sw(s[1], s[1])}</span>` +
      `<span style="flex:1;min-width:150px"><b>${esc(s[0])}</b><div class="hint">${esc(s[2])}</div>` +
      `<span class="badge ${v[1]}">Người đi cùng: ${v[0]}</span> ${
        twin ? '<span class="badge warn">dễ trùng màu với bạn</span>' : ""
      }</span></div>`;
  }

  el.innerHTML = `${h}<p class="hint">Độ nổi tính theo tương phản sáng tối và khác sắc, chỉ là gợi ý màu, không đảm bảo hợp mắt.</p>`;

  el.querySelectorAll<HTMLButtonElement>("button[data-col]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.col) {
        toolState.col = b.dataset.col;
        renderCoupleTool();
      }
    });
  });

  const bgSelect = document.getElementById("toolBg") as HTMLSelectElement | null;
  bgSelect?.addEventListener("change", () => {
    toolState.bg = Number(bgSelect.value);
    renderCoupleTool();
  });
}

export interface RenderContext {
  state: TripState;
  weather: WeatherState;
  onRefreshWeather: () => void;
}

export function renderPlan(ctx: RenderContext): void {
  const { state, weather } = ctx;
  const plan = buildPlan(state.variant);
  const container = document.getElementById("s-plan");
  if (!container) return;

  let h = `<p class="hint">Tick khi đã làm xong. Mục ngoài trời hiện nhãn mưa và Plan B nổi bật khi xác suất mưa trong khung giờ đó từ ${state.thr}% trở lên (chỉnh ở tab Thời tiết). Viền đứt là mục tuỳ chọn.</p>`;

  const urgent = BOOK.filter((b) => b.st === "todo").length;
  if (urgent) {
    h += `<div class="card alert"><b>${urgent} việc đặt trước chưa hoàn thành</b> (nhận phòng sớm, xe máy, đặt chỗ ăn tối 17/11...). Xem tab Đặt trước.</div>`;
  }

  const s17 = cloudScore(findWeatherDay(weather.days, 17));
  const s18 = cloudScore(findWeatherDay(weather.days, 18));

  h +=
    '<div class="card"><b>Thứ tự săn mây</b> ' +
    `<button type="button" data-v="base" class="${state.variant === "base" ? "on" : ""}">Gốc: Cầu Đất 17/11, Đa Phú 18/11</button> ` +
    `<button type="button" data-v="swap" class="${state.variant === "swap" ? "on" : ""}">Đổi: Đa Phú 17/11, Cầu Đất 18/11</button>` +
    (s17 && s18
      ? `<div class="hint" style="margin-top:6px">Điểm săn mây theo dự báo: sáng 17/11 ${s17.score}/100, sáng 18/11 ${s18.score}/100.</div>`
      : "") +
    `<div class="hint" style="margin-top:4px">${
      state.variant === "swap"
        ? "Phương án đổi: sáng 17/11 nhẹ hơn sau đêm trên xe (Đa Phú gần), sáng 18/11 dậy 4h30 đi Cầu Đất rồi phải về kịp trả phòng Faru trước 12:00 và nhận phòng New Life. Viện nghiên cứu và ăn sáng chợ chuyển sang 17/11, bữa tối và cà phê giữ nguyên."
        : "Phương án gốc: Cầu Đất sáng 17/11 (dậy 4h45 ngay sau đêm xe), Đa Phú sáng 18/11."
    }</div></div>`;

  let last: number | null = null;
  for (const p of plan) {
    if (p.d !== last) {
      last = p.d;
      const f = fmtDate(`2026-11-${p.d}`);
      const w = findWeatherDay(weather.days, p.d);
      const ru = routeUrl(plan, p.d);
      const meal = dayMeals(p.d, state);

      h +=
        `<div class="day"><div class="h"><span>${f.dow} ${f.day}</span><span>` +
        (ru ? `<a class="btn" target="_blank" rel="noopener" href="${ru}">Tuyến cả ngày</a>` : "") +
        '</span></div><div class="w">';

      if (w) {
        h +=
          `<span class="badge">${weatherIcon(w.code)} ${r0(w.tmin)}–${r0(w.tmax)}°C</span>` +
          (w.rainProb != null
            ? `<span class="badge ${w.rainProb >= state.thr ? "warn" : ""}">Mưa ${Math.round(w.rainProb)}%</span>`
            : "") +
          `<span class="badge">Mặt trời mọc ${hhmm(w.sunrise)}</span>`;
      }
      if (meal != null) h += `<span class="hint">Ăn uống dự trù ${vnd(meal)}</span>`;
      h += "</div></div>";
    }

    const rp = p.w ? slotRain(weather.days, p.d, p.b) : null;
    const useB = Boolean(p.pb && rp != null && rp >= state.thr);
    const kk = pk(p);

    h +=
      `<div class="card item${state.done[kk] ? " done" : ""}${p.o ? " opt" : ""}">` +
      `<input type="checkbox" data-k="${esc(kk)}" ${state.done[kk] ? "checked" : ""} aria-label="Xong">` +
      `<div><div class="t">${esc(p.a)}${
        useB && rp != null ? ` <span class="badge warn">Mưa ${Math.round(rp)}%</span>` : ""
      }${p.o ? ' <span class="badge">Tuỳ chọn</span>' : ""}</div>` +
      `<div class="time">${p.b}${p.t ? ` · ${p.t}` : ""} · ${p.c}${p.m ? ` · ${vnd(p.m)}` : ""}</div></div>` +
      '<div class="meta">' +
      (p.p ? `<a href="${mapUrl(p.p)}" target="_blank" rel="noopener">${esc(p.p)}</a>` : "") +
      (p.pb
        ? `<br><span class="pb">${useB ? "Cân nhắc Plan B" : "Plan B nếu mưa"}: ${esc(p.pb)}</span>`
        : "") +
      (p.n ? `<br>${esc(p.n)}` : "") +
      outfitLine(p) +
      "</div></div>";
  }

  container.innerHTML = h;

  container.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const k = cb.dataset.k;
      if (k) {
        state.done[k] = cb.checked;
        saveState(state);
        renderPlan(ctx);
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-v]").forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.dataset.v;
      if (v === "base" || v === "swap") {
        state.variant = v;
        saveState(state);
        renderPlan(ctx);
      }
    });
  });
}

function outfitNote(ctx: RenderContext, d: number, b: TimeSlot, c: string): string {
  const { state, weather } = ctx;
  const t: string[] = [];
  const rp = d >= 16 ? slotRain(weather.days, d, b) : null;
  const w = findWeatherDay(weather.days, d);
  if (rp != null && rp >= state.thr) {
    t.push(`Mưa ${Math.round(rp)}%: ưu tiên lớp chống nước, áo khoác da cần áo mưa phủ ngoài.`);
  }
  if (c === "Săn mây" && w && w.tmin != null && w.tmin < 16) {
    t.push(`Sáng sớm khoảng ${r0(w.tmin)}°C, thêm một lớp len.`);
  }
  return t.join(" ");
}

export function renderOutfit(ctx: RenderContext): void {
  const { state } = ctx;
  const container = document.getElementById("s-outfit");
  if (!container) return;

  let h =
    '<p class="hint">Style clean, chill, retro kiểu Đà Lạt. Cột "Bạn" bám theo đồ bạn đã liệt kê, cột "Người đi cùng" là gợi ý chung. Có dự báo thì trang tự thêm nhắc nhở mưa và lạnh.</p>';
  h +=
    '<div class="card"><b>Bảng màu</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
    PALETTE.map(
      (c) =>
        `<span style="display:inline-flex;align-items:center;gap:6px;font-size:.82rem"><i style="width:18px;height:18px;border-radius:50%;background:${c[1]};border:1px solid var(--line);display:inline-block"></i>${c[0]}</span>`,
    ).join("") +
    "</div></div>";
  h +=
    '<div class="card"><b>Nguyên tắc</b><ul style="margin:6px 0 0;padding-left:18px">' +
    RULES.map((r) => `<li style="margin:3px 0">${esc(r)}</li>`).join("") +
    "</ul></div>";
  h += coupleCards();
  h += '<h2>Gợi ý màu cho người đi cùng</h2><div class="card" id="coupleTool"></div>';

  let last: number | null = null;
  for (const o of OUTFIT) {
    if (o.d !== last) {
      last = o.d;
      const f = fmtDate(`2026-11-${o.d}`);
      h += `<h2>${f.dow} ${f.day}</h2>`;
    }
    const n = outfitNote(ctx, o.d, o.b, /săn mây/i.test(o.slot) ? "Săn mây" : "");
    const cc = coupleBy(conceptOf(o));
    h +=
      `<div class="card"><b>${esc(o.slot)}</b>${cc ? ` <span class="badge">${esc(cc.name)}</span>` : ""}` +
      `<div class="row"><span>Bạn</span><span style="text-align:right;color:var(--text)">${esc(o.me)}</span></div>` +
      `<div class="row"><span>Người đi cùng</span><span style="text-align:right;color:var(--text)">${esc(o.you)}</span></div>` +
      (n ? `<div class="hint err" style="margin-top:6px">${esc(n)}</div>` : "") +
      "</div>";
  }

  const doneCount = PACK.filter((_, i) => state.pack[i]).length;
  h += `<h2>Đồ mang (${doneCount} / ${PACK.length})</h2><div class="card">`;
  PACK.forEach((t, i) => {
    h +=
      `<label class="item" style="margin:6px 0;cursor:pointer"><input type="checkbox" data-p="${i}" ${
        state.pack[i] ? "checked" : ""
      }>` +
      `<span style="${state.pack[i] ? "opacity:.5;text-decoration:line-through" : ""}">${esc(t)}</span></label>`;
  });

  container.innerHTML = `${h}</div>`;
  renderCoupleTool();

  container.querySelectorAll<HTMLInputElement>("input[data-p]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = Number(cb.dataset.p);
      state.pack[idx] = cb.checked;
      saveState(state);
      renderOutfit(ctx);
    });
  });
}

function tipFor(d: DailyWeather, thr: number): string {
  const t: string[] = [];
  if (d.rainProb != null && d.rainProb >= thr) {
    t.push("Khả năng mưa cao, xem Plan B cho mục ngoài trời.");
  } else if (d.rainProb != null && d.rainProb >= 35) {
    t.push("Có thể mưa, mang áo mưa gọn.");
  }
  if (d.tmin != null && d.tmin < 15) {
    t.push(`Sáng sớm lạnh (${r0(d.tmin)}°C), mang áo ấm.`);
  }
  return t.length ? t.join(" ") : "Thời tiết thuận lợi.";
}

export function renderWeather(ctx: RenderContext): void {
  const { state, weather, onRefreshWeather } = ctx;
  const container = document.getElementById("s-weather");
  if (!container) return;

  let h =
    `<div class="card"><span class="badge ${weather.forecast ? "good" : "warn"}">${weather.label}</span> ` +
    '<button id="refresh" type="button">Làm mới</button>' +
    (weather.note ? `<p class="hint">${weather.note}</p>` : "") +
    `<label class="hint" for="thr">Ngưỡng xác suất mưa để gợi ý Plan B: <b id="thrv">${state.thr}</b>%</label>` +
    `<input id="thr" type="range" min="20" max="90" step="5" value="${state.thr}"></div>`;

  if (weather.days) {
    h += '<div class="grid">';
    for (const d of weather.days) {
      const f = fmtDate(d.date);
      h +=
        `<div class="card"><b>${f.day}</b> <span class="hint">${f.dow}</span><div style="font-size:2rem;line-height:1.2">${weatherIcon(d.code)}</div>` +
        `<div><b style="font-size:1.15rem">${r0(d.tmax)}°</b> <span class="hint">/ ${r0(d.tmin)}°C</span></div>` +
        `<div class="row"><span>${weather.forecast ? "Xác suất mưa" : "Ngày có mưa"}</span><span>${
          d.rainProb == null ? "–" : `${Math.round(d.rainProb)}%`
        }</span></div>` +
        `<div class="row"><span>Lượng mưa</span><span>${
          d.rain == null ? "–" : `${d.rain.toFixed(1)} mm`
        }</span></div>` +
        `<div class="row"><span>Mặt trời</span><span>${hhmm(d.sunrise)} / ${hhmm(d.sunset)}</span></div>` +
        `<div class="hint" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">${tipFor(d, state.thr)}</div></div>`;
    }
    h += "</div><h2>Săn mây: sáng 17/11 (Cầu Đất) và sáng 18/11 (Đồi Đa Phú)</h2>";

    if (weather.forecast) {
      const s17 = cloudScore(findWeatherDay(weather.days, 17));
      const s18 = cloudScore(findWeatherDay(weather.days, 18));
      const pairs: [number, ReturnType<typeof cloudScore>, string][] = [
        [17, s17, "Cầu Đất"],
        [18, s18, "Đồi Đa Phú"],
      ];
      for (const [dayNum, sc, locName] of pairs) {
        if (!sc) continue;
        const lb = cloudLabel(sc.score);
        h +=
          `<div class="card"><b>Sáng ${dayNum}/11 · ${locName}</b> <span class="badge ${lb[1]}">${lb[0]} (${sc.score}/100)</span>` +
          `<div class="row"><span>Độ ẩm 5-7h</span><span>${r0(sc.hum)}%</span></div>` +
          `<div class="row"><span>Chênh nhiệt độ và điểm sương</span><span>${
            sc.spread == null ? "–" : sc.spread.toFixed(1)
          }°C</span></div>` +
          `<div class="row"><span>Gió</span><span>${r0(sc.wind)} km/h</span></div>` +
          `<div class="row"><span>Xác suất mưa cao nhất</span><span>${Math.round(sc.rain)}%</span></div>` +
          `<div class="row"><span>Mây tầng cao</span><span>${r0(sc.high)}%</span></div></div>`;
      }
      if (s17 && s18) {
        const better =
          s17.score === s18.score
            ? "Hai sáng ngang nhau, giữ nguyên kế hoạch."
            : s18.score > s17.score
              ? "Sáng 18/11 có điểm cao hơn. Cân nhắc đổi Cầu Đất sang 18/11 và Đồi Đa Phú sang 17/11."
              : "Sáng 17/11 có điểm cao hơn, giữ Cầu Đất vào 17/11.";
        h += `<p class="hint"><b>${better}</b> Điểm là công thức đơn giản (độ ẩm cao, gió nhẹ, ít mưa, mây cao thưa thì dễ có biển mây), chưa được kiểm chứng.</p>`;
      }
    } else {
      h +=
        '<p class="hint">Cần dự báo thật để tính điểm săn mây. Dự báo có khi ngày đi nằm trong khoảng 16 ngày tới.</p>';
    }
  } else if (weather.err) {
    h += `<p class="err">${weather.err}</p>`;
  }

  container.innerHTML = h;
  document.getElementById("refresh")?.addEventListener("click", onRefreshWeather);

  const thr = document.getElementById("thr") as HTMLInputElement | null;
  thr?.addEventListener("input", () => {
    state.thr = Number(thr.value);
    const thrv = document.getElementById("thrv");
    if (thrv) thrv.textContent = String(state.thr);
    saveState(state);
    renderPlan(ctx);
    renderOutfit(ctx);
  });
  thr?.addEventListener("change", () => renderWeather(ctx));
}

function linkify(s: string): string {
  return esc(s).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>',
  );
}

export function renderBook(): void {
  const container = document.getElementById("s-book");
  if (!container) return;

  const groups: ["todo" | "done" | "cancel", string, string][] = [
    ["todo", "Cần làm", "warn"],
    ["done", "Đã đặt", "good"],
    ["cancel", "Đã hủy", "mute"],
  ];
  let h = "";
  const tala = BOOK.filter((b) => /Tala/.test(b.n) && b.st === "done").length;
  const faru = BOOK.filter((b) => /Faru/.test(b.n) && b.st === "done").length;
  if (tala && faru) {
    h +=
      '<div class="card alert"><b>Đang đặt cả Tala và Faru cho 16-18/11.</b> Bảng của bạn không ghi hạn hủy miễn phí. Kiểm tra và hủy một khách sạn trước hạn, nếu không có thể phải trả cả hai (Tala 782k, Faru chưa có giá).</div>';
  }

  for (const [stKey, label, badgeClass] of groups) {
    const items = BOOK.filter((b) => b.st === stKey);
    if (!items.length) continue;
    h += `<h2>${label} (${items.length})</h2>`;
    for (const b of items) {
      h +=
        `<div class="card"><b>${esc(b.n)}</b> <span class="badge ${badgeClass}">${label}</span>` +
        (b.date ? ` <span class="hint">đặt ${b.date}</span>` : "") +
        `<div class="hint">${linkify(b.info)}${b.link ? ` ${linkify(b.link)}` : ""}</div>` +
        (b.real !== undefined && stKey === "done"
          ? `<div class="row"><span>Chi phí thực</span><span>${b.real == null ? "chưa có giá" : vnd(b.real)}</span></div>`
          : "") +
        (b.est
          ? `<div class="row"><span>Chi phí ước tính</span><span>${vnd(b.est)}</span></div>`
          : "") +
        "</div>";
    }
  }
  container.innerHTML = h;
}

export function renderCost(ctx: RenderContext): void {
  const { state } = ctx;
  const container = document.getElementById("s-cost");
  if (!container) return;

  const summary = calculateCostSummary(state);
  const groups = ["Đã đặt", "Ước tính", "Ăn uống"] as const;
  let h = "";

  for (const g of groups) {
    const sub = summary.byGroup[g];
    h += `<div class="card"><table><tr><th>${g}</th><th class="num">Số tiền (đ)</th></tr>`;
    for (const l of LINES.filter((x) => x.g === g)) {
      const active = lineActive(l, state);
      const v = lineVal(l, state);
      h +=
        `<tr${active ? "" : ' style="opacity:.45"'}><td>` +
        (l.opt
          ? `<label><input type="checkbox" data-on="${l.id}" ${state.on[l.id] ? "checked" : ""}> `
          : "") +
        esc(l.n) +
        (l.opt ? "</label>" : "") +
        (l.s ? `<div class="hint">${esc(l.s)}</div>` : "") +
        (l.hotel && !active ? '<div class="hint">Không tính vì không được chọn</div>' : "") +
        "</td>" +
        `<td class="num"><input type="number" min="0" step="1000" data-v="${l.id}" value="${
          v == null ? "" : v
        }" placeholder="chưa nhập"></td></tr>`;
    }
    h += `<tr><td><b>Cộng ${g.toLowerCase()}</b></td><td class="num"><b>${vnd(sub)}</b></td></tr></table></div>`;
  }

  const { total, missing, budget, pct, perPerson } = summary;
  h +=
    `<div class="card"><div class="big">${vnd(total)}</div>` +
    (missing.length ? `<div class="err hint">Chưa gồm: ${esc(missing.join("; "))}.</div>` : "") +
    `<div class="bar ${total > budget ? "over" : ""}"><i style="width:${pct}%"></i></div>` +
    `<div class="row"><span>Ngân sách tối đa</span><span>${vnd(budget)}</span></div>` +
    `<div class="row"><span>${total > budget ? "Vượt" : "Còn lại"}</span><span>${vnd(Math.abs(budget - total))}</span></div>` +
    `<div class="row"><span>Mỗi người</span><span>${vnd(perPerson)}</span></div></div>`;

  container.innerHTML = h;

  container.querySelectorAll<HTMLInputElement>("input[data-v]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const id = inp.dataset.v;
      if (!id) return;
      if (inp.value === "") delete state.val[id];
      else state.val[id] = Math.max(0, Number(inp.value) || 0);
      saveState(state);
      renderCost(ctx);
      renderPlan(ctx);
    });
  });

  container.querySelectorAll<HTMLInputElement>("input[data-on]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.on;
      if (!id) return;
      state.on[id] = cb.checked;
      saveState(state);
      renderCost(ctx);
    });
  });
}

export function renderAlt(): void {
  const container = document.getElementById("s-alt");
  if (!container) return;

  let h =
    '<p class="hint">Gợi ý thay thế của mình, không có trong bảng kế hoạch của bạn.</p><div class="card"><table><tr><th>Nhóm</th><th>Phương án</th></tr>';
  for (const a of ALT) {
    h += `<tr><td>${a[0]}</td><td><b>${esc(a[1])}</b><div class="hint">${esc(a[2])}</div></td></tr>`;
  }
  container.innerHTML = `${h}</table></div>`;
}

export function renderTodo(ctx: RenderContext): void {
  const { state } = ctx;
  const container = document.getElementById("s-todo");
  if (!container) return;

  const doneCount = TODO.filter((_, i) => state.todo[i]).length;
  let h = `<p class="hint">${doneCount} / ${TODO.length} mục đã xong</p><div class="card">`;
  TODO.forEach((t, i) => {
    h +=
      `<label class="item" style="margin:6px 0;cursor:pointer"><input type="checkbox" data-i="${i}" ${
        state.todo[i] ? "checked" : ""
      }>` +
      `<span style="${state.todo[i] ? "opacity:.5;text-decoration:line-through" : ""}">${esc(t[0])} <span class="badge ${
        t[1] === "Quan trọng" ? "warn" : ""
      }">${t[1]}</span></span></label>`;
  });
  container.innerHTML = `${h}</div>`;

  container.querySelectorAll<HTMLInputElement>("input[data-i]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = Number(cb.dataset.i);
      state.todo[idx] = cb.checked;
      saveState(state);
      renderTodo(ctx);
    });
  });
}
