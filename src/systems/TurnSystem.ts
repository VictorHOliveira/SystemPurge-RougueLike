export enum TurnPhase {
  PLAYER_TURN,
  ENEMY_TURN,
  DONE,
}

export class TurnSystem {
  phase: TurnPhase = TurnPhase.PLAYER_TURN;

  startPlayerTurn(): void {
    this.phase = TurnPhase.PLAYER_TURN;
  }

  endPlayerTurn(): void {
    this.phase = TurnPhase.ENEMY_TURN;
  }

  endEnemyTurn(): void {
    this.phase = TurnPhase.DONE;
  }

  reset(): void {
    this.phase = TurnPhase.PLAYER_TURN;
  }

  get isPlayerTurn(): boolean {
    return this.phase === TurnPhase.PLAYER_TURN;
  }

  get isEnemyTurn(): boolean {
    return this.phase === TurnPhase.ENEMY_TURN;
  }

  get isDone(): boolean {
    return this.phase === TurnPhase.DONE;
  }
}
