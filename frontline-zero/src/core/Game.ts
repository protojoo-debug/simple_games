import * as THREE from 'three';
import { InputManager } from './InputManager';
import { SettingsManager } from './SettingsManager';
import { AudioManager } from './AudioManager';
import { GameLoop } from './GameLoop';
import { Renderer } from '../rendering/Renderer';
import { EffectsManager } from '../rendering/EffectsManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena } from '../world/Arena';
import { PlayerController } from '../player/PlayerController';
import { WeaponController } from '../player/WeaponController';
import { AbilityController } from '../player/AbilityController';
import { BotController } from '../ai/BotController';
import { CaptureMode } from '../gameModes/CaptureMode';
import { HUD } from '../ui/HUD';
import { MainMenu } from '../ui/MainMenu';
import type { MatchState } from '../types/game';

export class Game {
  private readonly settings = new SettingsManager();
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly audio = new AudioManager(this.settings);
  private readonly physics = new PhysicsWorld();
  private readonly effects: EffectsManager;
  private readonly arena: Arena;
  private readonly player: PlayerController;
  private readonly bots: BotController[] = [];
  private readonly weapon: WeaponController;
  private readonly abilities: AbilityController;
  private readonly capture: CaptureMode;
  private readonly hud: HUD;
  private readonly menu: MainMenu;
  private readonly loop: GameLoop;
  private state: MatchState = 'menu';
  private respawnTimer = 0;
  private resultLocked = false;

  constructor(container: HTMLElement, hudRoot: HTMLElement) {
    this.renderer = new Renderer(container, this.settings);
    this.input = new InputManager(this.renderer.renderer.domElement);
    this.effects = new EffectsManager(this.renderer.scene);
    this.arena = new Arena(this.renderer.scene, this.physics);
    this.player = new PlayerController(
      this.renderer.camera,
      this.physics.playerBody,
      this.input,
      this.settings,
      () => {
        this.audio.play('hurt');
        this.hud?.flashDamage();
      },
      () => {
        this.audio.play('defeat', 0.35);
        this.state = 'dead';
        this.respawnTimer = 5;
      },
    );
    for (let index = 0; index < 3; index += 1) {
      const x = (index - 1) * 9;
      const bot = new BotController(
        index,
        new THREE.Vector3(x, 0, -24 + Math.abs(index - 1) * 3),
        this.renderer.scene,
        this.player,
        this.arena.solids,
        this.arena.navigationBounds,
        this.effects,
        this.settings.value.difficulty,
        (amount, source) => this.player.takeDamage(amount, source),
        () => {
          this.player.kills += 1;
          this.audio.play('kill');
          this.weapon?.addUltimate(16);
          this.hud?.notify('위협 신호 제거 +1', 'kill');
        },
      );
      this.bots.push(bot);
    }
    this.weapon = new WeaponController(
      this.renderer.camera,
      this.input,
      this.player,
      this.bots,
      this.arena.solids,
      this.effects,
      this.audio,
      (headshot) => {
        if (headshot) this.hud.notify('정밀 타격', 'headshot');
      },
    );
    this.abilities = new AbilityController(
      this.renderer.scene,
      this.renderer.camera,
      this.input,
      this.player,
      this.weapon,
      this.bots,
      this.arena.solids,
      this.effects,
      this.audio,
      (message, tone) => this.hud.notify(message, tone),
    );
    this.capture = new CaptureMode(
      this.arena.captureCenter,
      this.player,
      this.bots,
      () => this.audio.play('capture', 0.45),
      (result) => this.finish(result),
    );
    this.hud = new HUD(hudRoot);
    this.menu = new MainMenu(this.settings, () => this.startMatch(), () => this.resume());
    this.menu.show('main');
    this.loop = new GameLoop((delta) => this.update(delta));
    this.loop.start();

    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.state === 'playing') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
  }

  private startMatch(): void {
    this.resultLocked = false;
    this.state = 'playing';
    this.capture.reset();
    this.physics.resetPlayer();
    this.player.respawn();
    this.player.kills = 0;
    this.weapon.ammo = this.weapon.magazine;
    this.weapon.ultimate = 0;
    this.weapon.reloading = false;
    for (const bot of this.bots) bot.reset();
    this.menu.hide();
    this.hud.show();
    this.input.requestLock();
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.menu.hide();
    this.hud.show();
    this.input.requestLock();
  }

  private pause(): void {
    this.state = 'paused';
    this.hud.hide();
    this.menu.show('pause');
  }

  private finish(result: 'victory' | 'defeat'): void {
    if (this.resultLocked) return;
    this.resultLocked = true;
    this.state = 'result';
    document.exitPointerLock();
    this.hud.hide();
    this.audio.play(result);
    this.menu.showResult(
      result === 'victory',
      this.capture.playerScore,
      this.capture.enemyScore,
      this.player.kills,
    );
  }

  private update(delta: number): void {
    const active = this.state === 'playing';
    if (this.state === 'dead') {
      this.respawnTimer -= delta;
      this.player.respawnRemaining = this.respawnTimer;
      if (this.respawnTimer <= 0) {
        this.player.respawn();
        this.physics.resetPlayer();
        this.state = 'playing';
        this.input.requestLock();
      }
    }
    const simulationActive = active || this.state === 'dead';
    if (simulationActive) {
      this.physics.step(delta);
      this.player.update(delta, active && this.input.locked);
      for (const bot of this.bots) bot.update(delta, this.bots, simulationActive);
      this.weapon.update(delta, active && this.input.locked, this.abilities.analysisActive ? 1.25 : 1);
      this.abilities.update(delta, active && this.input.locked);
      this.capture.update(delta, simulationActive);
    }
    this.effects.update(delta);
    const ownerColor =
      this.capture.owner === 'vanguard' ? 0x5eeaff : this.capture.owner === 'raider' ? 0xff6472 : 0x86b9c3;
    (this.arena.captureRing.material as THREE.MeshBasicMaterial).color.setHex(ownerColor);
    this.hud.update(
      delta,
      this.player,
      this.weapon,
      this.abilities,
      this.capture.snapshot(this.state),
      this.settings.value,
      this.input.isDown('Tab'),
    );
    this.renderer.render();
    this.input.endFrame();
  }
}
