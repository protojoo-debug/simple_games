import type { StageEvent } from "../types";

export const stage1: StageEvent[] = [
  { distance: 42, type: "enemyGroup", config: { left: 12, right: 22, kind: "grunt" } },
  {
    distance: 94,
    type: "gatePair",
    config: {
      left: { operation: "add", value: 10 },
      right: { operation: "multiply", value: 2 },
    },
  },
  { distance: 150, type: "obstacle", config: { kinds: ["blade", "barrel", "boulder"] } },
  { distance: 205, type: "enemyGroup", config: { left: 26, right: 38, kind: "shield" } },
  {
    distance: 263,
    type: "gatePair",
    config: {
      left: { operation: "rapid", value: 0.72 },
      right: { operation: "damage", value: 1 },
    },
  },
  { distance: 318, type: "enemyGroup", config: { left: 34, right: 48, kind: "ranged" } },
  {
    distance: 370,
    type: "gatePair",
    config: {
      left: { operation: "add", value: 16 },
      right: { operation: "multi", value: 1 },
    },
  },
  { distance: 423, type: "obstacle", config: { kinds: ["wall", "blade", "barrel"] } },
  { distance: 474, type: "enemyGroup", config: { left: 42, right: 58, kind: "charger" } },
  {
    distance: 505,
    type: "gatePair",
    config: {
      left: { operation: "subtract", value: 8 },
      right: { operation: "multiply", value: 2 },
    },
  },
  { distance: 535, type: "boss", config: {} },
];
