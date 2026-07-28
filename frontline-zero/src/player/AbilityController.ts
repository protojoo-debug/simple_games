import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { AudioManager } from '../core/AudioManager';
import type { PlayerController } from './PlayerController';
import type { WeaponController } from './WeaponController';
import type { BotController } from '../ai/BotController';
import type { EffectsManager } from '../rendering/EffectsManager';
import { tickCooldown } from '../utils/combat';

export class AbilityController {
  repairCooldown = 0;
  burstCooldown = 0;
  repairRemaining = 0;
  analysisRemaining = 0;
  healing = false;
  readonly beacon: THREE.Group;
  private projectile?: THREE.Mesh;
  private projectileDirection = new THREE.Vector3();
  private projectileDistance = 0;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: InputManager,
    private readonly player: PlayerController,
    private readonly weapon: WeaponController,
    private readonly bots: BotController[],
    private readonly solids: THREE.Object3D[],
    private readonly effects: EffectsManager,
    private readonly audio: AudioManager,
    private readonly notify: (message: string, tone?: string) => void,
  ) {
    this.beacon = this.makeBeacon();
    this.scene.add(this.beacon);
  }

  get analysisActive(): boolean {
    return this.analysisRemaining > 0;
  }

  update(delta: number, active: boolean): void {
    this.repairCooldown = tickCooldown(this.repairCooldown, delta);
    this.burstCooldown = tickCooldown(this.burstCooldown, delta);
    this.analysisRemaining = tickCooldown(this.analysisRemaining, delta);
    this.healing = false;
    if (!active) return;
    if (this.input.consume('KeyE') && this.repairCooldown <= 0) this.deployBeacon();
    if (this.input.consume('KeyF') && this.burstCooldown <= 0 && !this.player.sprinting) this.fireBurst();
    if (this.input.consume('KeyQ') && this.weapon.ultimate >= 100) this.activateAnalysis();
    this.updateBeacon(delta);
    this.updateProjectile(delta);
    if (this.analysisActive) this.applyAimAssist(delta);
  }

  private deployBeacon(): void {
    this.repairCooldown = 14;
    this.repairRemaining = 5;
    this.beacon.position.copy(this.player.position);
    this.beacon.position.y = 0.04;
    this.beacon.visible = true;
    this.audio.play('heal');
    this.notify('나노 리페어 비콘 배치', 'heal');
  }

  private updateBeacon(delta: number): void {
    if (this.repairRemaining <= 0) {
      this.beacon.visible = false;
      return;
    }
    this.repairRemaining -= delta;
    this.beacon.rotation.y += delta;
    const distance = this.player.position.distanceTo(this.beacon.position);
    if (distance <= 4 && this.player.health < this.player.maxHealth) {
      this.player.heal(28 * delta);
      this.healing = true;
    }
  }

  private fireBurst(): void {
    this.burstCooldown = 7;
    this.projectileDistance = 0;
    this.projectileDirection.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    this.projectile ??= new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 1),
      new THREE.MeshBasicMaterial({ color: 0xffc45e }),
    );
    this.projectile.position.copy(this.camera.position).addScaledVector(this.projectileDirection, 0.8);
    this.projectile.visible = true;
    this.scene.add(this.projectile);
    this.audio.play('impact', 0.65);
  }

  private updateProjectile(delta: number): void {
    if (!this.projectile?.visible) return;
    const distance = 24 * delta;
    this.projectile.position.addScaledVector(this.projectileDirection, distance);
    this.projectileDistance += distance;
    this.raycaster.set(this.projectile.position, this.projectileDirection);
    this.raycaster.far = 0.6;
    const botHit = this.raycaster
      .intersectObjects(this.bots.flatMap((bot) => bot.hitboxes), false)
      .find((hit) => (hit.object.userData.bot as BotController | undefined)?.alive);
    const wallHit = this.raycaster.intersectObjects(this.solids, false)[0];
    if (botHit || wallHit || this.projectileDistance >= 35) {
      const direct = botHit?.object.userData.bot as BotController | undefined;
      if (direct) direct.takeDamage(70);
      this.explode(this.projectile.position, direct);
      this.projectile.visible = false;
    }
  }

  private explode(position: THREE.Vector3, direct?: BotController): void {
    for (const bot of this.bots) {
      if (!bot.alive || bot === direct) continue;
      const distance = bot.position.distanceTo(position);
      if (distance <= 3) bot.takeDamage(50 * (1 - distance / 3));
    }
    this.effects.burst(position, 0xffb84e, 3);
    this.audio.play('impact');
  }

  private activateAnalysis(): void {
    this.weapon.ultimate = 0;
    this.analysisRemaining = 6;
    this.audio.play('ultimate');
    this.notify('전술 분석 모드 활성화', 'ultimate');
  }

  private applyAimAssist(delta: number): void {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    let target: BotController | undefined;
    let bestAngle = 0.24;
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      const direction = bot.position.clone().add(new THREE.Vector3(0, 1.25, 0)).sub(this.camera.position);
      const distance = direction.length();
      if (distance > 35 || this.blocked(direction, distance)) continue;
      const angle = forward.angleTo(direction.normalize());
      if (angle < bestAngle) {
        bestAngle = angle;
        target = bot;
      }
    }
    if (!target) return;
    const desired = target.position.clone().add(new THREE.Vector3(0, 1.25, 0)).sub(this.camera.position);
    const desiredYaw = Math.atan2(-desired.x, -desired.z);
    const desiredPitch = Math.atan2(desired.y, Math.hypot(desired.x, desired.z));
    const maxStep = delta * 1.2;
    this.player.yaw += THREE.MathUtils.clamp(desiredYaw - this.player.yaw, -maxStep, maxStep);
    this.player.pitch += THREE.MathUtils.clamp(desiredPitch - this.player.pitch, -maxStep, maxStep);
  }

  private blocked(direction: THREE.Vector3, distance: number): boolean {
    this.raycaster.set(this.camera.position, direction.normalize());
    this.raycaster.far = distance;
    return this.raycaster.intersectObjects(this.solids, false).length > 0;
  }

  private makeBeacon(): THREE.Group {
    const group = new THREE.Group();
    group.visible = false;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.85, 4, 48),
      new THREE.MeshBasicMaterial({ color: 0x65ffd1, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    const device = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 0.32, 6),
      new THREE.MeshStandardMaterial({ color: 0x73f8d6, emissive: 0x1c8f76 }),
    );
    device.position.y = 0.16;
    group.add(ring, device);
    return group;
  }
}
