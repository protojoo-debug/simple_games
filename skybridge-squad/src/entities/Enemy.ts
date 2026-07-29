import * as THREE from "three";
import type { EnemyKind } from "../types";
import { createTextSprite, type TextSprite } from "../utils/textSprite";

const ENEMY_COLORS: Record<EnemyKind, number> = {
  grunt: 0xf0525f,
  shield: 0xb63052,
  ranged: 0xff7b50,
  charger: 0xe13d35,
};

export class Enemy {
  public readonly group = new THREE.Group();
  public active = true;
  public hasFired = false;
  public readonly maxHealth: number;
  public radius: number;
  private readonly label: TextSprite;
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private flashTimer = 0;

  public constructor(
    public health: number,
    public readonly kind: EnemyKind,
    x: number,
    z: number,
  ) {
    this.maxHealth = health;
    this.radius = kind === "shield" ? 0.95 : 0.72;
    this.group.position.set(x, 0, z);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: ENEMY_COLORS[kind],
      roughness: 0.7,
    });
    this.materials.push(bodyMaterial);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(kind === "shield" ? 0.42 : 0.34, 0.7, 4, 8),
      bodyMaterial,
    );
    body.position.y = 0.7;
    body.castShadow = true;
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff9c74,
      emissiveIntensity: 0.45,
    });
    this.materials.push(eyeMaterial);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.1), eyeMaterial);
    eye.position.set(0, 0.86, -0.31);
    this.group.add(body, eye);
    if (kind === "shield") {
      const shieldMaterial = new THREE.MeshStandardMaterial({
        color: 0x77233a,
        metalness: 0.4,
        roughness: 0.35,
      });
      this.materials.push(shieldMaterial);
      const shield = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 0.16), shieldMaterial);
      shield.position.set(0, 0.72, -0.47);
      this.group.add(shield);
    }
    if (kind === "ranged") {
      const cannon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.8), eyeMaterial);
      cannon.position.set(0, 0.66, -0.48);
      this.group.add(cannon);
    }
    this.label = createTextSprite(`${health}`, "#ff696f", 2.2, 0.82);
    this.label.sprite.position.set(0, 2.15, 0);
    this.group.add(this.label.sprite);
  }

  public update(dt: number): void {
    if (this.kind === "charger" && this.group.position.z < 16) {
      this.group.position.z -= dt * 6;
    } else if (this.kind === "grunt") {
      this.group.position.z -= dt * 0.8;
    }
    this.group.rotation.z = Math.sin(performance.now() * 0.004 + this.group.position.x) * 0.04;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.flashTimer === 0) {
      this.materials[0]?.emissive.setHex(0x000000);
    }
  }

  public hit(damage: number): boolean {
    this.health = Math.max(0, this.health - damage);
    this.label.setText(`${Math.ceil(this.health)}`, "#ff696f");
    this.materials[0]?.emissive.setHex(0xffffff);
    this.materials[0]!.emissiveIntensity = 0.65;
    this.flashTimer = 0.07;
    this.group.scale.setScalar(1.08);
    window.setTimeout(() => this.group.scale.setScalar(1), 65);
    return this.health <= 0;
  }

  public dispose(): void {
    this.label.dispose();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.materials.forEach((material) => material.dispose());
  }
}
