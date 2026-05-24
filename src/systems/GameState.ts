import { GameMap } from '../world/GameMap';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { FOVSystem } from './FOV';
import { TurnSystem } from './TurnSystem';
import { MessageLog } from '../ui/MessageLog';

export interface GameState {
  map: GameMap;
  player: Player;
  enemies: Enemy[];
  fov: FOVSystem;
  turnSystem: TurnSystem;
  messageLog: MessageLog;
  kills: number;
  chests: Map<string, boolean>;
  bossRoomIdx: number;
  minibossRoomIdx: number;
  altarRoomIdx: number;
  altarUsed: boolean;
  bossKilled: boolean;
  classId: string;
  enemyBleeds: Map<string, { ticks: number; damage: number }>;
}
