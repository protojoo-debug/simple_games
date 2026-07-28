import type { Vector3 } from 'three';

export type Team = 'vanguard' | 'raider';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MatchState = 'menu' | 'playing' | 'paused' | 'dead' | 'result';

export interface Damageable {
  alive: boolean;
  health: number;
  maxHealth: number;
  team: Team;
  position: Vector3;
  takeDamage(amount: number, source?: Vector3): void;
}

export interface Settings {
  sensitivity: number;
  fov: number;
  quality: 'low' | 'medium' | 'high';
  shadows: boolean;
  renderScale: number;
  shake: number;
  sprintFov: number;
  masterVolume: number;
  sfxVolume: number;
  muted: boolean;
  crosshairSize: number;
  crosshairShape: 'cross' | 'dot' | 'ring';
  crosshairOpacity: number;
  difficulty: Difficulty;
}

export interface MatchSnapshot {
  state: MatchState;
  timeLeft: number;
  playerScore: number;
  enemyScore: number;
  captureProgress: number;
  captureStatus: string;
}
