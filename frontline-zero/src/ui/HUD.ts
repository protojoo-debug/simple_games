import type { AbilityController } from '../player/AbilityController';
import type { PlayerController } from '../player/PlayerController';
import type { WeaponController } from '../player/WeaponController';
import type { MatchSnapshot, Settings } from '../types/game';

const formatTime = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

export class HUD {
  private readonly health: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly score: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly captureFill: HTMLElement;
  private readonly captureText: HTMLElement;
  private readonly ultimateFill: HTMLElement;
  private readonly ultimateText: HTMLElement;
  private readonly repair: HTMLElement;
  private readonly burst: HTMLElement;
  private readonly fps: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hitMarker: HTMLElement;
  private readonly damageVignette: HTMLElement;
  private readonly lowHealth: HTMLElement;
  private readonly analysis: HTMLElement;
  private readonly scoreboard: HTMLElement;
  private readonly respawn: HTMLElement;
  private toastTimer = 0;
  private fpsTimer = 0;
  private frames = 0;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="hud" id="hud">
        <div class="topbar">
          <div class="brand-chip">FZ // NODE-01</div>
          <div class="objective">
            <div class="scores" id="score">000 <span>—</span> 000</div>
            <div class="capture-track"><div id="capture-fill"></div><i></i></div>
            <div class="capture-label" id="capture-text">중립</div>
          </div>
          <div class="timer" id="timer">3:00</div>
        </div>
        <div class="reticle cross" id="crosshair"><i></i><i></i><i></i><i></i></div>
        <div class="hit-marker" id="hit-marker"><i></i><i></i><i></i><i></i></div>
        <div class="damage-vignette" id="damage-vignette"></div>
        <div class="low-health" id="low-health">생체 신호 위험</div>
        <div class="analysis-frame" id="analysis"><span>TACTICAL ANALYSIS // ACTIVE</span></div>
        <div class="status-cluster">
          <div class="health-copy"><span>VANGUARD-7</span><strong id="health">220 / 220</strong></div>
          <div class="health-track"><div id="health-fill"></div></div>
          <div class="healing-label" id="healing-label">+ 비콘 회복 중</div>
        </div>
        <div class="ability-cluster">
          <div class="ability" id="repair"><kbd>E</kbd><b>리페어 비콘</b><span>READY</span></div>
          <div class="ability ultimate"><kbd>Q</kbd><b>전술 분석</b><span id="ultimate-text">0%</span><div><i id="ultimate-fill"></i></div></div>
          <div class="ability" id="burst"><kbd>F</kbd><b>임팩트 버스트</b><span>READY</span></div>
        </div>
        <div class="weapon-cluster">
          <small>AX-9 // PULSE</small>
          <strong id="ammo">30</strong><span>/ ∞</span>
          <div class="fire-mode">AUTO · 9 RPS</div>
        </div>
        <div class="toast" id="toast"></div>
        <div class="fps" id="fps">60 FPS</div>
        <div class="scoreboard" id="scoreboard">
          <h3>전술 상황판</h3><div><span>VANGUARD-7</span><b id="board-kills">0 처치</b></div>
          <div><span>RAIDER 유닛</span><b>3 활성</b></div>
        </div>
        <div class="respawn-screen" id="respawn"><span>신호 소실</span><strong>재투입까지 5</strong></div>
      </div>`;
    const get = (id: string): HTMLElement => root.querySelector(`#${id}`)!;
    this.health = get('health');
    this.healthFill = get('health-fill');
    this.ammo = get('ammo');
    this.score = get('score');
    this.timer = get('timer');
    this.captureFill = get('capture-fill');
    this.captureText = get('capture-text');
    this.ultimateFill = get('ultimate-fill');
    this.ultimateText = get('ultimate-text');
    this.repair = get('repair');
    this.burst = get('burst');
    this.fps = get('fps');
    this.crosshair = get('crosshair');
    this.hitMarker = get('hit-marker');
    this.damageVignette = get('damage-vignette');
    this.lowHealth = get('low-health');
    this.analysis = get('analysis');
    this.scoreboard = get('scoreboard');
    this.respawn = get('respawn');
  }

  update(
    delta: number,
    player: PlayerController,
    weapon: WeaponController,
    ability: AbilityController,
    match: MatchSnapshot,
    settings: Settings,
    tabHeld: boolean,
  ): void {
    this.health.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
    this.healthFill.style.width = `${(player.health / player.maxHealth) * 100}%`;
    this.ammo.textContent = weapon.reloading ? '··' : String(weapon.ammo).padStart(2, '0');
    this.score.innerHTML = `${Math.floor(match.playerScore).toString().padStart(3, '0')} <span>—</span> ${Math.floor(match.enemyScore).toString().padStart(3, '0')}`;
    this.timer.textContent = formatTime(match.timeLeft);
    this.captureFill.style.width = `${match.captureProgress * 100}%`;
    this.captureText.textContent = match.captureStatus;
    this.ultimateFill.style.width = `${weapon.ultimate}%`;
    this.ultimateText.textContent = weapon.ultimate >= 100 ? 'READY' : `${Math.floor(weapon.ultimate)}%`;
    this.repair.classList.toggle('cooling', ability.repairCooldown > 0);
    this.repair.querySelector('span')!.textContent = ability.repairCooldown > 0 ? ability.repairCooldown.toFixed(1) : 'READY';
    this.burst.classList.toggle('cooling', ability.burstCooldown > 0);
    this.burst.querySelector('span')!.textContent = ability.burstCooldown > 0 ? ability.burstCooldown.toFixed(1) : 'READY';
    this.root.querySelector('#healing-label')!.classList.toggle('show', ability.healing);
    this.root.querySelector('#board-kills')!.textContent = `${player.kills} 처치`;
    this.hitMarker.classList.toggle('show', weapon.hitMarker > 0);
    this.hitMarker.classList.toggle('headshot', weapon.headshotMarker > 0);
    this.lowHealth.classList.toggle('show', player.health > 0 && player.health < 55);
    this.analysis.classList.toggle('show', ability.analysisActive);
    this.scoreboard.classList.toggle('show', tabHeld);
    this.respawn.classList.toggle('show', !player.alive);
    this.respawn.querySelector('strong')!.textContent = `재투입까지 ${Math.ceil(player.respawnRemaining)}`;
    this.crosshair.className = `reticle ${settings.crosshairShape}`;
    this.crosshair.style.setProperty('--size', `${settings.crosshairSize}px`);
    this.crosshair.style.opacity = String(settings.crosshairOpacity);
    this.toastTimer -= delta;
    if (this.toastTimer <= 0) this.root.querySelector('#toast')!.classList.remove('show');
    this.frames += 1;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      this.fps.textContent = `${Math.round(this.frames / this.fpsTimer)} FPS`;
      this.frames = 0;
      this.fpsTimer = 0;
    }
  }

  notify(message: string, tone = ''): void {
    const toast = this.root.querySelector('#toast')!;
    toast.textContent = message;
    toast.className = `toast show ${tone}`;
    this.toastTimer = 2.2;
  }

  flashDamage(): void {
    this.damageVignette.classList.remove('flash');
    requestAnimationFrame(() => this.damageVignette.classList.add('flash'));
  }

  show(): void {
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
  }
}
