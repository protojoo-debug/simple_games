export interface Bounds2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ResolvedMovement {
  x: number;
  z: number;
  blockedX: boolean;
  blockedZ: boolean;
}

export const isBlocked = (
  x: number,
  z: number,
  bounds: readonly Bounds2D[],
  radius: number,
): boolean =>
  bounds.some(
    (box) =>
      x > box.minX - radius &&
      x < box.maxX + radius &&
      z > box.minZ - radius &&
      z < box.maxZ + radius,
  );

export const resolvePlanarMovement = (
  x: number,
  z: number,
  deltaX: number,
  deltaZ: number,
  bounds: readonly Bounds2D[],
  radius: number,
): ResolvedMovement => {
  const nextX = x + deltaX;
  const blockedX = isBlocked(nextX, z, bounds, radius);
  const resolvedX = blockedX ? x : nextX;
  const nextZ = z + deltaZ;
  const blockedZ = isBlocked(resolvedX, nextZ, bounds, radius);

  return {
    x: resolvedX,
    z: blockedZ ? z : nextZ,
    blockedX,
    blockedZ,
  };
};
