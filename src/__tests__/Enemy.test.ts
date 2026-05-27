import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TEMPLATES } from '../data/enemies';

function meleeEnemy(x = 5, y = 5): Enemy {
  const template = ENEMY_TEMPLATES.find(t => t.behavior === 'melee')!;
  return new Enemy(template, x, y);
}

function rangedEnemy(x = 5, y = 5): Enemy {
  const template = ENEMY_TEMPLATES.find(t => t.behavior === 'ranged')!;
  return new Enemy(template, x, y);
}

function suicideEnemy(x = 5, y = 5): Enemy {
  const template = ENEMY_TEMPLATES.find(t => t.behavior === 'suicide')!;
  return new Enemy(template, x, y);
}

function alwaysWalkable(): boolean { return true; }
function neverWalkable(): boolean { return false; }
function notOccupied(): boolean { return false; }
function alwaysOccupied(): boolean { return true; }

describe('Enemy', () => {
  beforeEach(() => {
    Enemy.resetId();
  });

  describe('constructor', () => {
    it('assigns unique ids', () => {
      const e1 = meleeEnemy();
      const e2 = meleeEnemy();
      expect(e1.id).not.toBe(e2.id);
    });

    it('sets xpValue from template hp + atk', () => {
      const e = meleeEnemy();
      expect(e.xpValue).toBeGreaterThan(0);
    });
  });

  describe('skipNextTurn', () => {
    it('skips a turn when flag is set', () => {
      const e = meleeEnemy(5, 5);
      e.skipNextTurn = true;
      const xBefore = e.x;
      e.takeTurn(10, 10, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(xBefore);
      expect(e.skipNextTurn).toBe(false);
    });
  });

  describe('moveToward (melee default)', () => {
    it('moves diagonally toward the player', () => {
      const e = meleeEnemy(5, 5);
      e.takeTurn(7, 7, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(6);
      expect(e.y).toBe(6);
    });

    it('moves horizontally when only dx differs', () => {
      const e = meleeEnemy(5, 5);
      e.takeTurn(8, 5, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(6);
      expect(e.y).toBe(5);
    });

    it('moves vertically when only dy differs', () => {
      const e = meleeEnemy(5, 5);
      e.takeTurn(5, 8, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(5);
      expect(e.y).toBe(6);
    });

    it('stays in place when all directions blocked', () => {
      const e = meleeEnemy(5, 5);
      e.takeTurn(7, 7, true, neverWalkable, notOccupied);
      expect(e.x).toBe(5);
      expect(e.y).toBe(5);
    });

    it('tries diagonal first, then cardinal', () => {
      const e = meleeEnemy(5, 5);
      let callCount = 0;
      const pickyWalkable = (x: number, y: number) => {
        callCount++;
        if (callCount === 1) return false; // block diagonal
        return true;
      };
      e.takeTurn(7, 7, true, pickyWalkable, notOccupied);
      expect(e.x).toBe(6);
      expect(e.y).toBe(5);
    });
  });

  describe('wander (canSeePlayer=false)', () => {
    it('moves to a valid neighbor', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const e = meleeEnemy(5, 5);
      e.takeTurn(0, 0, false, alwaysWalkable, notOccupied);
      const dx = Math.abs(e.x - 5);
      const dy = Math.abs(e.y - 5);
      expect(dx + dy).toBe(1); // moved exactly 1 tile
      vi.restoreAllMocks();
    });

    it('stays in place when all directions blocked', () => {
      const e = meleeEnemy(5, 5);
      e.takeTurn(0, 0, false, neverWalkable, notOccupied);
      expect(e.x).toBe(5);
      expect(e.y).toBe(5);
    });
  });

  describe('ranged behavior', () => {
    it('flees when player within 3 tiles', () => {
      const e = rangedEnemy(5, 5);
      e.takeTurn(6, 6, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(4);
      expect(e.y).toBe(4);
    });

    it('stays still when dist >= 3', () => {
      const e = rangedEnemy(5, 5);
      e.takeTurn(9, 5, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(5);
      expect(e.y).toBe(5);
    });

    it('wanders when cannot see player', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const e = rangedEnemy(5, 5);
      e.takeTurn(0, 0, false, alwaysWalkable, notOccupied);
      const dx = Math.abs(e.x - 5);
      const dy = Math.abs(e.y - 5);
      expect(dx + dy).toBe(1); // moved exactly 1 tile
      vi.restoreAllMocks();
    });

    it('tries cardinal flee when diagonal is blocked', () => {
      const e = rangedEnemy(5, 5);
      let callCount = 0;
      const pickyWalkable = (x: number, y: number) => {
        callCount++;
        if (callCount === 1) return false; // block diagonal flee
        return true;
      };
      e.takeTurn(6, 6, true, pickyWalkable, notOccupied);
      expect(e.x).toBe(4);
      expect(e.y).toBe(5);
    });
  });

  describe('suicide behavior', () => {
    it('moves toward player when visible', () => {
      const e = suicideEnemy(5, 5);
      e.takeTurn(7, 7, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(6);
      expect(e.y).toBe(6);
    });

    it('wanders when cannot see player', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const e = suicideEnemy(5, 5);
      e.takeTurn(0, 0, false, alwaysWalkable, notOccupied);
      const dx = Math.abs(e.x - 5);
      const dy = Math.abs(e.y - 5);
      expect(dx + dy).toBe(1); // moved exactly 1 tile
      vi.restoreAllMocks();
    });
  });

  describe('setTarget', () => {
    it('updates internal target', () => {
      const e = meleeEnemy(5, 5);
      e.setTarget(10, 20);
      e.takeTurn(10, 20, true, alwaysWalkable, notOccupied);
      expect(e.x).toBe(6);
      expect(e.y).toBe(6);
    });
  });
});
