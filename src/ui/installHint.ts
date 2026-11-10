import { loadInstallHintSeen, saveInstallHintSeen } from "../state/storage";

export interface HintEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
}

export function isIosSafari(env: Pick<HintEnv, "userAgent" | "platform" | "maxTouchPoints">): boolean {
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
  const openBtn = document.getElementById("toggle-install") as HTMLButtonElement | null;
  if (!panel) return;

  const env = currentEnv();
  const eligible = isIosSafari(env) && !env.standalone;
  if (openBtn) openBtn.hidden = !eligible;
  if (!eligible) return;

  const close = () => {
    panel.hidden = true;
    saveInstallHintSeen();
  };
  panel.querySelector<HTMLButtonElement>("[data-install-close]")?.addEventListener("click", close);
  openBtn?.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  if (shouldShowInstallHint(env, loadInstallHintSeen())) panel.hidden = false;
}
