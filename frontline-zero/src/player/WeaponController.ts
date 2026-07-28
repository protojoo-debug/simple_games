import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { AudioManager } from '../core/AudioManager';
import type { PlayerController } from './PlayerController';
import type { BotController } from '../ai/BotController';
import type { EffectsManager } from '../rendering/EffectsManager';
import { calculateDamage, chargeUltimate, finishReload, spendAmmo } from '../utils/combat';

export class WeaponController {
  ammo = 30;
  readonly magazine = 30;
  reloading = false;
  reloadRemaining = 0;
  ultimate = 0;
  hitMarker = 0;
  headshotMarker = 0;
  spread = 0;
  private shotCooldown = 0;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: InputManager,
    private readonly player: PlayerController,
    private readonly bots: BotController[],
    private readonly solids: THREE.Object3D[],
    private readonly effects: EffectsManager,
    private readonly audio: AudioManager,
    private readonly onHit: (headshot: boolean) => void,
  ) {}

  update(delta: number, canFire: boolean, reloadMultiplier = 1): void {
    this.shotCooldown = Math.max(0, this.shotCooldown - delta);
    this.hitMarker = Math.max(0, this.hitMarker - delta);
    this.headshotMarker = Math.max(0, this.headshotMarker - delta);
    this.spread = Math.max(0, this.spread - delta * 0.04);
    if (this.reloading) {
      this.reloadRemaining -= delta * reloadMultiplier;
      if (this.reloadRemaining <= 0) {
        this.ammo = finishReload(this.magazine);
        this.reloading = false;
      }
      return;
    }
    if (this.input.consume('KeyR') && this.ammo < this.magazine) this.reload();
    if (!canFire || !this.input.mouseDown || this.player.sprinting) return;
    if (this.ammo <= 0) {
      if (this.shotCooldown <= 0) {
        this.audio.play('empty');
        this.shotCooldown = 0.25;
      }
      return;
    }
    if (this.shotCooldown <= 0) this.fire();
  }

  addUltimate(amount: number): void {
    this.ultimate = chargeUltimate(this.ultimate, amount);
  }

  private fire(): void {
    this.ammo = spendAmmo(this.ammo);
    this.shotCooldown = 1 / 9;
    this.spread = Math.min(0.035, this.spread + 0.0038);
    this.audio.play('shot');
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.x += (Math.random() - 0.5) * this.spread;
    direction.y += (Math.random() - 0.5) * this.spread;
    direction.z += (Math.random() - 0.5) * this.spread;
    direction.normalize();
    this.raycaster.set(this.camera.position, direction);
    this.raycaster.far = 80;
    const targets = this.bots.flatMap((bot) => bot.hitboxes);
    const hit = this.raycaster.intersectObjects(targets, false).find((candidate) => {
      const bot = candidate.object.userData.bot as BotController | undefined;
      return bot?.alive;
    });
    const wall = this.raycaster.intersectObjects(this.solids, false)[0];
    if (!hit || (wall && wall.distance < hit.distance)) {
      this.effects.burst(this.camera.position.clone().addScaledVector(direction, 18), 0x72dfee, 0.3);
      return;
    }
    const bot = hit.object.userData.bot as BotController;
    const headshot = Boolean(hit.object.userData.headshot);
    const damage = calculateDamage(18, hit.distance, headshot);
    bot.takeDamage(damage);
    this.addUltimate(damage * 0.2);
    this.hitMarker = 0.12;
    this.headshotMarker = headshot ? 0.22 : 0;
    this.effects.burst(hit.point, headshot ? 0xffdc78 : 0x8df6ff, headshot ? 0.85 : 0.5);
    this.onHit(headshot);
  }

  private reload(): void {
    this.reloading = true;
    this.reloadRemaining = 1.6;
    this.audio.play('reload');
  }
}
