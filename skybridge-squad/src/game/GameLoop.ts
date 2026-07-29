export class GameLoop {
  private frame = 0;
  private previous = 0;
  private running = false;

  public constructor(private readonly update: (dt: number) => void) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.previous) / 1000, 0.05);
    this.previous = now;
    this.update(dt);
    this.frame = requestAnimationFrame(this.tick);
  };
}
