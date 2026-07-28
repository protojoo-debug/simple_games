import { describe, expect, it } from 'vitest';
import { isBlocked, resolvePlanarMovement, type Bounds2D } from './collision';

const wall: Bounds2D = { minX: 2, maxX: 4, minZ: -5, maxZ: 5 };

describe('bot planar collision', () => {
  it('detects an inflated wall boundary', () => {
    expect(isBlocked(1.6, 0, [wall], 0.5)).toBe(true);
    expect(isBlocked(1.4, 0, [wall], 0.5)).toBe(false);
  });

  it('stops movement through a wall', () => {
    const result = resolvePlanarMovement(1.4, 0, 0.3, 0, [wall], 0.5);
    expect(result).toEqual({ x: 1.4, z: 0, blockedX: true, blockedZ: false });
  });

  it('slides along a wall when only one axis is blocked', () => {
    const result = resolvePlanarMovement(1.4, 0, 0.3, 0.4, [wall], 0.5);
    expect(result.x).toBe(1.4);
    expect(result.z).toBe(0.4);
    expect(result.blockedX).toBe(true);
    expect(result.blockedZ).toBe(false);
  });

  it('preserves free movement', () => {
    const result = resolvePlanarMovement(-3, -3, 0.5, 0.25, [wall], 0.5);
    expect(result).toEqual({ x: -2.5, z: -2.75, blockedX: false, blockedZ: false });
  });
});
