import { describe, expect, it } from 'vitest';
import {
  calculateDamage,
  captureDelta,
  chargeUltimate,
  finishReload,
  healCapped,
  shouldEndMatch,
  spendAmmo,
  tickCooldown,
  tickRespawn,
} from './combat';

describe('combat rules', () => {
  it('applies body and headshot damage', () => {
    expect(calculateDamage(18, 10)).toBe(18);
    expect(calculateDamage(18, 10, true)).toBe(27);
  });
  it('falls damage off beyond effective range', () => {
    expect(calculateDamage(18, 55)).toBeLessThan(18);
    expect(calculateDamage(18, 90)).toBeCloseTo(8.1);
  });
  it('ticks cooldowns without becoming negative', () => {
    expect(tickCooldown(3, 0.5)).toBe(2.5);
    expect(tickCooldown(0.2, 1)).toBe(0);
  });
  it('spends ammunition and completes reloads', () => {
    expect(spendAmmo(30)).toBe(29);
    expect(spendAmmo(0)).toBe(0);
    expect(finishReload(30)).toBe(30);
  });
  it('caps healing and ultimate charge', () => {
    expect(healCapped(210, 28, 220)).toBe(220);
    expect(chargeUltimate(96, 10)).toBe(100);
  });
  it('captures only when uncontested', () => {
    expect(captureDelta(true, false, 1)).toBeCloseTo(1 / 12);
    expect(captureDelta(true, true, 1)).toBe(0);
  });
  it('determines score and timer results', () => {
    expect(shouldEndMatch(100, 40, 80)).toBe('victory');
    expect(shouldEndMatch(45, 60, 0)).toBe('defeat');
    expect(shouldEndMatch(45, 60, 10)).toBeNull();
  });
  it('counts down death and signals respawn', () => {
    expect(tickRespawn(5, 1)).toEqual({ remaining: 4, ready: false });
    expect(tickRespawn(0.2, 1)).toEqual({ remaining: 0, ready: true });
  });
  it('keeps delta-time movement consistent', () => {
    const speed = 5.5;
    const sixtyHz = Array.from({ length: 60 }).reduce<number>((sum) => sum + speed / 60, 0);
    const thirtyHz = Array.from({ length: 30 }).reduce<number>((sum) => sum + speed / 30, 0);
    expect(sixtyHz).toBeCloseTo(thirtyHz, 5);
  });
});
