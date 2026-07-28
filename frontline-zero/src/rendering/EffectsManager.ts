import * as THREE from 'three';

interface Effect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class EffectsManager {
  private readonly effects: Effect[] = [];

  constructor(scene: THREE.Scene) {
    for (let index = 0; index < 20; index += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x8df6ff, transparent: true }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.effects.push({ mesh, life: 0, maxLife: 0.3 });
    }
  }

  burst(position: THREE.Vector3, color = 0x8df6ff, scale = 1): void {
    const effect = this.effects.find((candidate) => !candidate.mesh.visible);
    if (!effect) return;
    effect.mesh.position.copy(position);
    effect.mesh.scale.setScalar(scale);
    (effect.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (effect.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    effect.life = effect.maxLife;
    effect.mesh.visible = true;
  }

  update(delta: number): void {
    for (const effect of this.effects) {
      if (!effect.mesh.visible) continue;
      effect.life -= delta;
      effect.mesh.scale.multiplyScalar(1 + delta * 8);
      (effect.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, effect.life / effect.maxLife);
      if (effect.life <= 0) effect.mesh.visible = false;
    }
  }
}
