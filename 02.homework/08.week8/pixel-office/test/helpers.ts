// Test helpers that do not depend on a particular map layout.

import { TILE } from '../shared/constants.ts';
import { AREAS, MAP_H, MAP_W, SPAWN, areaAt, collides, tileCenter } from '../shared/map.ts';
import { findPath } from '../shared/path.ts';

/** A walkable spot reachable from SPAWN, outside special areas, at least `minTiles` away. */
export function farPoint(minTiles = 15): { x: number; y: number } {
  let best: { x: number; y: number; d: number } | null = null;
  for (let ty = 1; ty < MAP_H - 1; ty++)
    for (let tx = 1; tx < MAP_W - 1; tx++) {
      const p = tileCenter(tx, ty);
      if (collides(p.x, p.y)) continue;
      const a = areaAt(p.x, p.y);
      if (a && (a.private || a.quiet || a.stage || a.id === a.audience)) continue;
      if (AREAS.some((s) => s.audience && s.audience === a?.id)) continue;
      const d = Math.hypot(p.x - SPAWN.x, p.y - SPAWN.y) / TILE;
      if (d >= minTiles && (!best || d > best.d)) best = { ...p, d };
    }
  if (!best || !findPath(SPAWN, best)) throw new Error('no far point');
  return { x: best.x, y: best.y };
}

/** A walkable spot inside an area. */
export function inside(areaId: string, dx = 1, dy = 1): { x: number; y: number } {
  const a = AREAS.find((x) => x.id === areaId);
  if (!a) throw new Error(`no area ${areaId}`);
  for (let ty = a.y + dy; ty < a.y + a.h; ty++)
    for (let tx = a.x + dx; tx < a.x + a.w; tx++) {
      const p = tileCenter(tx, ty);
      if (!collides(p.x, p.y) && areaAt(p.x, p.y)?.id === a.id) return p;
    }
  throw new Error(`no free tile in ${areaId}`);
}
