import type { GameState, GameStats } from "../types";

export interface UIActions {
  play: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  home: () => void;
  toggleSound: () => void;
  toggleLowPower: () => void;
  toggleShake: () => void;
}

export class UIManager {
  private readonly army = this.get("army-value");
  private readonly health = this.get("health-value");
  private readonly wave = this.get("wave-value");
  private readonly progress = this.get("progress-fill");
  private readonly bossWrap = this.get("boss-health");
  private readonly bossFill = this.get("boss-fill");
  private readonly special = this.get("special-button") as HTMLButtonElement;
  private readonly toast = this.get("toast");
  private readonly menu = this.get("menu-screen");
  private readonly pause = this.get("pause-screen");
  private readonly result = this.get("result-screen");
  private readonly hud = this.get("hud");
  private toastTimer = 0;

  public constructor(actions: UIActions) {
    this.bind("play-button", actions.play);
    this.bind("pause-button", actions.pause);
    this.bind("resume-button", actions.resume);
    this.bind("restart-button", actions.restart);
    this.bind("pause-restart", actions.restart);
    this.bind("home-button", actions.home);
    this.bind("pause-home", actions.home);
    this.bind("sound-button", actions.toggleSound);
    this.bind("pause-sound", actions.toggleSound);
    this.bind("low-power-button", actions.toggleLowPower);
    this.bind("shake-button", actions.toggleShake);
    this.bind("help-button", () => this.get("help-panel").classList.toggle("visible"));
  }

  public setState(state: GameState): void {
    this.menu.classList.toggle("visible", state === "menu");
    this.pause.classList.toggle("visible", state === "paused");
    this.result.classList.toggle("visible", state === "gameOver" || state === "stageClear");
    this.hud.classList.toggle("visible", state === "playing" || state === "paused");
  }

  public update(
    army: number,
    health: number,
    progress: number,
    wave: number,
    bossRatio: number | null,
    specialRatio: number,
  ): void {
    this.army.textContent = `${army}`;
    this.health.textContent = `${Math.max(0, health)}`;
    this.wave.textContent = `${wave}/5`;
    this.progress.style.width = `${Math.min(100, progress * 100)}%`;
    this.bossWrap.classList.toggle("visible", bossRatio !== null);
    if (bossRatio !== null) this.bossFill.style.width = `${bossRatio * 100}%`;
    this.special.style.setProperty("--charge", `${Math.min(1, specialRatio) * 360}deg`);
    this.special.disabled = specialRatio < 1;
    this.special.setAttribute(
      "aria-label",
      specialRatio >= 1 ? "특수 공격 사용" : `특수 공격 충전 ${Math.floor(specialRatio * 100)}퍼센트`,
    );
  }

  public showToast(message: string, tone: "good" | "bad" | "neutral" = "neutral"): void {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.dataset.tone = tone;
    this.toast.classList.add("visible");
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove("visible"), 1400);
  }

  public showResult(
    cleared: boolean,
    score: number,
    best: number,
    army: number,
    stats: GameStats,
  ): void {
    this.get("result-kicker").textContent = cleared ? "MISSION COMPLETE" : "RUN TERMINATED";
    this.get("result-title").textContent = cleared ? "교량 확보 완료" : "부대 전멸";
    this.get("result-score").textContent = score.toLocaleString("ko-KR");
    this.get("best-score").textContent = best.toLocaleString("ko-KR");
    this.get("result-army").textContent = `${army}`;
    this.get("result-kills").textContent = `${stats.kills}`;
    this.get("result-time").textContent = `${stats.elapsed.toFixed(1)}초`;
  }

  public setSound(enabled: boolean): void {
    this.get("sound-button").textContent = enabled ? "사운드 켜짐" : "사운드 꺼짐";
    this.get("pause-sound").textContent = enabled ? "사운드 끄기" : "사운드 켜기";
  }

  public setLowPower(enabled: boolean): void {
    this.get("low-power-button").textContent = enabled ? "저사양 모드 켜짐" : "저사양 모드 꺼짐";
  }

  public setShake(enabled: boolean): void {
    this.get("shake-button").textContent = enabled ? "화면 흔들림 켜짐" : "화면 흔들림 꺼짐";
  }

  public onSpecial(action: () => void): void {
    this.special.addEventListener("click", action);
  }

  private bind(id: string, action: () => void): void {
    this.get(id).addEventListener("click", action);
  }

  private get(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element: ${id}`);
    return element;
  }
}
