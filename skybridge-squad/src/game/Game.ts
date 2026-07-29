import * as THREE from "three";
import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import { Gate } from "../entities/Gate";
import { Obstacle } from "../entities/Obstacle";
import { PlayerArmy } from "../entities/PlayerArmy";
import { Projectile } from "../entities/Projectile";
import { stage1 } from "../stages/stage1";
import { CombatSystem } from "../systems/CombatSystem";
import { DifficultySystem } from "../systems/DifficultySystem";
import { Pool } from "../systems/Pool";
import { SpawnSystem } from "../systems/SpawnSystem";
import { StageSystem } from "../systems/StageSystem";
import type { GameState, GameStats } from "../types";
import { clamp, randomRange } from "../utils/math";
import { AudioManager } from "./AudioManager";
import { CollisionManager } from "./CollisionManager";
import {
  BEST_SCORE_KEY,
  BOSS_DISTANCE,
  CAMERA_FOV,
  GAME_WIDTH,
  LATERAL_SPEED,
  LOW_POWER_PIXEL_RATIO,
  MAX_PIXEL_RATIO,
  PLAYER_Z,
  PROJECTILE_LIFETIME,
  PROJECTILE_SPEED,
  RUN_SPEED,
  SPECIAL_COOLDOWN,
  STAGE_LENGTH,
} from "./constants";
import { GameLoop } from "./GameLoop";
import { InputManager } from "./InputManager";
import type { UIManager } from "../ui/UIManager";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface BossWarning {
  mesh: THREE.Mesh;
  lane: number;
  timer: number;
}

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 180);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly player: PlayerArmy;
  private readonly input: InputManager;
  private readonly audio = new AudioManager();
  private readonly loop: GameLoop;
  private readonly stage = new StageSystem(stage1);
  private readonly spawner = new SpawnSystem();
  private readonly combat = new CombatSystem();
  private readonly difficulty = new DifficultySystem();
  private readonly projectilePool: Pool<Projectile>;
  private readonly projectiles: Projectile[] = [];
  private readonly enemies: Enemy[] = [];
  private readonly gates: Gate[] = [];
  private readonly obstacles: Obstacle[] = [];
  private readonly particles: Particle[] = [];
  private readonly bridgeTiles: THREE.Group[] = [];
  private boss: Boss | null = null;
  private bossWarning: BossWarning | null = null;
  private state: GameState = "menu";
  private progress = 0;
  private health = 100;
  private fireTimer = 0;
  private specialTimer = 0;
  private wave = 1;
  private shake = 0;
  private lowPower = false;
  private shakeEnabled = true;
  private specialRequested = false;
  private stats: GameStats = this.freshStats();

  public constructor(
    private readonly container: HTMLElement,
    private readonly ui: UIManager,
  ) {
    this.lowPower =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
    this.shakeEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowPower, alpha: false });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.lowPower ? LOW_POWER_PIXEL_RATIO : MAX_PIXEL_RATIO),
    );
    this.renderer.shadowMap.enabled = !this.lowPower;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute("aria-label", "스카이브리지 스쿼드 3D 게임 화면");
    this.container.prepend(this.renderer.domElement);
    this.input = new InputManager(this.renderer.domElement, GAME_WIDTH / 2);
    this.player = new PlayerArmy(this.lowPower);
    this.scene.add(this.player.group);
    this.projectilePool = new Pool(90, () => {
      const projectile = new Projectile();
      this.scene.add(projectile.mesh);
      return projectile;
    });
    this.loop = new GameLoop(this.update);
    this.setupScene();
    this.resize();
    this.ui.setLowPower(this.lowPower);
    this.ui.setShake(this.shakeEnabled);
    this.ui.setSound(this.audio.isEnabled());
    this.ui.onSpecial(() => {
      this.specialRequested = true;
    });
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.loop.start();
    this.ui.setState("menu");
  }

  public async play(): Promise<void> {
    await this.audio.resume();
    this.resetRun();
    this.state = "playing";
    this.ui.setState(this.state);
    this.ui.showToast("교량 진입 — 유리한 경로를 선택하세요", "neutral");
  }

  public pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.ui.setState(this.state);
  }

  public resume(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.ui.setState(this.state);
  }

  public restart(): void {
    void this.play();
  }

  public home(): void {
    this.clearDynamicObjects();
    this.player.reset();
    this.state = "menu";
    this.ui.setState(this.state);
  }

  public toggleSound(): void {
    this.audio.setEnabled(!this.audio.isEnabled());
    this.ui.setSound(this.audio.isEnabled());
    if (this.audio.isEnabled()) void this.audio.resume();
  }

  public toggleLowPower(): void {
    this.lowPower = !this.lowPower;
    this.renderer.shadowMap.enabled = !this.lowPower;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.lowPower ? LOW_POWER_PIXEL_RATIO : MAX_PIXEL_RATIO),
    );
    this.ui.setLowPower(this.lowPower);
    this.resize();
  }

  public toggleShake(): void {
    this.shakeEnabled = !this.shakeEnabled;
    this.ui.setShake(this.shakeEnabled);
  }

  private readonly update = (dt: number): void => {
    if (this.state === "playing") this.updatePlaying(dt);
    this.updateAtmosphere(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlaying(dt: number): void {
    this.stats.elapsed += dt;
    this.specialTimer = Math.min(SPECIAL_COOLDOWN, this.specialTimer + dt);
    const horizontal = this.input.update(this.player.group.position.x);
    const desiredX = clamp(
      this.player.group.position.x + horizontal * LATERAL_SPEED * dt,
      -GAME_WIDTH / 2 + 0.35,
      GAME_WIDTH / 2 - 0.35,
    );
    this.player.setHorizontalTarget(desiredX);
    this.player.update(dt);
    const bossHolding = this.boss?.active && this.boss.group.position.z <= 18;
    const worldSpeed = bossHolding ? 0 : RUN_SPEED;
    if (!bossHolding) this.progress = Math.min(BOSS_DISTANCE + 10, this.progress + worldSpeed * dt);
    this.updateBridge(dt, bossHolding ? RUN_SPEED * 0.18 : RUN_SPEED);
    this.spawnDueEvents();
    this.updateEnemies(dt, worldSpeed);
    this.updateGates(dt, worldSpeed);
    this.updateObstacles(dt, worldSpeed);
    this.updateBoss(dt, worldSpeed);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateCombat(dt);
    if (this.input.consumeSpecial() || this.specialRequested) {
      this.specialRequested = false;
      this.useSpecial();
    }
    this.wave = Math.min(5, 1 + Math.floor((this.progress / BOSS_DISTANCE) * 5));
    this.ui.update(
      this.player.count,
      Math.ceil(this.health),
      this.progress / STAGE_LENGTH,
      this.wave,
      this.boss?.active ? this.boss.health / this.boss.maxHealth : null,
      this.specialTimer / SPECIAL_COOLDOWN,
    );
  }

  private updateCombat(dt: number): void {
    this.fireTimer -= dt;
    const target = this.combat.nearestTarget(this.enemies, this.boss);
    if (target && target.group.position.z < 44 && this.fireTimer <= 0) {
      this.fireTimer = this.player.fireInterval;
      const count = this.player.projectileCount;
      for (let i = 0; i < count; i += 1) {
        const offset = (i - (count - 1) / 2) * 0.23;
        this.fireProjectile(this.player.group.position.x + offset, 1.1, 0.5, this.player.damage);
      }
      this.audio.play("shoot");
    }
  }

  private fireProjectile(x: number, y: number, z: number, damage: number, hostile = false): void {
    const projectile = this.projectilePool.acquire();
    projectile.activate(new THREE.Vector3(x, y, z), damage, hostile);
    this.projectiles.push(projectile);
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i]!;
      projectile.life += dt;
      projectile.mesh.position.z += (projectile.hostile ? -PROJECTILE_SPEED * 0.48 : PROJECTILE_SPEED) * dt;
      if (projectile.hostile) {
        if (
          CollisionManager.overlapsXZ(projectile.mesh, this.player.group, 0.18, 0.62) &&
          Math.abs(projectile.mesh.position.y - 1) < 1
        ) {
          this.damagePlayer(5);
          this.releaseProjectile(i);
          continue;
        }
      } else {
        let hit = false;
        if (this.boss?.active && CollisionManager.overlapsXZ(projectile.mesh, this.boss.group, 0.16, 1.8)) {
          hit = true;
          if (this.boss.hit(projectile.damage)) this.defeatBoss();
          this.spawnHitParticles(projectile.mesh.position, 0xff5b73);
        } else {
          for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            if (CollisionManager.overlapsXZ(projectile.mesh, enemy.group, 0.16, enemy.radius)) {
              hit = true;
              if (enemy.hit(projectile.damage)) this.destroyEnemy(enemy);
              else this.audio.play("hit");
              this.spawnHitParticles(projectile.mesh.position, 0xff8a6c);
              break;
            }
          }
        }
        if (hit) {
          this.releaseProjectile(i);
          continue;
        }
      }
      if (projectile.life >= PROJECTILE_LIFETIME || Math.abs(projectile.mesh.position.z) > 72) {
        this.releaseProjectile(i);
      }
    }
  }

  private releaseProjectile(index: number): void {
    const projectile = this.projectiles[index]!;
    projectile.deactivate();
    this.projectiles.splice(index, 1);
    this.projectilePool.release(projectile);
  }

  private updateEnemies(dt: number, worldSpeed: number): void {
    const speed = this.difficulty.enemySpeed(this.progress / STAGE_LENGTH);
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]!;
      enemy.group.position.z -= worldSpeed * dt;
      enemy.update(dt);
      if (enemy.kind === "ranged" && !enemy.hasFired && enemy.group.position.z < 20) {
        enemy.hasFired = true;
        this.fireProjectile(enemy.group.position.x, 1, enemy.group.position.z - 0.8, 5, true);
      }
      if (
        enemy.active &&
        enemy.group.position.z < PLAYER_Z + 0.7 &&
        CollisionManager.overlapsXZ(enemy.group, this.player.group, enemy.radius, 0.64)
      ) {
        this.damagePlayer(this.difficulty.collisionDamage(enemy.health));
        this.destroyEnemy(enemy, false);
      } else if (enemy.group.position.z < -8) {
        this.removeEnemy(i);
      } else if (enemy.kind === "grunt" && enemy.group.position.z < 16) {
        enemy.group.position.z -= speed * dt * 0.08;
      }
    }
  }

  private updateGates(dt: number, worldSpeed: number): void {
    for (const gate of this.gates) gate.group.position.z -= worldSpeed * dt;
    const crossing = this.gates.find(
      (gate) =>
        gate.active &&
        gate.group.position.z < 0.65 &&
        gate.group.position.z > -0.8 &&
        (gate.lane === "left" ? this.player.group.position.x < 0 : this.player.group.position.x >= 0),
    );
    if (crossing) {
      const count = crossing.apply(this.player);
      const gained = count >= this.player.count;
      this.player.changeCount(count);
      this.player.pulse();
      this.stats.gates += 1;
      this.audio.play(gained ? "gain" : "lose");
      this.ui.showToast(this.gateMessage(crossing), gained ? "good" : "bad");
      this.gates
        .filter((gate) => Math.abs(gate.group.position.z - crossing.group.position.z) < 1)
        .forEach((gate) => gate.deactivate(gate === crossing));
      if (this.player.count <= 0) this.finish(false);
    }
    for (let i = this.gates.length - 1; i >= 0; i -= 1) {
      if (this.gates[i]!.group.position.z < -9) {
        const gate = this.gates[i]!;
        this.scene.remove(gate.group);
        gate.dispose();
        this.gates.splice(i, 1);
      }
    }
  }

  private updateObstacles(dt: number, worldSpeed: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i]!;
      obstacle.group.position.z -= worldSpeed * dt;
      obstacle.update(dt);
      if (
        obstacle.active &&
        obstacle.group.position.z < 0.8 &&
        CollisionManager.overlapsXZ(obstacle.group, this.player.group, obstacle.radius, 0.58)
      ) {
        obstacle.active = false;
        const damage = obstacle.kind === "wall" ? 12 : 8;
        this.damagePlayer(damage);
        this.audio.play("destroy");
        this.spawnHitParticles(obstacle.group.position, 0xffb02e, 10);
        obstacle.group.visible = false;
      }
      if (obstacle.group.position.z < -9) {
        this.scene.remove(obstacle.group);
        obstacle.dispose();
        this.obstacles.splice(i, 1);
      }
    }
  }

  private updateBoss(dt: number, worldSpeed: number): void {
    if (!this.boss?.active) return;
    this.boss.group.position.z -= worldSpeed * dt;
    this.boss.group.position.z = Math.max(18, this.boss.group.position.z);
    this.boss.update(dt);
    if (this.boss.attackTimer <= 0 && !this.bossWarning) {
      const lanes = [-2.2, 0, 2.2];
      const lane = lanes[Math.floor(Math.random() * lanes.length)]!;
      const geometry = new THREE.BoxGeometry(2, 0.04, 22);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff334f,
        transparent: true,
        opacity: 0.45,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(lane, 0.035, 8);
      this.scene.add(mesh);
      this.bossWarning = { mesh, lane, timer: 1.25 };
      this.ui.showToast("위험 구역에서 벗어나세요!", "bad");
    }
    if (this.bossWarning) {
      this.bossWarning.timer -= dt;
      const material = this.bossWarning.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.25 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.45;
      if (this.bossWarning.timer <= 0) {
        if (Math.abs(this.player.group.position.x - this.bossWarning.lane) < 1.15) {
          this.damagePlayer(15);
        }
        this.scene.remove(this.bossWarning.mesh);
        this.bossWarning.mesh.geometry.dispose();
        material.dispose();
        this.bossWarning = null;
        this.boss.attackTimer = this.boss.health < 60 ? 2.4 : 3.2;
        this.boss.targetX = randomRange(-2.2, 2.2);
      }
    }
    if (this.boss.summonTimer <= 0) {
      this.boss.summonTimer = this.boss.health < 60 ? 5.5 : 8;
      const left = new Enemy(8, "grunt", -2.3, 24);
      const right = new Enemy(8, "grunt", 2.3, 24);
      this.enemies.push(left, right);
      this.scene.add(left.group, right.group);
      this.ui.showToast("보스가 지원 병력을 호출했습니다", "neutral");
    }
  }

  private spawnDueEvents(): void {
    for (const event of this.stage.consume(this.progress)) {
      const batch = this.spawner.spawn(event, this.scene);
      this.enemies.push(...batch.enemies);
      this.gates.push(...batch.gates);
      this.obstacles.push(...batch.obstacles);
      if (batch.boss) this.spawnBoss();
    }
  }

  private spawnBoss(): void {
    this.boss = new Boss(50);
    this.scene.add(this.boss.group);
    this.audio.play("boss");
    this.ui.showToast("경고 — 스톰브레이커 출현", "bad");
  }

  private useSpecial(): void {
    if (this.specialTimer < SPECIAL_COOLDOWN || this.state !== "playing") return;
    this.specialTimer = 0;
    this.audio.play("special");
    this.shake = 0.28;
    const origin = this.player.group.position.clone();
    origin.y = 1;
    this.spawnHitParticles(origin, 0x74e7ff, this.lowPower ? 10 : 24);
    for (const enemy of [...this.enemies]) {
      if (enemy.active && enemy.group.position.z < 38 && enemy.hit(12 + this.player.damage * 2)) {
        this.destroyEnemy(enemy);
      }
    }
    if (this.boss?.active && this.boss.hit(16 + this.player.damage * 2)) this.defeatBoss();
    this.ui.showToast("펄스 폭격!", "good");
  }

  private damagePlayer(amount: number): void {
    if (this.state !== "playing") return;
    const armyLoss = Math.max(1, Math.ceil(amount * 0.38));
    this.health = Math.max(0, this.health - amount);
    this.player.changeCount(this.player.count - armyLoss);
    this.stats.damageTaken += amount;
    this.shake = 0.22;
    this.audio.play("lose");
    this.ui.showToast(`피해 −${amount} · 병력 −${armyLoss}`, "bad");
    if (this.health <= 0 || this.player.count <= 0) this.finish(false);
  }

  private destroyEnemy(enemy: Enemy, countKill = true): void {
    if (!enemy.active) return;
    enemy.active = false;
    if (countKill) this.stats.kills += 1;
    this.audio.play("destroy");
    this.spawnHitParticles(enemy.group.position, 0xff5b62, this.lowPower ? 4 : 9);
    enemy.group.visible = false;
  }

  private removeEnemy(index: number): void {
    const enemy = this.enemies[index]!;
    this.scene.remove(enemy.group);
    enemy.dispose();
    this.enemies.splice(index, 1);
  }

  private defeatBoss(): void {
    if (!this.boss?.active) return;
    this.boss.active = false;
    this.stats.bossDefeated = true;
    this.stats.kills += 1;
    this.audio.play("victory");
    this.spawnHitParticles(this.boss.group.position, 0xffd166, this.lowPower ? 18 : 45);
    this.boss.group.visible = false;
    this.progress = STAGE_LENGTH;
    window.setTimeout(() => this.finish(true), 900);
  }

  private finish(cleared: boolean): void {
    if (this.state !== "playing") return;
    this.state = cleared ? "stageClear" : "gameOver";
    if (!cleared) this.audio.play("gameOver");
    const score = this.calculateScore(cleared);
    const previous = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? "0", 10) || 0;
    const best = Math.max(previous, score);
    localStorage.setItem(BEST_SCORE_KEY, `${best}`);
    this.ui.showResult(cleared, score, best, this.player.count, this.stats);
    this.ui.setState(this.state);
  }

  private calculateScore(cleared: boolean): number {
    return Math.max(
      0,
      Math.floor(
        this.player.count * 110 +
          this.stats.kills * 750 +
          this.stats.gates * 320 +
          (cleared ? 5000 : 0) -
          this.stats.damageTaken * 18 +
          Math.max(0, 120 - this.stats.elapsed) * 25,
      ),
    );
  }

  private gateMessage(gate: Gate): string {
    const labels = {
      add: `증원 +${gate.value}`,
      multiply: `병력 ×${gate.value}`,
      subtract: `병력 −${gate.value}`,
      divide: `병력 ÷${gate.value}`,
      damage: `공격력 +${gate.value}`,
      rapid: "연사 속도 증가",
      multi: `다중 탄환 +${gate.value}`,
    };
    return labels[gate.operation];
  }

  private spawnHitParticles(position: THREE.Vector3, color: number, amount = 5): void {
    if (this.lowPower) amount = Math.ceil(amount / 2);
    for (let i = 0; i < amount; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.11, 0),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.copy(position);
      mesh.position.y += 0.8;
      const particle: Particle = {
        mesh,
        velocity: new THREE.Vector3(randomRange(-2.5, 2.5), randomRange(1, 4), randomRange(-2, 2)),
        life: randomRange(0.28, 0.65),
      };
      this.particles.push(particle);
      this.scene.add(mesh);
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i]!;
      particle.life -= dt;
      particle.velocity.y -= dt * 7;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life * 2));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0x0a1b2a);
    this.scene.fog = new THREE.FogExp2(0x102a3a, 0.018);
    this.camera.position.set(0, 8.2, -12.8);
    this.camera.lookAt(0, 1, 15);
    const hemisphere = new THREE.HemisphereLight(0xc9f4ff, 0x142131, 2.2);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(-8, 14, -4);
    sun.castShadow = !this.lowPower;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -8;
    this.scene.add(sun);
    this.createBridge();
    this.createMountains();
  }

  private createBridge(): void {
    const tileGeometry = new THREE.BoxGeometry(GAME_WIDTH + 0.8, 0.5, 8);
    const tileMaterial = new THREE.MeshStandardMaterial({
      color: 0x617d89,
      roughness: 0.76,
      metalness: 0.08,
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x7de4ff,
      emissive: 0x2fb9e5,
      emissiveIntensity: 0.25,
    });
    for (let index = 0; index < 11; index += 1) {
      const group = new THREE.Group();
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);
      tile.receiveShadow = !this.lowPower;
      group.add(tile);
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 8), edgeMaterial);
        edge.position.set(side * (GAME_WIDTH / 2 + 0.34), 0.3, 0);
        group.add(edge);
      }
      group.position.set(0, -0.28, index * 8 - 12);
      this.bridgeTiles.push(group);
      this.scene.add(group);
    }
  }

  private createMountains(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0x274656,
      roughness: 1,
      flatShading: true,
    });
    const snow = new THREE.MeshStandardMaterial({ color: 0xb9dce5, roughness: 1, flatShading: true });
    for (let index = 0; index < (this.lowPower ? 14 : 24); index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 5 + Math.floor(index / 2) * 11;
      const radius = randomRange(3.5, 7);
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, randomRange(8, 15), 5), material);
      mountain.position.set(side * randomRange(10, 18), 2, z);
      mountain.rotation.y = Math.random() * Math.PI;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.5, 3.5, 5), snow);
      cap.position.set(mountain.position.x, mountain.position.y + 5, z);
      cap.rotation.y = mountain.rotation.y;
      this.scene.add(mountain, cap);
    }
  }

  private updateBridge(dt: number, speed: number): void {
    for (const tile of this.bridgeTiles) {
      tile.position.z -= speed * dt;
      if (tile.position.z < -18) tile.position.z += this.bridgeTiles.length * 8;
    }
  }

  private updateAtmosphere(dt: number): void {
    const targetX = this.player.group.position.x * 0.16;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 4);
    if (this.shake > 0 && this.shakeEnabled) {
      this.shake -= dt;
      this.camera.position.x += randomRange(-this.shake, this.shake);
      this.camera.position.y = 8.2 + randomRange(-this.shake, this.shake);
    } else {
      this.shake = 0;
      this.camera.position.y += (8.2 - this.camera.position.y) * Math.min(1, dt * 8);
    }
    this.camera.lookAt(this.camera.position.x * 0.2, 1.05, 15);
  }

  private resetRun(): void {
    this.clearDynamicObjects();
    this.player.reset();
    this.progress = 0;
    this.health = 100;
    this.fireTimer = 0;
    this.specialTimer = SPECIAL_COOLDOWN;
    this.wave = 1;
    this.shake = 0;
    this.stats = this.freshStats();
    this.stage.reset();
    this.bridgeTiles.forEach((tile, index) => {
      tile.position.z = index * 8 - 12;
    });
  }

  private clearDynamicObjects(): void {
    while (this.enemies.length) this.removeEnemy(this.enemies.length - 1);
    for (const gate of this.gates) {
      this.scene.remove(gate.group);
      gate.dispose();
    }
    this.gates.length = 0;
    for (const obstacle of this.obstacles) {
      this.scene.remove(obstacle.group);
      obstacle.dispose();
    }
    this.obstacles.length = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) this.releaseProjectile(i);
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
    if (this.boss) {
      this.scene.remove(this.boss.group);
      this.boss.dispose();
      this.boss = null;
    }
    if (this.bossWarning) {
      this.scene.remove(this.bossWarning.mesh);
      this.bossWarning.mesh.geometry.dispose();
      (this.bossWarning.mesh.material as THREE.Material).dispose();
      this.bossWarning = null;
    }
  }

  private freshStats(): GameStats {
    return { kills: 0, damageTaken: 0, gates: 0, elapsed: 0, bossDefeated: false };
  }

  private readonly resize = (): void => {
    const rect = this.container.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden && this.state === "playing") this.pause();
  };
}
