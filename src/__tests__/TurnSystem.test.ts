import { describe, it, expect } from 'vitest';
import { TurnSystem, TurnPhase } from '../systems/TurnSystem';

describe('TurnSystem', () => {
  it('starts in PLAYER_TURN', () => {
    const ts = new TurnSystem();
    expect(ts.phase).toBe(TurnPhase.PLAYER_TURN);
    expect(ts.isPlayerTurn).toBe(true);
  });

  it('endPlayerTurn transitions to ENEMY_TURN', () => {
    const ts = new TurnSystem();
    ts.endPlayerTurn();
    expect(ts.phase).toBe(TurnPhase.ENEMY_TURN);
    expect(ts.isPlayerTurn).toBe(false);
  });

  it('startPlayerTurn returns to PLAYER_TURN', () => {
    const ts = new TurnSystem();
    ts.endPlayerTurn();
    ts.startPlayerTurn();
    expect(ts.isPlayerTurn).toBe(true);
  });

  it('reset returns to PLAYER_TURN', () => {
    const ts = new TurnSystem();
    ts.endPlayerTurn();
    ts.reset();
    expect(ts.isPlayerTurn).toBe(true);
  });
});
