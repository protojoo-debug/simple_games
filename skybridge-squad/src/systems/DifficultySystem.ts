export class DifficultySystem {
  public enemySpeed(progressRatio: number): number {
    return 7 + progressRatio * 1.4;
  }

  public collisionDamage(enemyHealth: number): number {
    return Math.max(2, Math.min(12, Math.ceil(enemyHealth * 0.3)));
  }
}
