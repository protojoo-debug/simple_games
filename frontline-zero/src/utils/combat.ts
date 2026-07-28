export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const calculateDamage = (
  base: number,
  distance: number,
  headshot = false,
  effectiveRange = 35,
): number => {
  const multiplier = headshot ? 1.5 : 1;
  const falloff = distance <= effectiveRange ? 1 : clamp(1 - (distance - effectiveRange) / 40, 0.45, 1);
  return base * multiplier * falloff;
};

export const tickCooldown = (remaining: number, delta: number): number =>
  Math.max(0, remaining - delta);

export const healCapped = (health: number, amount: number, maxHealth: number): number =>
  Math.min(maxHealth, health + amount);

export const chargeUltimate = (current: number, amount: number): number =>
  clamp(current + amount, 0, 100);

export const spendAmmo = (ammo: number): number => Math.max(0, ammo - 1);

export const finishReload = (magazine: number): number => magazine;

export const tickRespawn = (remaining: number, delta: number): { remaining: number; ready: boolean } => {
  const next = Math.max(0, remaining - delta);
  return { remaining: next, ready: next === 0 };
};

export const captureDelta = (
  playerPresent: boolean,
  enemyPresent: boolean,
  delta: number,
  secondsToCapture = 12,
): number => (playerPresent === enemyPresent ? 0 : (playerPresent ? 1 : -1) * (delta / secondsToCapture));

export const shouldEndMatch = (
  playerScore: number,
  enemyScore: number,
  timeLeft: number,
): 'victory' | 'defeat' | null => {
  if (playerScore >= 100) return 'victory';
  if (enemyScore >= 100) return 'defeat';
  if (timeLeft > 0) return null;
  return playerScore >= enemyScore ? 'victory' : 'defeat';
};
