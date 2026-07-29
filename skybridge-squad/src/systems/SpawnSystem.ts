import * as THREE from "three";
import { Enemy } from "../entities/Enemy";
import { Gate } from "../entities/Gate";
import { Obstacle } from "../entities/Obstacle";
import type { EnemyKind, GateOperation, ObstacleKind, StageEvent } from "../types";

interface GateConfig {
  operation: GateOperation;
  value: number;
}

export interface SpawnBatch {
  enemies: Enemy[];
  gates: Gate[];
  obstacles: Obstacle[];
  boss: boolean;
}

export class SpawnSystem {
  public spawn(event: StageEvent, scene: THREE.Scene): SpawnBatch {
    const result: SpawnBatch = { enemies: [], gates: [], obstacles: [], boss: false };
    if (event.type === "enemyGroup") {
      const left = Number(event.config.left ?? 10);
      const right = Number(event.config.right ?? 20);
      const kind = (event.config.kind ?? "grunt") as EnemyKind;
      result.enemies.push(new Enemy(left, kind, -2, 53), new Enemy(right, kind, 2, 53));
      result.enemies.forEach((enemy) => scene.add(enemy.group));
    } else if (event.type === "gatePair") {
      const left = event.config.left as GateConfig;
      const right = event.config.right as GateConfig;
      result.gates.push(
        new Gate(left.operation, left.value, "left", 52),
        new Gate(right.operation, right.value, "right", 52),
      );
      result.gates.forEach((gate) => scene.add(gate.group));
    } else if (event.type === "obstacle") {
      const kinds = (event.config.kinds ?? ["blade", "barrel"]) as ObstacleKind[];
      kinds.forEach((kind, index) => {
        const lanes = [-2.25, 0, 2.25];
        const obstacle = new Obstacle(kind, lanes[index % lanes.length]!, 50 + index * 7);
        result.obstacles.push(obstacle);
        scene.add(obstacle.group);
      });
    } else if (event.type === "boss") {
      result.boss = true;
    }
    return result;
  }
}
