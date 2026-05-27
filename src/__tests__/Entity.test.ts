import { describe, it, expect } from 'vitest';
import { Entity } from '../entities/Entity';

function makeEntity(hp = 20): Entity {
  return new Entity('test', 'Test', 0, 0, hp, 5, 2, 'test_tex');
}

describe('Entity', () => {
  describe('isAlive', () => {
    it('returns true when hp > 0', () => {
      expect(makeEntity(10).isAlive).toBe(true);
    });

    it('returns false when hp <= 0', () => {
      const e = makeEntity(10);
      e.takeDamage(10);
      expect(e.isAlive).toBe(false);
    });

    it('returns false when hp is 0', () => {
      const e = makeEntity(0);
      expect(e.isAlive).toBe(false);
    });
  });

  describe('takeDamage', () => {
    it('reduces hp by amount', () => {
      const e = makeEntity(20);
      e.takeDamage(8);
      expect(e.hp).toBe(12);
    });

    it('returns the damage amount', () => {
      const e = makeEntity(20);
      expect(e.takeDamage(5)).toBe(5);
    });

    it('allows hp to go below 0', () => {
      const e = makeEntity(5);
      e.takeDamage(10);
      expect(e.hp).toBe(-5);
    });
  });

  describe('heal', () => {
    it('restores hp up to maxHp', () => {
      const e = makeEntity(20);
      e.takeDamage(10);
      e.heal(5);
      expect(e.hp).toBe(15);
    });

    it('does not exceed maxHp', () => {
      const e = makeEntity(20);
      e.takeDamage(5);
      e.heal(20);
      expect(e.hp).toBe(20);
    });

    it('returns actual amount healed', () => {
      const e = makeEntity(20);
      e.takeDamage(8);
      const healed = e.heal(5);
      expect(healed).toBe(5);
    });

    it('returns 0 when already at maxHp', () => {
      const e = makeEntity(20);
      expect(e.heal(10)).toBe(0);
    });

    it('partial heal returns correct amount', () => {
      const e = makeEntity(20);
      e.takeDamage(3);
      const healed = e.heal(10);
      expect(healed).toBe(3);
      expect(e.hp).toBe(20);
    });
  });
});
