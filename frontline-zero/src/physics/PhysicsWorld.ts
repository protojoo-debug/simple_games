import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsWorld {
  readonly world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
  readonly playerBody: CANNON.Body;

  constructor() {
    this.world.defaultContactMaterial.friction = 0;
    this.playerBody = new CANNON.Body({
      mass: 75,
      shape: new CANNON.Sphere(0.48),
      fixedRotation: true,
      position: new CANNON.Vec3(0, 1.1, 26),
      linearDamping: 0.1,
    });
    this.world.addBody(this.playerBody);
    this.addBox(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(70, 1, 70));
  }

  addBox(position: THREE.Vector3, size: THREE.Vector3): void {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
      position: new CANNON.Vec3(position.x, position.y, position.z),
    });
    this.world.addBody(body);
  }

  step(delta: number): void {
    this.world.step(1 / 60, delta, 3);
  }

  resetPlayer(position = new THREE.Vector3(0, 1.1, 26)): void {
    this.playerBody.position.set(position.x, position.y, position.z);
    this.playerBody.velocity.setZero();
  }
}
