import { describe, it, expect } from 'vitest';
import { keyNameFromEvent, displayKey, actionLabel } from '../data/keybindings';

describe('keyNameFromEvent', () => {
  it('maps ArrowUp to UP', () => {
    expect(keyNameFromEvent({ key: 'ArrowUp' } as KeyboardEvent)).toBe('UP');
  });

  it('maps space to SPACE', () => {
    expect(keyNameFromEvent({ key: ' ' } as KeyboardEvent)).toBe('SPACE');
  });

  it('maps letter to uppercase', () => {
    expect(keyNameFromEvent({ key: 'q' } as KeyboardEvent)).toBe('Q');
    expect(keyNameFromEvent({ key: 'Z' } as KeyboardEvent)).toBe('Z');
  });

  it('returns null for unknown keys', () => {
    expect(keyNameFromEvent({ key: 'F12' } as KeyboardEvent)).toBeNull();
  });
});

describe('displayKey', () => {
  it('uses unicode arrow for UP', () => {
    expect(displayKey('UP')).toBe('\u2191');
  });

  it('returns keyName as-is if not in special map', () => {
    expect(displayKey('Q')).toBe('Q');
  });
});

describe('actionLabel', () => {
  it('returns label for known action', () => {
    expect(actionLabel('move_up')).toBe('Mover para cima');
  });
});
