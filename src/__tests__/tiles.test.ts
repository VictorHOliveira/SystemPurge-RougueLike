import { describe, it, expect } from 'vitest';
import { TileType, tileName, tileIsWalkable, tileIsTransparent } from '../data/tiles';

describe('tileName', () => {
  it('returns correct names', () => {
    expect(tileName(TileType.WALL)).toBe('wall');
    expect(tileName(TileType.FLOOR)).toBe('floor');
    expect(tileName(TileType.STAIRS_DOWN)).toBe('stairs');
    expect(tileName(TileType.STAIRS_UP)).toBe('stairs_up');
    expect(tileName(TileType.TRAP)).toBe('trap');
    expect(tileName(TileType.ALTAR)).toBe('altar');
    expect(tileName(TileType.BURNED)).toBe('burned');
  });
});

describe('tileIsWalkable', () => {
  it('WALL is not walkable', () => {
    expect(tileIsWalkable(TileType.WALL)).toBe(false);
  });

  it('FLOOR is walkable', () => {
    expect(tileIsWalkable(TileType.FLOOR)).toBe(true);
  });

  it('TRAP is walkable', () => {
    expect(tileIsWalkable(TileType.TRAP)).toBe(true);
  });
});

describe('tileIsTransparent', () => {
  it('WALL is not transparent', () => {
    expect(tileIsTransparent(TileType.WALL)).toBe(false);
  });

  it('FLOOR is transparent', () => {
    expect(tileIsTransparent(TileType.FLOOR)).toBe(true);
  });
});
