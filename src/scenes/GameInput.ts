import Phaser from 'phaser';
import { MAP_W, MAP_H, TILE, MOVE_COOLDOWN_BASE, TWEEN_DURATION_BASE, TRAP_DMG_MIN, TRAP_DMG_MAX } from '../constants';
import { TileType } from '../data/tiles';
import { rollUpgrades } from '../data/upgrades';
import { sound } from '../audio/SoundManager';
import { GameAction, MOVEMENT_ACTIONS, GAME_ACTIONS, loadBindings, keyNameFromEvent } from '../data/keybindings';
import { GameScene } from './GameScene';

export class InputHandler {
  private game: GameScene;
  keyObjects = new Map<string, Phaser.Input.Keyboard.Key>();
  private keyToAction = new Map<string, GameAction>();

  constructor(game: GameScene) {
    this.game = game;
  }

  init() {
    if (!this.game.input.keyboard) return;
    this.initBindings();
    this.game.input.keyboard.on('keydown', this.handleInput, this);
  }

  destroy() {
    this.game.input?.keyboard?.off('keydown', this.handleInput, this);
    this.keyObjects.forEach(k => k.destroy());
    this.keyObjects.clear();
  }

  initBindings() {
    this.keyToAction.clear();
    this.keyObjects.forEach(k => k.destroy());
    this.keyObjects.clear();

    const kb = this.game.input.keyboard;
    if (!kb) return;

    const b = loadBindings();

    for (const action of MOVEMENT_ACTIONS) {
      const keyName = b[action];
      const keyCode = (Phaser.Input.Keyboard.KeyCodes as Record<string, number>)[keyName];
      if (keyCode !== undefined) {
        this.keyObjects.set(action, kb.addKey(keyCode));
      }
    }

    for (const action of GAME_ACTIONS) {
      this.keyToAction.set(b[action], action);
    }
  }

  handleMovement(delta: number): boolean {
    if (!this.game.state.turnSystem?.isPlayerTurn) return true;
    if (!this.game.state.player.isAlive) return true;

    let dx = 0;
    let dy = 0;
    if (this.keyObjects.get('move_up')?.isDown) dy -= 1;
    if (this.keyObjects.get('move_down')?.isDown) dy += 1;
    if (this.keyObjects.get('move_left')?.isDown) dx -= 1;
    if (this.keyObjects.get('move_right')?.isDown) dx += 1;

    if (dx === 0 && dy === 0) {
      this.game.tempMoveCooldown = 0;
      return false;
    }

    this.game.tempMoveCooldown -= delta;
    if (this.game.tempMoveCooldown > 0) return true;

    this.processMove(Math.sign(dx), Math.sign(dy));
    this.game.tempMoveCooldown = Math.max(40, Math.round(MOVE_COOLDOWN_BASE / this.game.state.player.effectiveMoveSpeed));
    return true;
  }

  private processMove(dx: number, dy: number) {
    const s = this.game.state;
    if (!s.player.isAlive) return;
    const nx = s.player.x + dx;
    const ny = s.player.y + dy;

    if (this.tryEnemyCollision(nx, ny)) return;
    if (!s.map.isWalkable(nx, ny)) return;
    if (this.handleStairs(nx, ny, dx, dy)) return;

    s.player.x = nx;
    s.player.y = ny;
    sound.play('player_move');

    this.handleTrap(nx, ny);
    this.handleAltar(nx, ny);
    this.game.actionSystem.openChest(nx, ny);
    this.game.renderSystem.markDirty(nx, ny);

    this.startMoveAnimation(nx, ny);
  }

  private tryEnemyCollision(nx: number, ny: number): boolean {
    const s = this.game.state;
    const enemy = s.enemies.find(e2 => e2.x === nx && e2.y === ny && e2.isAlive);
    if (enemy) {
      this.game.combatSystem.meleeAttack(s.player, enemy);
      this.game.endTurn();
      return true;
    }
    return false;
  }

  private handleStairs(nx: number, ny: number, dx: number, dy: number): boolean {
    const s = this.game.state;
    if (s.map.tiles[ny][nx] !== TileType.STAIRS_DOWN) return false;
    if (s.enemies.some(e => e.isAlive && e.textureKey === 'enemy_boss')) {
      s.messageLog.add('*** ROOTKIT ativo — elimine-o primeiro ***');
      s.player.x = nx - dx;
      s.player.y = ny - dy;
      this.game.endTurn();
      return true;
    }
    s.player.x = nx;
    s.player.y = ny;
    s.messageLog.add('Acessando próximo diretório...');
    this.game.generateFloor();
    return true;
  }

  private handleTrap(nx: number, ny: number) {
    const s = this.game.state;
    if (s.map.tiles[ny][nx] !== TileType.TRAP) return;
    const floor = s.player.floor;
    const dmg = Phaser.Math.Between(TRAP_DMG_MIN + Math.floor(floor / 3), TRAP_DMG_MAX + Math.floor(floor / 2));
    s.player.takeDamage(dmg);
    this.game.renderSystem.spawnParticles(nx, ny, 0xff4444, 6);
    s.messageLog.add(`Armadilha de dados! -${dmg} HP`);
    s.map.setTile(nx, ny, TileType.BURNED);
    this.game.renderSystem.markDirty(nx, ny);
  }

  private handleAltar(nx: number, ny: number) {
    const s = this.game.state;
    if (s.map.tiles[ny][nx] !== TileType.ALTAR || s.altarUsed) return;
    s.altarUsed = true;
    this.game.renderSystem.spawnParticles(nx, ny, 0xcc66ff, 8);
    const upgs = rollUpgrades(s.player.acquiredUpgrades, 1, this.game.classId);
    if (upgs.length > 0) {
      const upg = upgs[0];
      s.player.applyUpgrade(upg.id);
      s.messageLog.add(`Altar do Sistema concedeu ${upg.name}!`);
      s.fov.setRadius(s.player.effectiveFov);
      s.fov.compute(s.map, s.player.x, s.player.y);
    }
    s.map.setTile(nx, ny, TileType.FLOOR);
    this.game.renderSystem.markDirty(nx, ny);
  }

  private startMoveAnimation(nx: number, ny: number) {
    const s = this.game.state;
    const spr = this.game.renderSystem.entitySprites.get('player');
    if (spr) {
      this.game.isAnimating = true;
      this.game.tweens.add({
        targets: spr,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: Math.max(20, Math.round(TWEEN_DURATION_BASE / s.player.effectiveMoveSpeed)),
        ease: 'Linear',
        onComplete: () => {
          this.game.isAnimating = false;
          this.game.endTurn();
        },
      });
    } else {
      this.game.endTurn();
    }
  }

  private handleInput = (e: KeyboardEvent) => {
    const keyName = keyNameFromEvent(e);
    if (!keyName) return;
    const action = this.keyToAction.get(keyName);
    if (!action) return;

    switch (action) {
      case 'pause':
        this.game.scene.pause();
        this.game.scene.pause('HUD');
        this.game.scene.launch('Pause');
        return;
      case 'wait':
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        e.preventDefault();
        this.game.endTurn();
        return;
      case 'ability_0':
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.actionSystem.useAbility(0);
        return;
      case 'ability_1':
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.actionSystem.useAbility(1);
        return;
      case 'ability_2':
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.actionSystem.useAbility(2);
        return;
      case 'shoot_up':
        if (!this.game.state.player.classDef.canShoot) return;
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.projectileSystem.fireProjectile(0, -1);
        return;
      case 'shoot_down':
        if (!this.game.state.player.classDef.canShoot) return;
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.projectileSystem.fireProjectile(0, 1);
        return;
      case 'shoot_left':
        if (!this.game.state.player.classDef.canShoot) return;
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.projectileSystem.fireProjectile(-1, 0);
        return;
      case 'shoot_right':
        if (!this.game.state.player.classDef.canShoot) return;
        if (this.game.isAnimating) return;
        if (!this.game.state.turnSystem?.isPlayerTurn) return;
        this.game.projectileSystem.fireProjectile(1, 0);
        return;
      case 'item_0':
        this.game.actionSystem.useItem(0);
        return;
      case 'item_1':
        this.game.actionSystem.useItem(1);
        return;
      case 'item_2':
        this.game.actionSystem.useItem(2);
        return;
      case 'item_3':
        this.game.actionSystem.useItem(3);
        return;
      case 'item_4':
        this.game.actionSystem.useItem(4);
        return;
      case 'item_5':
        this.game.actionSystem.useItem(5);
        return;
    }
  };
}
