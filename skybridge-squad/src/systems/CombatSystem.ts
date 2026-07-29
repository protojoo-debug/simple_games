import type { Boss } from "../entities/Boss";
import type { Enemy } from "../entities/Enemy";

export class CombatSystem {
  public nearestTarget(enemies: Enemy[], boss: Boss | null): Enemy | Boss | null {
    let target: Enemy | Boss | null = boss?.active ? boss : null;
    let nearestZ = boss?.active ? boss.group.position.z : Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (!enemy.active || enemy.group.position.z < -1) continue;
      if (enemy.group.position.z < nearestZ) {
        nearestZ = enemy.group.position.z;
        target = enemy;
      }
    }
    return target;
  }
}
