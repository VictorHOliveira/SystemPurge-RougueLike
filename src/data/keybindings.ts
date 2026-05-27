export type GameAction =
  | 'move_up' | 'move_down' | 'move_left' | 'move_right'
  | 'ability_0' | 'ability_1' | 'ability_2'
  | 'shoot_up' | 'shoot_down' | 'shoot_left' | 'shoot_right'
  | 'item_0' | 'item_1' | 'item_2' | 'item_3' | 'item_4' | 'item_5'
  | 'wait' | 'pause' | 'restart';

export const GAME_ACTIONS: GameAction[] = [
  'move_up', 'move_down', 'move_left', 'move_right',
  'ability_0', 'ability_1', 'ability_2',
  'shoot_up', 'shoot_down', 'shoot_left', 'shoot_right',
  'item_0', 'item_1', 'item_2', 'item_3', 'item_4', 'item_5',
  'wait', 'pause',
];

export const MOVEMENT_ACTIONS: GameAction[] = [
  'move_up', 'move_down', 'move_left', 'move_right',
];

export type Bindings = Record<GameAction, string>;

const STORAGE_KEY = 'systempurge_bindings';

const DEFAULTS: Bindings = {
  move_up: 'UP',
  move_down: 'DOWN',
  move_left: 'LEFT',
  move_right: 'RIGHT',
  ability_0: 'Q',
  ability_1: 'E',
  ability_2: 'R',
  shoot_up: 'W',
  shoot_down: 'S',
  shoot_left: 'A',
  shoot_right: 'D',
  item_0: 'ONE',
  item_1: 'TWO',
  item_2: 'THREE',
  item_3: 'FOUR',
  item_4: 'FIVE',
  item_5: 'SIX',
  wait: 'SPACE',
  pause: 'ESC',
  restart: 'R',
};

export function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const b = { ...DEFAULTS };
      for (const key of GAME_ACTIONS) {
        if (typeof parsed[key] === 'string') b[key] = parsed[key].toUpperCase();
      }
      return b;
    }
  } catch { }
  return { ...DEFAULTS };
}

export function saveBindings(b: Bindings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

export function resetDefaults(): Bindings {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULTS };
}

const DOM_TO_KEY: Record<string, string> = {
  ArrowUp: 'UP', ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  ' ': 'SPACE', Escape: 'ESC',
  '.': 'PERIOD',
  '0': 'ZERO', '1': 'ONE', '2': 'TWO', '3': 'THREE',
  '4': 'FOUR', '5': 'FIVE', '6': 'SIX', '7': 'SEVEN',
  '8': 'EIGHT', '9': 'NINE',
};

export function keyNameFromEvent(e: KeyboardEvent): string | null {
  if (DOM_TO_KEY[e.key]) return DOM_TO_KEY[e.key];
  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

const KEY_DISPLAY: Record<string, string> = {
  UP: '\u2191', DOWN: '\u2193', LEFT: '\u2190', RIGHT: '\u2192',
  SPACE: 'Espa\u00e7o', ESC: 'ESC', PERIOD: '.',
  ZERO: '0', ONE: '1', TWO: '2', THREE: '3',
  FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7',
  EIGHT: '8', NINE: '9',
};

export function displayKey(keyName: string): string {
  return KEY_DISPLAY[keyName] || keyName;
}

const ACTION_LABELS: Record<GameAction, string> = {
  move_up: 'Mover para cima',
  move_down: 'Mover para baixo',
  move_left: 'Mover para a esquerda',
  move_right: 'Mover para a direita',
  ability_0: 'Habilidade 1',
  ability_1: 'Habilidade 2',
  ability_2: 'Habilidade 3',
  shoot_up: 'Atirar para cima',
  shoot_down: 'Atirar para baixo',
  shoot_left: 'Atirar para a esquerda',
  shoot_right: 'Atirar para a direita',
  item_0: 'Item 1',
  item_1: 'Item 2',
  item_2: 'Item 3',
  item_3: 'Item 4',
  item_4: 'Item 5',
  item_5: 'Item 6',
  wait: 'Aguardar turno',
  pause: 'Pausar',
  restart: 'Reiniciar',
};

export function actionLabel(action: GameAction): string {
  return ACTION_LABELS[action];
}
