import type { StageEvent } from "../types";

export class StageSystem {
  private cursor = 0;

  public constructor(private readonly events: StageEvent[]) {}

  public reset(): void {
    this.cursor = 0;
  }

  public consume(progress: number): StageEvent[] {
    const due: StageEvent[] = [];
    while (this.cursor < this.events.length && this.events[this.cursor]!.distance <= progress) {
      due.push(this.events[this.cursor]!);
      this.cursor += 1;
    }
    return due;
  }
}
