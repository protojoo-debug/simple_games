export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export const randomRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);
