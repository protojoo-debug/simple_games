import type { SettingsManager } from './SettingsManager';

type Sound = 'shot' | 'empty' | 'reload' | 'impact' | 'heal' | 'hurt' | 'kill' | 'ultimate' | 'capture' | 'victory' | 'defeat';

const soundMap: Record<Sound, [number, number, OscillatorType]> = {
  shot: [130, 0.045, 'sawtooth'],
  empty: [90, 0.08, 'square'],
  reload: [330, 0.09, 'triangle'],
  impact: [62, 0.22, 'sawtooth'],
  heal: [520, 0.32, 'sine'],
  hurt: [76, 0.18, 'square'],
  kill: [720, 0.2, 'triangle'],
  ultimate: [240, 0.65, 'sawtooth'],
  capture: [420, 0.12, 'sine'],
  victory: [660, 0.8, 'triangle'],
  defeat: [110, 0.8, 'sine'],
};

export class AudioManager {
  private context?: AudioContext;

  constructor(private readonly settings: SettingsManager) {}

  play(name: Sound, intensity = 1): void {
    const config = this.settings.value;
    if (config.muted || config.masterVolume <= 0 || config.sfxVolume <= 0) return;
    this.context ??= new AudioContext();
    const [frequency, duration, type] = soundMap[name];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, frequency * 0.6),
      this.context.currentTime + duration,
    );
    gain.gain.setValueAtTime(
      Math.min(0.09, config.masterVolume * config.sfxVolume * 0.075 * intensity),
      this.context.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
