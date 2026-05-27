import { describe, it, expect } from 'vitest';
import { getClassById, CLASSES } from '../data/classes';

describe('CLASSES', () => {
  it('has no duplicate ids', () => {
    const ids = CLASSES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getClassById', () => {
  it('returns limpador class', () => {
    const c = getClassById('limpador');
    expect(c.id).toBe('limpador');
    expect(c.name).toBe('Limpador de Registro');
    expect(c.hp).toBe(30);
    expect(c.attack).toBe(5);
  });

  it('returns ping_sniper class', () => {
    const c = getClassById('ping_sniper');
    expect(c.id).toBe('ping_sniper');
    expect(c.canShoot).toBe(true);
    expect(c.canMelee).toBe(false);
  });

  it('returns muralha class', () => {
    const c = getClassById('muralha');
    expect(c.reflectPercent).toBe(50);
    expect(c.pressureDamage).toBe(1);
  });

  it('returns daemon class', () => {
    const c = getClassById('daemon');
    expect(c.ignoreDefense).toBe(true);
  });

  it('throws for unknown id', () => {
    expect(() => getClassById('unknown')).toThrow('Classe desconhecida: unknown');
  });
});
