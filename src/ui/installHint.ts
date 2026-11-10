import { loadInstallHintSeen, saveInstallHintSeen } from "../state/storage";

export interface HintEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
}

export function isIosSafari(
  env: Pick<HintEnv, "userAgent" | "platform" | "maxTouchPoints">,
): boolean {
  const ua = env.userAgent;
  const iosDevice =
    /iPhone|iPad|iPod/.test(ua) || (env.platform === "MacIntel" && env.maxTouchPoints > 1);
  if (!iosDevice) return false;
  // Chrome/Firefox/Edge/Opera trên iOS không có "Thêm vào Màn hình chính" như Safari
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
}

export function shouldShowInstallHint(env: HintEnv, seen: boolean): boolean {
  return isIosSafari(env) && !env.standalone && !seen;
}

function currentEnv(): HintEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
  };
}

export function setupInstallHint(): void {
  const panel = document.getElementById("install-hint");
  const openBtn = document.getElementById("toggle-install");
  if (!panel) return;

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    openBtn?.setAttribute("aria-expanded", String(open));
    if (open) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  panel.querySelector("[data-install-close]")?.addEventListener("click", () => {
    setOpen(false);
    saveInstallHintSeen();
  });
  // Nút luôn hoạt động trên mọi thiết bị; chỉ tự bật bảng ở lần đầu trên iOS Safari
  openBtn?.addEventListener("click", () => setOpen(panel.hidden));

  if (shouldShowInstallHint(currentEnv(), loadInstallHintSeen())) setOpen(true);
}
