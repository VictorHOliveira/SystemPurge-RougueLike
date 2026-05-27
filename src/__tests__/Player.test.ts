import { describe, it, expect } from 'vitest';
import { Player } from '../entities/Player';
import { getClassById } from '../data/classes';

function makePlayer(classId = 'limpador'): Player {
  return new Player(getClassById(classId), 5, 5);
}

describe('Player', () => {
  describe('effectiveAtk', () => {
    it('equals base attack with no temp bonus', () => {
      const p = makePlayer();
      expect(p.effectiveAtk).toBe(p.attack);
    });

    it('includes tempAtkBonus', () => {
      const p = makePlayer();
      p.tempAtkBonus = 3;
      expect(p.effectiveAtk).toBe(p.attack + 3);
    });
  });

  describe('effectiveDef', () => {
    it('equals base defense with no temp bonus', () => {
      const p = makePlayer();
      expect(p.effectiveDef).toBe(p.defense);
    });

    it('includes tempDefBonus', () => {
      const p = makePlayer();
      p.tempDefBonus = 2;
      expect(p.effectiveDef).toBe(p.defense + 2);
    });
  });

  describe('effectiveFov', () => {
    it('equals class fov with no bonus', () => {
      const p = makePlayer();
      expect(p.effectiveFov).toBe(p.classDef.fov);
    });

    it('includes bonusFov', () => {
      const p = makePlayer();
      p.bonusFov = 3;
      expect(p.effectiveFov).toBe(p.classDef.fov + 3);
    });
  });

  describe('reflectChance', () => {
    it('returns 0 with no network_shield', () => {
      expect(makePlayer().reflectChance).toBe(0);
    });

    it('returns 0.15 at level 1', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('network_shield', 1);
      expect(p.reflectChance).toBe(0.15);
    });

    it('returns 0.30 at level 2', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('network_shield', 2);
      expect(p.reflectChance).toBe(0.30);
    });

    it('returns 0.50 at level 3', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('network_shield', 3);
      expect(p.reflectChance).toBe(0.50);
    });

    it('caps at 0.50 even if level > 3', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('network_shield', 5);
      expect(p.reflectChance).toBe(0.50);
    });
  });

  describe('lifeStealAmount', () => {
    it('returns 0 with no life_steal', () => {
      expect(makePlayer().lifeStealAmount).toBe(0);
    });

    it('returns 2 at level 1', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('life_steal', 1);
      expect(p.lifeStealAmount).toBe(2);
    });

    it('returns 4 at level 2', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('life_steal', 2);
      expect(p.lifeStealAmount).toBe(4);
    });

    it('returns 8 at level 3', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('life_steal', 3);
      expect(p.lifeStealAmount).toBe(8);
    });
  });

  describe('hasRegen', () => {
    it('returns false without cache_partition', () => {
      expect(makePlayer().hasRegen).toBe(false);
    });

    it('returns true with cache_partition', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('cache_partition', 1);
      expect(p.hasRegen).toBe(true);
    });
  });

  describe('hasFatalGuard', () => {
    it('returns false without boot_sector', () => {
      expect(makePlayer().hasFatalGuard).toBe(false);
    });

    it('returns true with boot_sector and not used', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('boot_sector', 1);
      expect(p.hasFatalGuard).toBe(true);
    });

    it('returns false after fatalGuardUsed', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('boot_sector', 1);
      p.fatalGuardUsed = true;
      expect(p.hasFatalGuard).toBe(false);
    });
  });

  describe('hasEncryption', () => {
    it('returns false without encryption_layer', () => {
      expect(makePlayer().hasEncryption).toBe(false);
    });

    it('returns true with encryption_layer and not used', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('encryption_layer', 1);
      expect(p.hasEncryption).toBe(true);
    });

    it('returns false after encryptionLayerUsed', () => {
      const p = makePlayer();
      p.acquiredUpgrades.set('encryption_layer', 1);
      p.encryptionLayerUsed = true;
      expect(p.hasEncryption).toBe(false);
    });
  });

  describe('freeSlots / addItem / removeItem / getItem', () => {
    it('freeSlots returns unlockedSlots count of null slots', () => {
      const p = makePlayer();
      expect(p.freeSlots()).toBe(2);
    });

    it('addItem places item in first free slot', () => {
      const p = makePlayer();
      expect(p.addItem('health_potion')).toBe(true);
      expect(p.inventory[0]).toBe('health_potion');
      expect(p.freeSlots()).toBe(1);
    });

    it('addItem returns false when inventory is full', () => {
      const p = makePlayer();
      p.addItem('a');
      p.addItem('b');
      expect(p.addItem('c')).toBe(false);
    });

    it('removeItem returns item and clears slot', () => {
      const p = makePlayer();
      p.addItem('health_potion');
      expect(p.removeItem(0)).toBe('health_potion');
      expect(p.inventory[0]).toBeNull();
    });

    it('removeItem returns null for out-of-bounds slot', () => {
      const p = makePlayer();
      expect(p.removeItem(-1)).toBeNull();
      expect(p.removeItem(99)).toBeNull();
    });

    it('removeItem returns null for empty slot', () => {
      const p = makePlayer();
      expect(p.removeItem(0)).toBeNull();
    });

    it('getItem returns null for out-of-bounds slot', () => {
      const p = makePlayer();
      expect(p.getItem(-1)).toBeNull();
      expect(p.getItem(99)).toBeNull();
    });

    it('freeSlots respects unlockedSlots', () => {
      const p = makePlayer();
      p.unlockedSlots = 4;
      expect(p.freeSlots()).toBe(4);
    });
  });

  describe('canUseAbility / useAbility', () => {
    it('canUseAbility returns true when cooldown is 0 and not used this turn', () => {
      const p = makePlayer();
      expect(p.canUseAbility(0)).toBe(true);
    });

    it('canUseAbility returns false when cooldown > 0', () => {
      const p = makePlayer();
      p.cooldowns[0] = 3;
      expect(p.canUseAbility(0)).toBe(false);
    });

    it('canUseAbility returns false after useAbility', () => {
      const p = makePlayer();
      p.useAbility(0);
      expect(p.canUseAbility(0)).toBe(false);
    });

    it('canUseAbility returns false for invalid index', () => {
      const p = makePlayer();
      expect(p.canUseAbility(-1)).toBe(false);
      expect(p.canUseAbility(99)).toBe(false);
    });

    it('useAbility sets cooldown and hasUsedAbility flag', () => {
      const p = makePlayer();
      p.useAbility(0);
      expect(p.hasUsedAbility).toBe(true);
      expect(p.cooldowns[0]).toBe(p.classDef.abilities[0].cooldown);
    });

    it('useAbility with cooldownReduction reduces cooldown', () => {
      const p = makePlayer();
      p.cooldownReduction = 2;
      p.useAbility(0);
      expect(p.cooldowns[0]).toBeGreaterThan(0);
      expect(p.cooldowns[0]).toBeLessThanOrEqual(p.classDef.abilities[0].cooldown - 2);
    });

    it('useAbility minimum cooldown is 1', () => {
      const p = makePlayer();
      p.cooldownReduction = 99;
      p.useAbility(0);
      expect(p.cooldowns[0]).toBe(1);
    });
  });

  describe('addXp / levelUp', () => {
    it('addXp accumulates xp', () => {
      const p = makePlayer();
      p.addXp(5);
      expect(p.xp).toBe(5);
    });

    it('addXp returns false when not enough for level', () => {
      const p = makePlayer();
      expect(p.addXp(5)).toBe(false);
    });

    it('addXp returns true when leveling up', () => {
      const p = makePlayer();
      expect(p.addXp(20)).toBe(true);
      expect(p.level).toBe(2);
    });

    it('levelUp increments stats', () => {
      const p = makePlayer();
      const oldHp = p.maxHp;
      const oldAtk = p.attack;
      const oldDef = p.defense;
      p.levelUp();
      expect(p.level).toBe(2);
      expect(p.maxHp).toBe(oldHp + 8);
      expect(p.attack).toBe(oldAtk + 2);
      expect(p.defense).toBe(oldDef + 1);
      expect(p.xpToNext).toBe(Math.floor(20 * 1.5));
    });

    it('multiple levels from large xp', () => {
      const p = makePlayer();
      p.addXp(200);
      expect(p.level).toBeGreaterThan(2);
    });
  });

  describe('applyUpgrade', () => {
    it('virus_scan gives +2 atk', () => {
      const p = makePlayer();
      p.applyUpgrade('virus_scan');
      expect(p.attack).toBe(getClassById('limpador').attack + 2);
    });

    it('memory_expansion gives +10 hp', () => {
      const p = makePlayer();
      const oldMaxHp = p.maxHp;
      p.applyUpgrade('memory_expansion');
      expect(p.maxHp).toBe(oldMaxHp + 10);
      expect(p.hp).toBe(oldMaxHp + 10);
    });

    it('cache_partition sets hasRegenCached', () => {
      const p = makePlayer();
      p.applyUpgrade('cache_partition');
      expect(p.hasRegenCached).toBe(true);
    });

    it('speed_boost increases moveSpeed', () => {
      const p = makePlayer();
      const oldSpeed = p.moveSpeed;
      p.applyUpgrade('speed_boost');
      expect(p.moveSpeed).toBe(oldSpeed + 0.5);
    });

    it('system_restore fully heals', () => {
      const p = makePlayer();
      p.takeDamage(15);
      p.applyUpgrade('system_restore');
      expect(p.hp).toBe(p.maxHp);
    });

    it('compression_algorithm scales with level', () => {
      const p = makePlayer();
      p.applyUpgrade('compression_algorithm');
      p.applyUpgrade('compression_algorithm');
      const expectedBonus = 2 * 2;
      expect(p.maxHp).toBe(getClassById('limpador').hp + expectedBonus);
    });
  });

  describe('processTurnEnd', () => {
    it('resets hasUsedAbility', () => {
      const p = makePlayer();
      p.useAbility(0);
      p.processTurnEnd();
      expect(p.hasUsedAbility).toBe(false);
    });

    it('decrements cooldowns', () => {
      const p = makePlayer();
      p.useAbility(0);
      const cd = p.cooldowns[0];
      p.processTurnEnd();
      expect(p.cooldowns[0]).toBe(cd - 1);
    });

    it('does not decay tempAtkCharges on processTurnEnd', () => {
      const p = makePlayer();
      p.tempAtkBonus = 5;
      p.tempAtkCharges = 2;
      p.processTurnEnd();
      expect(p.tempAtkBonus).toBe(5);
      expect(p.tempAtkCharges).toBe(2);
    });

    it('does not decay tempDefCharges on processTurnEnd', () => {
      const p = makePlayer();
      p.tempDefBonus = 3;
      p.tempDefCharges = 2;
      p.processTurnEnd();
      expect(p.tempDefBonus).toBe(3);
      expect(p.tempDefCharges).toBe(2);
    });

    it('does not decay defenseBuffCharges on processTurnEnd', () => {
      const p = makePlayer();
      p.defenseBuffCharges = 3;
      p.processTurnEnd();
      expect(p.defenseBuffCharges).toBe(3);
    });

    it('does not decay reflectBuffCharges on processTurnEnd', () => {
      const p = makePlayer();
      p.reflectBuffCharges = 2;
      p.processTurnEnd();
      expect(p.reflectBuffCharges).toBe(2);
    });

    it('applies bleed damage when bleeding', () => {
      const p = makePlayer();
      p.bleedTicks = 3;
      p.bleedDamage = 2;
      const hpBefore = p.hp;
      p.processTurnEnd();
      expect(p.hp).toBe(hpBefore - 2);
      expect(p.bleedTicks).toBe(2);
    });

    it('includes extraBleedDamage in bleed ticks', () => {
      const p = makePlayer();
      p.bleedTicks = 1;
      p.bleedDamage = 2;
      p.extraBleedDamage = 1;
      const hpBefore = p.hp;
      p.processTurnEnd();
      expect(p.hp).toBe(hpBefore - 3);
    });

    it('regen ticker advances and heals at threshold', () => {
      const p = makePlayer();
      p.hasRegenCached = true;
      p.takeDamage(5);

      // Each 6 ticks: regenAccum += 3
      // After 24 ticks: regenAccum = 12, heal 1, regenAccum -= 10
      for (let i = 0; i < 25; i++) {
        p.processTurnEnd();
      }

      expect(p.hp).toBe(p.maxHp - 5 + 1);
    });
  });

  describe('onNewFloor', () => {
    it('resets encryptionLayerUsed', () => {
      const p = makePlayer();
      p.encryptionLayerUsed = true;
      p.onNewFloor();
      expect(p.encryptionLayerUsed).toBe(false);
    });
  });

  describe('isBleeding / isDefenseBuffed', () => {
    it('isBleeding returns true when bleedTicks > 0', () => {
      const p = makePlayer();
      p.bleedTicks = 2;
      expect(p.isBleeding).toBe(true);
    });

    it('isDefenseBuffed returns true when defenseBuffCharges > 0', () => {
      const p = makePlayer();
      p.defenseBuffCharges = 1;
      expect(p.isDefenseBuffed).toBe(true);
    });
  });
});
