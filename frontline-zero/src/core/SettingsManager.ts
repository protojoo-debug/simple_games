import type { Settings } from '../types/game';

const defaults: Settings = {
  sensitivity: 0.0022,
  fov: 90,
  quality: 'high',
  shadows: true,
  renderScale: 1,
  shake: 0.45,
  sprintFov: 0.65,
  masterVolume: 0.7,
  sfxVolume: 0.8,
  muted: false,
  crosshairSize: 12,
  crosshairShape: 'cross',
  crosshairOpacity: 0.9,
  difficulty: 'normal',
};

export class SettingsManager {
  value: Settings;

  constructor() {
    try {
      this.value = { ...defaults, ...JSON.parse(localStorage.getItem('fz-settings') ?? '{}') };
    } catch {
      this.value = { ...defaults };
    }
  }

  update(patch: Partial<Settings>): void {
    Object.assign(this.value, patch);
    localStorage.setItem('fz-settings', JSON.stringify(this.value));
    window.dispatchEvent(new CustomEvent('fz-settings', { detail: this.value }));
  }

  reset(): void {
    this.value = { ...defaults };
    this.update({});
  }
}
