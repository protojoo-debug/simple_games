type SoundName =
  | "shoot"
  | "hit"
  | "destroy"
  | "gate"
  | "gain"
  | "lose"
  | "boss"
  | "victory"
  | "gameOver"
  | "special";

export class AudioManager {
  private context: AudioContext | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async resume(): Promise<void> {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }

  public play(name: SoundName): void {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const presets: Record<SoundName, [number, number, OscillatorType, number]> = {
      shoot: [580, 120, "square", 0.045],
      hit: [180, 90, "sawtooth", 0.06],
      destroy: [120, 42, "sawtooth", 0.16],
      gate: [440, 780, "sine", 0.18],
      gain: [520, 920, "triangle", 0.24],
      lose: [260, 95, "square", 0.22],
      boss: [90, 42, "sawtooth", 0.7],
      victory: [520, 1040, "triangle", 0.6],
      gameOver: [220, 55, "sawtooth", 0.65],
      special: [180, 1400, "sine", 0.35],
    };
    const [from, to, type, duration] = presets[name];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), this.context.currentTime + duration);
    gain.gain.setValueAtTime(name === "shoot" ? 0.025 : 0.055, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
