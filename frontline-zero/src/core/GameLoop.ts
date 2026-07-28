export class GameLoop {
  private frame = 0;
  private last = performance.now();
  private running = false;

  constructor(private readonly update: (delta: number, now: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const delta = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.update(delta, now);
    this.frame = requestAnimationFrame(this.tick);
  };
}
