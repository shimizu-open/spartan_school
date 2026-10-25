// Model: one person in a space, and the rules for changing them.
// Every function here checks its input, because it comes from the network.

import { createHash } from 'node:crypto';
import { DRINKS, MAX_NAME, MAX_STATUS_NOTE, STATUS_KEYS, TILE, cleanText, sanitizeLook } from '../../shared/constants.ts';
import { MAP_H, MAP_W, SPAWN, collides, nearestFree, occupiedBy } from '../../shared/map.ts';
import type { AvatarLook, Dir, MoveMsg, Player, PlayerStatePatch } from '../../shared/types.ts';

const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];

/** New people appear near the entrance, on a spot where nobody else is standing. */
export function createPlayer(id: string, uid: string, name: string, look: AvatarLook, others: Iterable<Player> = []): Player {
  const spot = nearestFree(SPAWN.x, SPAWN.y, occupiedBy(others, TILE * 2));
  return {
    id,
    uid,
    name,
    look,
    x: spot.x,
    y: spot.y,
    dir: 'down',
    moving: false,
    status: 'present',
    statusNote: '',
    mic: false,
    cam: false,
    screen: false,
    hand: false,
    megaphone: false,
    pose: 'stand',
    dancing: false,
    item: '',
  };
}

/**
 * Turns the browser's secret key into its public, stable id.
 * Others see only the hash, so they cannot pretend to be you.
 * A missing or malformed key gets a one-time id (that visit only).
 */
export function uidFromKey(key: unknown, fallback: string): string {
  const ok = typeof key === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(key);
  return createHash('sha256').update(`pixel-office:${ok ? key : fallback}`).digest('hex').slice(0, 24);
}

/** Validates a name + look sent by a client. Returns null if invalid. */
export function parseProfile(raw: unknown): { name: string; look: AvatarLook } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = cleanText(o.name, MAX_NAME);
  const look = sanitizeLook(o.look);
  return name && look ? { name, look } : null;
}

/** Applies a move if it is a valid walkable position. Returns false if rejected. */
export function applyMove(p: Player, raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Partial<MoveMsg>;
  const x = Number(m.x);
  const y = Number(m.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 0 || y < 0 || x > MAP_W * TILE || y > MAP_H * TILE) return false;
  // The browser checks walls too; this stops a modified client from walking through them.
  if (collides(x, y)) return false;
  p.x = Math.round(x * 10) / 10;
  p.y = Math.round(y * 10) / 10;
  if (typeof m.dir === 'string' && DIRS.includes(m.dir)) p.dir = m.dir;
  p.moving = m.moving === true;
  // walking always ends sitting and dancing
  if (p.moving) {
    p.pose = 'stand';
    p.dancing = false;
  }
  return true;
}

/** Applies the allowed fields of a state change. Returns what actually changed (empty if nothing). */
export function applyState(p: Player, raw: unknown): PlayerStatePatch {
  const out: PlayerStatePatch = {};
  if (!raw || typeof raw !== 'object') return out;
  const s = raw as Record<string, unknown>;
  if (typeof s.status === 'string' && (STATUS_KEYS as string[]).includes(s.status)) out.status = s.status as Player['status'];
  for (const k of ['mic', 'cam', 'screen', 'hand', 'megaphone', 'dancing'] as const) {
    if (typeof s[k] === 'boolean') out[k] = s[k];
  }
  if (s.pose === 'stand' || s.pose === 'sit') out.pose = s.pose;
  if (s.statusNote !== undefined) out.statusNote = cleanText(s.statusNote, MAX_STATUS_NOTE);
  if (s.item === '' || (typeof s.item === 'string' && (DRINKS as readonly string[]).includes(s.item))) out.item = s.item as string;
  Object.assign(p, out);
  return out;
}
