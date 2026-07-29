export type GameState = "menu" | "playing" | "paused" | "gameOver" | "stageClear";
export type EnemyKind = "grunt" | "shield" | "ranged" | "charger";
export type GateOperation = "add" | "multiply" | "subtract" | "divide" | "damage" | "rapid" | "multi";
export type ObstacleKind = "blade" | "boulder" | "barrel" | "wall";

export interface StageEvent {
  distance: number;
  type: "enemyGroup" | "gatePair" | "obstacle" | "boss";
  config: Record<string, unknown>;
}

export interface GameStats {
  kills: number;
  damageTaken: number;
  gates: number;
  elapsed: number;
  bossDefeated: boolean;
}
