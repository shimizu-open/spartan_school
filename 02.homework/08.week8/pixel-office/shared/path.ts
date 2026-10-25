// Path finding on the tile grid (for "click to walk there" and "follow").
// Breadth-first search over walkable tiles, 8 directions without cutting corners.

import { TILE } from './constants.ts';
import { MAP_H, MAP_W, isSolidTile, tileCenter } from './map.ts';

export interface Point {
  x: number;
  y: number;
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

/** Returns a list of feet positions from (near) `from` to `to`, or null if unreachable. */
export function findPath(from: Point, to: Point, maxNodes = 6000): Point[] | null {
  const sx = Math.floor(from.x / TILE);
  const sy = Math.floor((from.y - 1) / TILE);
  let tx = Math.floor(to.x / TILE);
  let ty = Math.floor((to.y - 1) / TILE);
  if (isSolidTile(tx, ty)) {
    // aim for the closest walkable neighbour of a clicked wall/object
    let best: [number, number] | null = null;
    for (let r = 1; r <= 2 && !best; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (!best && !isSolidTile(tx + dx, ty + dy)) best = [tx + dx, ty + dy];
    if (!best) return null;
    [tx, ty] = best;
  }
  if (sx === tx && sy === ty) return [tileCenter(tx, ty)];
  const key = (x: number, y: number) => y * MAP_W + x;
  const prev = new Map<number, number>();
  prev.set(key(sx, sy), -1);
  const queue: number[] = [key(sx, sy)];
  let found = false;
  for (let i = 0; i < queue.length && prev.size < maxNodes; i++) {
    const k = queue[i]!;
    const x = k % MAP_W;
    const y = Math.floor(k / MAP_W);
    if (x === tx && y === ty) {
      found = true;
      break;
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (isSolidTile(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isSolidTile(x + dx, y) || isSolidTile(x, y + dy))) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (!found) return null;
  const tiles: number[] = [];
  for (let k = key(tx, ty); k !== -1; k = prev.get(k)!) tiles.push(k);
  tiles.reverse();
  return tiles.slice(1).map((k) => tileCenter(k % MAP_W, Math.floor(k / MAP_W)));
}
