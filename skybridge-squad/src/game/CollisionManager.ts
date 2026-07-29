import * as THREE from "three";

export class CollisionManager {
  public static overlapsXZ(
    a: THREE.Object3D,
    b: THREE.Object3D,
    radiusA: number,
    radiusB: number,
  ): boolean {
    const dx = a.position.x - b.position.x;
    const dz = a.position.z - b.position.z;
    const radius = radiusA + radiusB;
    return dx * dx + dz * dz <= radius * radius;
  }
}
