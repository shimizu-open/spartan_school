// Who can hear whom. The same rules run in every browser and on the server,
// so two people always reach the same answer about each other.

import { CONNECT_DIST, DISCONNECT_DIST, HEAR_FULL, HEAR_MAX, STATUSES } from './constants.ts';
import { areaAt, privateAreaAt } from './map.ts';
import type { Player } from './types.ts';

type Pos = Pick<Player, 'x' | 'y' | 'status' | 'megaphone'>;

export function distance(a: Pos, b: Pos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** At the desk (not away / lunch / break). */
function atDesk(p: Pos): boolean {
  return p.status === 'present' || p.status === 'meeting' || p.status === 'focus';
}

/** Open to automatic calls outside meeting rooms (focus mode is not). */
function open(p: Pos): boolean {
  return STATUSES[p.status]?.talk ?? true;
}

function inQuietArea(p: Pos): boolean {
  return areaAt(p.x, p.y)?.quiet === true;
}

/** True if `speaker` stands on a stage and `listener` is in its audience area (or on the stage too). */
export function stageReaches(speaker: Pos, listener: Pos): boolean {
  const s = areaAt(speaker.x, speaker.y);
  if (!s?.stage) return false;
  const l = areaAt(listener.x, listener.y);
  return !!l && (l.id === s.id || l.id === s.audience);
}

/**
 * Should a call between a and b be open?
 * `connected` says whether it is open now; a slightly larger distance is used
 * to close it than to open it, so the call does not flicker at the edge.
 */
export function shouldConnect(a: Pos, b: Pos, connected: boolean): boolean {
  if (!atDesk(a) || !atDesk(b)) return false;
  if (inQuietArea(a) || inQuietArea(b)) return false;
  const ra = privateAreaAt(a.x, a.y);
  const rb = privateAreaAt(b.x, b.y);
  // Inside a meeting room: everyone in the room (even in focus mode), nobody outside.
  if (ra || rb) return ra?.id === rb?.id;
  // A megaphone or a stage reaches people even if they are in focus mode.
  if (a.megaphone || b.megaphone) return true;
  if (stageReaches(a, b) || stageReaches(b, a)) return true;
  if (!open(a) || !open(b)) return false;
  return distance(a, b) <= (connected ? DISCONNECT_DIST : CONNECT_DIST);
}

/** How loud b sounds to a, from 0 to 1. */
export function volumeBetween(a: Pos, b: Pos): number {
  if (!shouldConnect(a, b, true)) return 0;
  const ra = privateAreaAt(a.x, a.y);
  if (ra) return 1;
  if (b.megaphone || stageReaches(b, a)) return 1;
  if (!open(a) || !open(b)) return 0; // connected only for the other direction
  const d = distance(a, b);
  if (d <= HEAR_FULL) return 1;
  if (d >= HEAR_MAX) return 0;
  return 1 - (d - HEAR_FULL) / (HEAR_MAX - HEAR_FULL);
}

/**
 * Server-side check before passing call setup messages between two people.
 * Slightly looser than shouldConnect (positions arrive with a small delay),
 * but it stops someone far away from opening a call to your camera.
 */
export function maySignal(a: Pos, b: Pos): boolean {
  if (shouldConnect(a, b, true)) return true;
  if (privateAreaAt(a.x, a.y) || privateAreaAt(b.x, b.y)) return false;
  if (!atDesk(a) || !atDesk(b)) return false;
  return distance(a, b) <= DISCONNECT_DIST * 1.5;
}
