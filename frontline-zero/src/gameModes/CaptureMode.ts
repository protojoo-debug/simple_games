import * as THREE from 'three';
import type { PlayerController } from '../player/PlayerController';
import type { BotController } from '../ai/BotController';
import type { MatchSnapshot, Team } from '../types/game';
import { captureDelta, shouldEndMatch } from '../utils/combat';

export class CaptureMode {
  timeLeft = 180;
  playerScore = 0;
  enemyScore = 0;
  progress = 0.5;
  owner?: Team;
  status = '중립';
  private captureToneTimer = 0;

  constructor(
    private readonly center: THREE.Vector3,
    private readonly player: PlayerController,
    private readonly bots: BotController[],
    private readonly onCaptureTick: () => void,
    private readonly onEnd: (result: 'victory' | 'defeat') => void,
  ) {}

  update(delta: number, active: boolean): void {
    if (!active) return;
    this.timeLeft = Math.max(0, this.timeLeft - delta);
    const playerPresent = this.player.alive && this.player.position.distanceTo(this.center) <= 6;
    const enemiesPresent = this.bots.some((bot) => bot.alive && bot.position.distanceTo(this.center) <= 6);
    if (playerPresent && enemiesPresent) {
      this.status = '경합 중';
    } else {
      this.progress = THREE.MathUtils.clamp(
        this.progress + captureDelta(playerPresent, enemiesPresent, delta),
        0,
        1,
      );
      if (playerPresent) this.status = 'VANGUARD 동기화';
      else if (enemiesPresent) this.status = 'RAIDER 침투';
      else this.status = this.owner ? (this.owner === 'vanguard' ? '아군 제어' : '적군 제어') : '중립';
    }
    if (this.progress >= 1) this.owner = 'vanguard';
    if (this.progress <= 0) this.owner = 'raider';
    if (this.owner === 'vanguard') this.playerScore = Math.min(100, this.playerScore + delta * 3.2);
    if (this.owner === 'raider') this.enemyScore = Math.min(100, this.enemyScore + delta * 3.2);
    this.captureToneTimer -= delta;
    if ((playerPresent || enemiesPresent) && this.captureToneTimer <= 0) {
      this.onCaptureTick();
      this.captureToneTimer = 2.5;
    }
    const result = shouldEndMatch(this.playerScore, this.enemyScore, this.timeLeft);
    if (result) this.onEnd(result);
  }

  reset(): void {
    this.timeLeft = 180;
    this.playerScore = 0;
    this.enemyScore = 0;
    this.progress = 0.5;
    this.owner = undefined;
    this.status = '중립';
  }

  snapshot(state: MatchSnapshot['state']): MatchSnapshot {
    return {
      state,
      timeLeft: this.timeLeft,
      playerScore: this.playerScore,
      enemyScore: this.enemyScore,
      captureProgress: this.progress,
      captureStatus: this.status,
    };
  }
}
