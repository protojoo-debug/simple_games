import type { SettingsManager } from '../core/SettingsManager';
import type { Settings } from '../types/game';

export class MainMenu {
  readonly element: HTMLElement;
  private readonly settingsPanel: HTMLElement;

  constructor(
    private readonly settings: SettingsManager,
    private readonly onStart: () => void,
    private readonly onResume: () => void,
  ) {
    this.element = document.createElement('main');
    this.element.className = 'menu';
    document.body.append(this.element);
    this.buildMain();
    this.settingsPanel = this.createSettingsPanel();
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' && this.element.classList.contains('show')) {
        const action = this.element.querySelector<HTMLButtonElement>('.primary');
        action?.click();
      }
    });
  }

  private buildMain(): void {
    this.element.innerHTML = `
      <div class="menu-grid"></div><div class="menu-glow"></div>
      <section class="menu-copy">
        <div class="eyebrow"><i></i> ORBITAL RESPONSE // ACTIVE</div>
        <h1>FRONTLINE<span>:</span><br />ZERO</h1>
        <p>도시의 마지막 에너지 노드를 동기화하라.<br />빠른 기동, 정밀한 펄스, 한 번의 전선 탈환.</p>
        <div class="menu-actions">
          <button id="start" class="primary"><span>작전 개시</span><kbd>ENTER</kbd></button>
          <button id="settings-button"><span>시스템 설정</span><kbd>02</kbd></button>
        </div>
        <div class="mission-card">
          <small>오늘의 작전</small><strong>ENERGY NODE // 01</strong>
          <div><span>경기 03:00</span><span>목표 100</span><span>적 유닛 03</span></div>
        </div>
      </section>
      <section class="operative">
        <div class="operative-figure">
          <div class="head"></div><div class="torso"></div><div class="core"></div>
          <div class="arm left"></div><div class="arm right"></div><div class="rifle"></div>
        </div>
        <div class="operative-label"><small>SELECTED OPERATIVE</small><strong>VANGUARD-7</strong><span>전선 유지형 기동 요원</span></div>
      </section>
      <footer><span>WASD 이동 · MOUSE 조준 · E/F/Q 능력</span><span>BUILD 0.1 // LOCAL SIMULATION</span></footer>`;
    (this.element.querySelector('#start') as HTMLButtonElement).onclick = this.onStart;
    this.element.querySelector('#settings-button')!.addEventListener('click', () => this.openSettings());
  }

  show(mode: 'main' | 'pause' = 'main'): void {
    if (!this.element.querySelector('#start')) this.buildMain();
    this.element.classList.add('show');
    const start = this.element.querySelector('#start') as HTMLButtonElement;
    start.querySelector('span')!.textContent = mode === 'pause' ? '작전 복귀' : '작전 개시';
    start.onclick = mode === 'pause' ? this.onResume : this.onStart;
  }

  hide(): void {
    this.element.classList.remove('show');
    this.settingsPanel.classList.remove('show');
  }

  showResult(victory: boolean, playerScore: number, enemyScore: number, kills: number): void {
    this.settingsPanel.classList.remove('show');
    this.element.innerHTML = `
      <div class="menu-grid"></div><div class="result-card ${victory ? 'victory' : 'defeat'}">
        <small>OPERATION COMPLETE</small>
        <h2>${victory ? '노드 확보' : '동기화 실패'}</h2>
        <p>${victory ? '도시 에너지 망이 안정화되었습니다.' : '적의 침투를 차단하지 못했습니다.'}</p>
        <div class="result-score"><strong>${Math.floor(playerScore)}</strong><span>:</span><strong>${Math.floor(enemyScore)}</strong></div>
        <div class="result-stats"><span>처치 <b>${kills}</b></span><span>요원 <b>VANGUARD-7</b></span></div>
        <button id="replay" class="primary"><span>다시 플레이</span><kbd>ENTER</kbd></button>
      </div>`;
    this.element.querySelector('#replay')!.addEventListener('click', this.onStart);
    this.element.classList.add('show');
  }

  private openSettings(): void {
    this.settingsPanel.classList.add('show');
  }

  private createSettingsPanel(): HTMLElement {
    const panel = document.createElement('aside');
    panel.className = 'settings-panel';
    const value = this.settings.value;
    panel.innerHTML = `
      <div class="settings-head"><span><small>SYSTEM</small><b>전술 설정</b></span><button id="close-settings">닫기 ×</button></div>
      <div class="settings-scroll">
        ${this.range('sensitivity', '마우스 감도', value.sensitivity, 0.0008, 0.006, 0.0001)}
        ${this.range('fov', '시야각', value.fov, 75, 110, 1)}
        ${this.select('quality', '그래픽 품질', value.quality, [['low', '낮음'], ['medium', '중간'], ['high', '높음']])}
        ${this.toggle('shadows', '동적 그림자', value.shadows)}
        ${this.range('renderScale', '렌더링 배율', value.renderScale, 0.6, 1, 0.05)}
        ${this.range('shake', '화면 흔들림', value.shake, 0, 1, 0.05)}
        ${this.range('sprintFov', '질주 시 시야 변화', value.sprintFov, 0, 1, 0.05)}
        ${this.range('masterVolume', '전체 음량', value.masterVolume, 0, 1, 0.05)}
        ${this.range('sfxVolume', '효과음 음량', value.sfxVolume, 0, 1, 0.05)}
        ${this.toggle('muted', '음소거', value.muted)}
        ${this.range('crosshairSize', '조준점 크기', value.crosshairSize, 6, 24, 1)}
        ${this.select('crosshairShape', '조준점 모양', value.crosshairShape, [['cross', '십자'], ['dot', '점'], ['ring', '링']])}
        ${this.range('crosshairOpacity', '조준점 투명도', value.crosshairOpacity, 0.25, 1, 0.05)}
        ${this.select('difficulty', '봇 난이도', value.difficulty, [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']])}
      </div>`;
    document.body.append(panel);
    panel.querySelector('#close-settings')!.addEventListener('click', () => panel.classList.remove('show'));
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((control) => {
      control.addEventListener('input', () => {
        const key = control.dataset.key as keyof Settings;
        const next =
          control instanceof HTMLInputElement && control.type === 'checkbox'
            ? control.checked
            : control instanceof HTMLInputElement && control.type === 'range'
              ? Number(control.value)
              : control.value;
        this.settings.update({ [key]: next } as Partial<Settings>);
        const output = control.parentElement?.querySelector('output');
        if (output) output.textContent = typeof next === 'number' ? next.toFixed(next < 1 ? 2 : 0) : '';
      });
    });
    return panel;
  }

  private range(key: keyof Settings, label: string, value: number, min: number, max: number, step: number): string {
    return `<label class="setting"><span>${label}<output>${value.toFixed(value < 1 ? 2 : 0)}</output></span><input data-key="${key}" type="range" value="${value}" min="${min}" max="${max}" step="${step}" /></label>`;
  }

  private toggle(key: keyof Settings, label: string, value: boolean): string {
    return `<label class="setting toggle"><span>${label}</span><input data-key="${key}" type="checkbox" ${value ? 'checked' : ''} /><i></i></label>`;
  }

  private select(key: keyof Settings, label: string, value: string, options: string[][]): string {
    return `<label class="setting"><span>${label}</span><select data-key="${key}">${options.map(([keyValue, text]) => `<option value="${keyValue}" ${keyValue === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
  }
}
