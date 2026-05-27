import { describe, it, expect, vi } from 'vitest';
import { ENEMY_TEMPLATES, randomEnemyTemplate } from '../data/enemies';

describe('ENEMY_TEMPLATES', () => {
  it('has no duplicate names', () => {
    const names = ENEMY_TEMPLATES.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every template has required fields', () => {
    for (const t of ENEMY_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.hp).toBeGreaterThan(0);
      expect(t.attack).toBeGreaterThanOrEqual(0);
      expect(t.minFloor).toBeGreaterThan(0);
      expect(['melee', 'ranged', 'suicide', 'splitter']).toContain(t.behavior);
    }
  });
});

describe('randomEnemyTemplate', () => {
  it('returns only templates with minFloor <= floor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const t = randomEnemyTemplate(1);
    expect(t.minFloor).toBeLessThanOrEqual(1);
    vi.restoreAllMocks();
  });

  it('can return higher floor enemies at higher floors', () => {
    const floor5 = randomEnemyTemplate(5);
    expect(floor5.minFloor).toBeLessThanOrEqual(5);

    const floor1 = randomEnemyTemplate(1);
    expect(floor1.minFloor).toBeLessThanOrEqual(1);
  });
});
