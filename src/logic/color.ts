export function hexToRgb(h: string): [number, number, number] {
  const clean = h.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

export function lum(h: string): number {
  const c = hexToRgb(h).map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function hexToHsl(h: string): [number, number, number] {
  const c = hexToRgb(h).map((v) => v / 255);
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  const l = (mx + mn) / 2;
  let s = 0;
  let hh = 0;
  const d = mx - mn;

  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === c[0]) hh = (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0);
    else if (mx === c[1]) hh = (c[2] - c[0]) / d + 2;
    else hh = (c[0] - c[1]) / d + 4;
    hh *= 60;
  }
  return [hh, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const ll = l / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    return Math.round(255 * (ll - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))));
  };
  return `#${[f(0), f(8), f(4)].map((v) => `0${v.toString(16)}`.slice(-2)).join("")}`;
}

export function vis(fg: string, bg: string): [string, "good" | "" | "warn"] {
  const c = contrast(fg, bg);
  const f = hexToHsl(fg);
  const b = hexToHsl(bg);
  let hd = Math.abs(f[0] - b[0]);
  if (hd > 180) hd = 360 - hd;

  if (c >= 3) return ["nổi", "good"];
  if (f[1] >= 35 && b[1] >= 15 && hd >= 90) return ["nổi nhờ khác sắc", "good"];
  if (c >= 1.8) return ["vừa", ""];
  return ["dễ chìm", "warn"];
}

export function suggestFor(hex: string): [string, string, string][] {
  const [h, s, l] = hexToHsl(hex);
  const tonal = hslToHex(h, Math.max(12, s * 0.8), l > 55 ? l - 28 : l + 28);
  if (s < 14) {
    return [
      ["Cùng tông, khác sắc độ", tonal, "An toàn, nhìn như một bộ."],
      ["Một màu nhấn ấm (đỏ gạch)", "#b5523b", "Trung tính cộng một điểm nhấn, hợp chụp ảnh."],
      ["Một màu nhấn mustard", "#d6a21e", "Tươi hơn, xem độ nổi theo nền ở trên."],
    ];
  }
  return [
    ["Cùng tông, khác sắc độ", tonal, "An toàn, nhìn như một bộ."],
    [
      "Tương cận (lệch 30°)",
      hslToHex(h + 30, Math.min(60, Math.max(25, s)), Math.min(78, Math.max(30, l))),
      "Hài hoà, có chút khác biệt.",
    ],
    [
      "Tương phản mềm (đối màu, giảm bão hoà)",
      hslToHex(h + 180, Math.min(45, Math.max(20, s * 0.7)), Math.min(65, Math.max(40, l))),
      "Nổi bật cạnh nhau, hợp chụp ảnh.",
    ],
  ];
}
