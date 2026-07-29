import * as THREE from "three";
import type { GateOperation } from "../types";
import { createTextSprite, type TextSprite } from "../utils/textSprite";

const GATE_STYLES: Record<GateOperation, { color: number; accent: string; title: string }> = {
  add: { color: 0x23d3a7, accent: "#56ffd4", title: "증원" },
  multiply: { color: 0x3b9bff, accent: "#71c5ff", title: "배율" },
  subtract: { color: 0xe65362, accent: "#ff7d87", title: "감소" },
  divide: { color: 0xbb4c9f, accent: "#fa77dc", title: "분산" },
  damage: { color: 0xffb22e, accent: "#ffd166", title: "공격력" },
  rapid: { color: 0x7b6cff, accent: "#a99cff", title: "연사" },
  multi: { color: 0x22bfe2, accent: "#65e8ff", title: "다중탄" },
};

export class Gate {
  public readonly group = new THREE.Group();
  public active = true;
  private readonly label: TextSprite;
  private readonly material: THREE.MeshStandardMaterial;

  public constructor(
    public readonly operation: GateOperation,
    public readonly value: number,
    public readonly lane: "left" | "right",
    z: number,
  ) {
    const style = GATE_STYLES[operation];
    this.material = new THREE.MeshStandardMaterial({
      color: style.color,
      transparent: true,
      opacity: 0.7,
      emissive: style.color,
      emissiveIntensity: 0.16,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.75, 3.3, 0.16), this.material);
    panel.position.y = 1.65;
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: style.color,
      emissive: style.color,
      emissiveIntensity: 0.4,
    });
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.7, 0.22), frameMaterial);
    const rightPost = leftPost.clone();
    leftPost.position.set(-1.42, 1.75, 0);
    rightPost.position.set(1.42, 1.75, 0);
    this.group.add(panel, leftPost, rightPost);
    this.group.position.set(lane === "left" ? -2 : 2, 0, z);
    this.label = createTextSprite(this.displayValue(), style.accent, 2.45, 0.92);
    this.label.sprite.position.set(0, 2.05, -0.18);
    this.group.add(this.label.sprite);
    const title = createTextSprite(style.title, style.accent, 1.7, 0.56);
    title.sprite.position.set(0, 3.1, -0.18);
    this.group.add(title.sprite);
    this.group.userData.titleSprite = title;
  }

  public apply(army: { count: number; damage: number; fireInterval: number; projectileCount: number }): number {
    switch (this.operation) {
      case "add":
        return army.count + this.value;
      case "multiply":
        return army.count * this.value;
      case "subtract":
        return army.count - this.value;
      case "divide":
        return Math.ceil(army.count / this.value);
      case "damage":
        army.damage += this.value;
        return army.count;
      case "rapid":
        army.fireInterval = Math.max(0.075, army.fireInterval * this.value);
        return army.count;
      case "multi":
        army.projectileCount = Math.min(3, army.projectileCount + this.value);
        return army.count;
    }
  }

  public deactivate(selected: boolean): void {
    this.active = false;
    this.material.opacity = selected ? 0.95 : 0.14;
    this.group.scale.setScalar(selected ? 1.08 : 0.92);
  }

  public dispose(): void {
    this.label.dispose();
    const title = this.group.userData.titleSprite as TextSprite;
    title.dispose();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }

  private displayValue(): string {
    const symbols: Record<GateOperation, string> = {
      add: `+${this.value}`,
      multiply: `×${this.value}`,
      subtract: `−${this.value}`,
      divide: `÷${this.value}`,
      damage: `ATK +${this.value}`,
      rapid: "연사 ↑",
      multi: `탄환 +${this.value}`,
    };
    return symbols[this.operation];
  }
}
