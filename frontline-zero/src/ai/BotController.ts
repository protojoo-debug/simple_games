import * as THREE from 'three';
import type { Damageable, Difficulty, Team } from '../types/game';
import type { PlayerController } from '../player/PlayerController';
import type { EffectsManager } from '../rendering/EffectsManager';

export type BotState = 'Patrol' | 'Investigate' | 'Chase' | 'Attack' | 'SeekCover' | 'Retreat' | 'Dead' | 'Respawn';

const difficultyConfig: Record<Difficulty, { reaction: number; accuracy: number }> = {
  easy: { reaction: 1.05, accuracy: 0.48 },
  normal: { reaction: 0.68, accuracy: 0.65 },
  hard: { reaction: 0.38, accuracy: 0.79 },
};

export class BotController implements Damageable {
  readonly team: Team = 'raider';
  readonly maxHealth = 140;
  health = 140;
  alive = true;
  state: BotState = 'Patrol';
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  readonly hitboxes: THREE.Object3D[] = [];
  private readonly spawn = new THREE.Vector3();
  private patrolTarget = new THREE.Vector3();
  private shotTimer = 0;
  private stateTimer = 0;
  private respawnTimer = 0;
  private lastSeen = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    readonly id: number,
    start: THREE.Vector3,
    scene: THREE.Scene,
    private readonly player: PlayerController,
    private readonly solids: THREE.Object3D[],
    private readonly effects: EffectsManager,
    private readonly difficulty: Difficulty,
    private readonly onPlayerDamage: (amount: number, source: THREE.Vector3) => void,
    private readonly onKilled: (bot: BotController) => void,
  ) {
    this.spawn.copy(start);
    this.group.position.copy(start);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.46, 0.9, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0xf15c69, emissive: 0x4c1018, roughness: 0.45 }),
    );
    body.position.y = 1.05;
    body.userData = { bot: this, headshot: false };
    const head = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: 0xffb66e, emissive: 0x562c12 }),
    );
    head.position.y = 2.03;
    head.userData = { bot: this, headshot: true };
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.045, 5, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd36e }),
    );
    marker.position.y = 2.62;
    marker.rotation.x = Math.PI / 2;
    this.group.add(body, head, marker);
    this.hitboxes.push(body, head);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    scene.add(this.group);
    this.pickPatrolTarget();
  }

  update(delta: number, others: BotController[], active: boolean): void {
    if (!active) return;
    if (!this.alive) {
      this.respawnTimer -= delta;
      this.state = this.respawnTimer > 0 ? 'Dead' : 'Respawn';
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    this.shotTimer -= delta;
    this.stateTimer -= delta;
    const toPlayer = this.player.position.clone().sub(this.position);
    const distance = toPlayer.length();
    const canSee = this.player.alive && distance < 32 && this.hasLineOfSight(toPlayer, distance);
    if (canSee) this.lastSeen.copy(this.player.position);

    if (this.health < 38) this.state = 'Retreat';
    else if (canSee && distance < 20) this.state = 'Attack';
    else if (canSee) this.state = 'Chase';
    else if (this.state === 'Attack' || this.state === 'Chase') {
      this.state = 'Investigate';
      this.stateTimer = 4;
    } else if (this.state === 'Investigate' && this.stateTimer <= 0) this.state = 'Patrol';

    if (this.state === 'Attack') {
      this.group.lookAt(this.player.position.x, this.position.y + 1, this.player.position.z);
      if (distance > 12) this.move(toPlayer, 2.5, delta, others);
      else this.strafe(delta, others);
      this.tryShoot(distance);
    } else if (this.state === 'Chase') {
      this.move(toPlayer, 3.7, delta, others);
    } else if (this.state === 'Investigate') {
      this.move(this.lastSeen.clone().sub(this.position), 2.6, delta, others);
    } else if (this.state === 'Retreat') {
      this.move(toPlayer.negate(), 3.2, delta, others);
      if (this.stateTimer <= 0) {
        this.health = Math.min(this.maxHealth, this.health + 12);
        this.stateTimer = 1;
      }
    } else {
      const toTarget = this.patrolTarget.clone().sub(this.position);
      if (toTarget.length() < 1.2) this.pickPatrolTarget();
      this.move(toTarget, 1.8, delta, others);
    }
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.alive = false;
      this.state = 'Dead';
      this.respawnTimer = 5;
      this.group.visible = false;
      this.effects.burst(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff6f62, 2.5);
      this.onKilled(this);
    } else {
      this.state = 'Chase';
      this.stateTimer = 3;
    }
  }

  reset(): void {
    this.health = this.maxHealth;
    this.alive = true;
    this.group.visible = true;
    this.position.copy(this.spawn);
    this.state = 'Patrol';
    this.respawnTimer = 0;
    this.pickPatrolTarget();
  }

  private tryShoot(distance: number): void {
    if (this.shotTimer > 0 || this.stateTimer > 0) return;
    const config = difficultyConfig[this.difficulty];
    this.shotTimer = 0.55 + Math.random() * 0.25;
    this.stateTimer = config.reaction * 0.25;
    const distancePenalty = THREE.MathUtils.clamp((distance - 8) / 35, 0, 0.22);
    if (Math.random() < config.accuracy - distancePenalty) {
      this.onPlayerDamage(8 + Math.random() * 4, this.position);
    }
    this.effects.burst(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffad67, 0.55);
  }

  private hasLineOfSight(direction: THREE.Vector3, distance: number): boolean {
    this.raycaster.set(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), direction.normalize());
    this.raycaster.far = distance;
    return this.raycaster.intersectObjects(this.solids, false).length === 0;
  }

  private move(direction: THREE.Vector3, speed: number, delta: number, others: BotController[]): void {
    direction.y = 0;
    if (direction.lengthSq() < 0.01) return;
    direction.normalize();
    const separation = new THREE.Vector3();
    for (const other of others) {
      if (other === this || !other.alive) continue;
      const away = this.position.clone().sub(other.position);
      if (away.lengthSq() < 3) separation.add(away.normalize().multiplyScalar(0.75));
    }
    direction.add(separation).normalize();
    const next = this.position.clone().addScaledVector(direction, speed * delta);
    next.x = THREE.MathUtils.clamp(next.x, -30, 30);
    next.z = THREE.MathUtils.clamp(next.z, -30, 30);
    this.position.copy(next);
    this.group.lookAt(next.clone().add(direction));
  }

  private strafe(delta: number, others: BotController[]): void {
    const direction = this.player.position.clone().sub(this.position);
    direction.set(-direction.z, 0, direction.x).multiplyScalar(Math.sin(performance.now() * 0.001 + this.id));
    this.move(direction, 1.9, delta, others);
  }

  private pickPatrolTarget(): void {
    const angle = this.id * 2.1 + Math.random();
    this.patrolTarget.set(Math.cos(angle) * (10 + this.id * 4), 0, Math.sin(angle) * (10 + this.id * 4));
  }

  private respawn(): void {
    this.health = this.maxHealth;
    this.alive = true;
    this.group.visible = true;
    this.position.copy(this.spawn);
    this.state = 'Patrol';
    this.pickPatrolTarget();
  }
}
