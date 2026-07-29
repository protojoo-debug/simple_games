import * as THREE from "three";

export class Projectile {
  public readonly mesh: THREE.Mesh;
  public active = false;
  public life = 0;
  public damage = 1;
  public hostile = false;

  public constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.42, 2, 5),
      new THREE.MeshBasicMaterial({ color: 0x86ebff }),
    );
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.visible = false;
  }

  public activate(position: THREE.Vector3, damage: number, hostile = false): void {
    this.active = true;
    this.life = 0;
    this.damage = damage;
    this.hostile = hostile;
    this.mesh.position.copy(position);
    this.mesh.visible = true;
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(hostile ? 0xff665c : 0x86ebff);
  }

  public deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
