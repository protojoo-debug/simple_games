import * as THREE from "three";
import { createTextSprite, type TextSprite } from "../utils/textSprite";

export class Boss {
  public readonly group = new THREE.Group();
  public health = 120;
  public readonly maxHealth = 120;
  public active = true;
  public attackTimer = 2.8;
  public summonTimer = 7;
  public targetX = 0;
  private readonly label: TextSprite;
  private readonly coreMaterial: THREE.MeshStandardMaterial;

  public constructor(z: number) {
    this.group.position.set(0, 0, z);
    this.coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x9d2345,
      emissive: 0xff294e,
      emissiveIntensity: 0.25,
      metalness: 0.45,
      roughness: 0.35,
    });
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), this.coreMaterial);
    body.position.y = 2.05;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.85, 1.05),
      new THREE.MeshStandardMaterial({ color: 0x3a1222, metalness: 0.65 }),
    );
    head.position.set(0, 3.45, -0.15);
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.18, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffc0b5 }),
    );
    eye.position.set(0, 3.48, -0.7);
    this.group.add(body, head, eye);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.6, 0.68), this.coreMaterial);
      arm.position.set(side * 1.9, 2, 0);
      arm.rotation.z = side * 0.24;
      this.group.add(arm);
    }
    this.label = createTextSprite(`BOSS ${this.health}`, "#ff6680", 3.5, 1);
    this.label.sprite.position.set(0, 5.15, 0);
    this.group.add(this.label.sprite);
  }

  public update(dt: number): void {
    this.group.position.x += (this.targetX - this.group.position.x) * Math.min(1, dt * 2.5);
    this.group.rotation.y = Math.sin(performance.now() * 0.0018) * 0.13;
    this.attackTimer -= dt;
    this.summonTimer -= dt;
  }

  public hit(damage: number): boolean {
    this.health = Math.max(0, this.health - damage);
    this.label.setText(`BOSS ${Math.ceil(this.health)}`, "#ff6680");
    this.coreMaterial.emissiveIntensity = 0.9;
    window.setTimeout(() => {
      this.coreMaterial.emissiveIntensity = 0.25;
    }, 70);
    return this.health <= 0;
  }

  public dispose(): void {
    this.label.dispose();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
