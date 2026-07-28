import * as THREE from 'three';
import type { Body } from 'cannon-es';
import type { InputManager } from '../core/InputManager';
import type { SettingsManager } from '../core/SettingsManager';
import { healCapped } from '../utils/combat';

export class PlayerController {
  readonly maxHealth = 220;
  health = 220;
  alive = true;
  kills = 0;
  yaw = 0;
  pitch = 0;
  sprinting = false;
  aiming = false;
  respawnRemaining = 0;
  private grounded = false;
  private hurtDirection = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly body: Body,
    private readonly input: InputManager,
    private readonly settings: SettingsManager,
    private readonly onHurt: (amount: number, direction: number) => void,
    private readonly onDeath: () => void,
  ) {}

  get position(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
  }

  update(delta: number, canMove: boolean): void {
    if (!this.alive || !canMove) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      return;
    }
    const value = this.settings.value;
    this.yaw -= this.input.lookX * value.sensitivity;
    this.pitch -= this.input.lookY * value.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.48, 1.48);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const forward = Number(this.input.isDown('KeyW')) - Number(this.input.isDown('KeyS'));
    const side = Number(this.input.isDown('KeyD')) - Number(this.input.isDown('KeyA'));
    this.aiming = this.input.aimDown;
    this.sprinting = this.input.isDown('ShiftLeft') && forward > 0 && !this.aiming;
    const speed = this.sprinting ? 8.2 : this.aiming ? 3.7 : 5.5;
    const direction = new THREE.Vector3(side, 0, -forward);
    if (direction.lengthSq() > 0) {
      direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }
    this.body.velocity.x = direction.x * speed;
    this.body.velocity.z = direction.z * speed;

    this.grounded = this.body.position.y <= 1.04 && Math.abs(this.body.velocity.y) < 0.5;
    if (this.input.consume('Space') && this.grounded) this.body.velocity.y = 7.3;
    if (this.body.position.y < -5) this.takeDamage(999);

    const bob = direction.lengthSq() > 0 ? Math.sin(performance.now() * 0.012) * 0.025 : 0;
    this.camera.position.set(this.body.position.x, this.body.position.y + 0.48 + bob, this.body.position.z);
    const targetFov = value.fov + (this.sprinting ? 7 * value.sprintFov : this.aiming ? -10 : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-delta * 7));
    this.camera.updateProjectionMatrix();
    this.hurtDirection *= Math.exp(-delta * 5);
  }

  takeDamage(amount: number, source?: THREE.Vector3): void {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (source) {
      const incoming = source.clone().sub(this.position);
      this.hurtDirection = Math.atan2(incoming.x, incoming.z) - this.yaw;
    }
    this.onHurt(amount, this.hurtDirection);
    if (this.health <= 0) {
      this.alive = false;
      this.respawnRemaining = 5;
      this.onDeath();
    }
  }

  heal(amount: number): void {
    this.health = healCapped(this.health, amount, this.maxHealth);
  }

  respawn(): void {
    this.health = this.maxHealth;
    this.alive = true;
    this.respawnRemaining = 0;
  }
}
