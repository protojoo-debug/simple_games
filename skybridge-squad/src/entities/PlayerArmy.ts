import * as THREE from "three";
import { MAX_VISIBLE_ALLIES, STARTING_ARMY } from "../game/constants";
import { clamp, damp } from "../utils/math";
import { createTextSprite, type TextSprite } from "../utils/textSprite";

export class PlayerArmy {
  public readonly group = new THREE.Group();
  public count = STARTING_ARMY;
  public damage = 1;
  public fireInterval = 0.18;
  public projectileCount = 1;
  private readonly units: THREE.Group[] = [];
  private readonly countLabel: TextSprite;
  private targetX = 0;

  public constructor(private readonly lowPower: boolean) {
    this.group.name = "PlayerArmy";
    this.countLabel = createTextSprite(`${this.count}`, "#65dbff", 2.4, 0.9);
    this.countLabel.sprite.position.set(0, 3.3, 0);
    this.group.add(this.countLabel.sprite);
    this.rebuild();
  }

  public setHorizontalTarget(x: number): void {
    this.targetX = clamp(x, -3.2, 3.2);
  }

  public snapHorizontal(x: number): void {
    this.targetX = clamp(x, -3.2, 3.2);
    this.group.position.x = this.targetX;
  }

  public update(dt: number): void {
    this.group.position.x = damp(this.group.position.x, this.targetX, 18, dt);
    const bounce = Math.sin(performance.now() * 0.011) * 0.035;
    this.units.forEach((unit, index) => {
      unit.position.y = 0.48 + bounce * (index % 2 === 0 ? 1 : -1);
    });
  }

  public changeCount(next: number): void {
    this.count = Math.max(0, Math.floor(next));
    this.countLabel.setText(`${this.count}`, "#65dbff");
    this.rebuild();
  }

  public reset(): void {
    this.count = STARTING_ARMY;
    this.damage = 1;
    this.fireInterval = 0.18;
    this.projectileCount = 1;
    this.group.position.set(0, 0, 0);
    this.targetX = 0;
    this.countLabel.setText(`${this.count}`, "#65dbff");
    this.rebuild();
  }

  public pulse(): void {
    this.group.scale.set(1.16, 1.16, 1.16);
    window.setTimeout(() => this.group.scale.set(1, 1, 1), 120);
  }

  public dispose(): void {
    this.countLabel.dispose();
    this.units.forEach((unit) => {
      unit.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    });
  }

  private rebuild(): void {
    this.units.forEach((unit) => this.group.remove(unit));
    this.units.length = 0;
    const visibleLimit = this.lowPower ? 18 : MAX_VISIBLE_ALLIES;
    const visible = Math.min(this.count, visibleLimit);
    for (let index = 0; index < visible; index += 1) {
      const unit = this.createUnit(index === 0);
      const row = Math.floor(index / 3);
      const column = index % 3;
      const spread = Math.min(row * 0.035, 0.35);
      unit.position.set((column - 1) * (0.58 + spread), 0.48, -row * 0.64);
      this.units.push(unit);
      this.group.add(unit);
    }
  }

  private createUnit(leader: boolean): THREE.Group {
    const unit = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({
      color: leader ? 0x79ecff : 0x2baad0,
      roughness: 0.55,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: 0xe8fbff,
      emissive: 0x3fd7ff,
      emissiveIntensity: 0.35,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.38, 3, 6), suit);
    body.castShadow = !this.lowPower;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), visor);
    head.position.y = 0.42;
    const blaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x132b3f, metalness: 0.5 }),
    );
    blaster.position.set(0.22, 0.12, 0.16);
    unit.add(body, head, blaster);
    return unit;
  }
}
