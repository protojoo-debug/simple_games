import * as THREE from "three";
import type { ObstacleKind } from "../types";
import { createTextSprite, type TextSprite } from "../utils/textSprite";

export class Obstacle {
  public readonly group = new THREE.Group();
  public active = true;
  public readonly radius: number;
  private readonly label: TextSprite;

  public constructor(
    public readonly kind: ObstacleKind,
    x: number,
    z: number,
  ) {
    this.radius = kind === "wall" ? 1.25 : 0.8;
    this.group.position.set(x, 0, z);
    const danger = new THREE.MeshStandardMaterial({
      color: 0xff9b32,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.22,
      metalness: 0.35,
    });
    if (kind === "blade") {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.35, 10), danger);
      hub.rotation.x = Math.PI / 2;
      hub.position.y = 0.85;
      this.group.add(hub);
      for (let i = 0; i < 4; i += 1) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.18, 0.12), danger);
        blade.position.y = 0.85;
        blade.rotation.z = (i * Math.PI) / 2;
        this.group.add(blade);
      }
    } else if (kind === "boulder") {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), danger);
      rock.position.y = 0.82;
      this.group.add(rock);
    } else if (kind === "barrel") {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.25, 10), danger);
      barrel.position.y = 0.62;
      this.group.add(barrel);
    } else {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 0.45), danger);
      wall.position.y = 0.95;
      this.group.add(wall);
    }
    this.label = createTextSprite("위험", "#ffb04a", 1.65, 0.58);
    this.label.sprite.position.set(0, 2.35, 0);
    this.group.add(this.label.sprite);
  }

  public update(dt: number): void {
    if (this.kind === "blade") this.group.rotation.z += dt * 4.4;
    if (this.kind === "boulder") {
      this.group.rotation.x += dt * 2.7;
      this.group.position.x += Math.sin(performance.now() * 0.0025) * dt * 0.8;
    }
    if (this.kind === "wall") this.group.position.x += Math.sin(performance.now() * 0.0017) * dt * 1.1;
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
