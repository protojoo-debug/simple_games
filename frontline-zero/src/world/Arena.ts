import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

export class Arena {
  readonly solids: THREE.Object3D[] = [];
  readonly captureCenter = new THREE.Vector3(0, 0, 0);
  readonly captureRing: THREE.Mesh;

  constructor(
    private readonly scene: THREE.Scene,
    physics: PhysicsWorld,
  ) {
    const hemi = new THREE.HemisphereLight(0xc8fbff, 0x0a1820, 2.2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d1, 3);
    sun.position.set(16, 28, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: 0x18323c, roughness: 0.72, metalness: 0.18 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(70, 35, 0x2e8fa0, 0x244653);
    grid.position.y = 0.012;
    scene.add(grid);

    this.captureRing = new THREE.Mesh(
      new THREE.RingGeometry(6, 6.28, 64),
      new THREE.MeshBasicMaterial({
        color: 0x67e9ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.captureRing.rotation.x = -Math.PI / 2;
    this.captureRing.position.y = 0.04;
    scene.add(this.captureRing);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.8, 1.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x123746, emissive: 0x0d7381, emissiveIntensity: 1.2 }),
    );
    core.position.y = 0.85;
    core.castShadow = true;
    scene.add(core);
    this.solids.push(core);

    const coverData: Array<[number, number, number, number, number]> = [
      [-15, -12, 6, 2.5, 2],
      [15, -12, 6, 2.5, 2],
      [-15, 12, 6, 2.5, 2],
      [15, 12, 6, 2.5, 2],
      [-8, 0, 3, 3, 8],
      [8, 0, 3, 3, 8],
      [-25, 0, 3, 4, 12],
      [25, 0, 3, 4, 12],
      [0, -22, 12, 3, 2],
      [0, 22, 12, 3, 2],
    ];
    for (const [x, z, width, height, depth] of coverData) {
      this.addBox(
        new THREE.Vector3(x, height / 2, z),
        new THREE.Vector3(width, height, depth),
        physics,
      );
    }

    for (const x of [-32, 32]) {
      this.addBox(new THREE.Vector3(x, 2, 0), new THREE.Vector3(2, 4, 70), physics, 0x244451);
    }
    for (const z of [-32, 32]) {
      this.addBox(new THREE.Vector3(0, 2, z), new THREE.Vector3(66, 4, 2), physics, 0x244451);
    }
    this.addPlatform(-20, -19, physics);
    this.addPlatform(20, 19, physics);
  }

  private addPlatform(x: number, z: number, physics: PhysicsWorld): void {
    this.addBox(new THREE.Vector3(x, 1.2, z), new THREE.Vector3(11, 2.4, 9), physics, 0x28566a);
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x32677a }),
    );
    ramp.position.set(x + Math.sign(x) * 7, 0.75, z);
    ramp.rotation.z = Math.sign(x) * -0.16;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.scene.add(ramp);
  }

  private addBox(
    position: THREE.Vector3,
    size: THREE.Vector3,
    physics: PhysicsWorld,
    color = 0x2f5965,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.65,
        metalness: 0.35,
        emissive: 0x07151c,
      }),
    );
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.solid = true;
    this.scene.add(mesh);
    this.solids.push(mesh);
    physics.addBox(position, size);
  }
}
