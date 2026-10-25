import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LOOK, LOOK_SIZES, randomLook, sanitizeLook } from '../shared/avatar.ts';
import { CONNECT_DIST, DISCONNECT_DIST, HEAR_FULL, HEAR_MAX } from '../shared/constants.ts';
import { AREAS, MAP, MAP_H, MAP_W, OBJECTS, SPAWN, areaEntry, collides, nearestFree, objectNear, occupiedBy, seatAt } from '../shared/map.ts';
import { findPath } from '../shared/path.ts';
import { maySignal, shouldConnect, volumeBetween } from '../shared/proximity.ts';
import type { Status } from '../shared/types.ts';
import { farPoint, inside } from './helpers.ts';

const at = (p: { x: number; y: number }, extra: Partial<{ status: Status; megaphone: boolean }> = {}) => ({
  x: p.x,
  y: p.y,
  status: 'present' as Status,
  megaphone: false,
  ...extra,
});
const far = farPoint();
const base = at(far);

test('map has the declared size and a free spawn point', () => {
  assert.equal(MAP.length, MAP_H);
  for (const row of MAP) assert.equal(row.length, MAP_W);
  assert.equal(collides(SPAWN.x, SPAWN.y), false);
});

test('required areas and objects exist', () => {
  for (const id of ['lobby', 'roomA', 'roomB', 'roomC', 'office', 'library', 'hall', 'stage', 'cafe', 'garden']) {
    assert.ok(AREAS.some((a) => a.id === id), id);
  }
  assert.ok(AREAS.find((a) => a.id === 'library')?.quiet);
  assert.equal(AREAS.find((a) => a.id === 'stage')?.audience, 'hall');
  for (const k of ['whiteboard', 'vending', 'photo']) assert.ok(OBJECTS.some((o) => o.kind === k), k);
});

test('every area entry is walkable and reachable from the spawn point', () => {
  for (const a of AREAS) {
    const p = areaEntry(a);
    assert.equal(collides(p.x, p.y), false, a.id);
    assert.ok(findPath(SPAWN, p), `path to ${a.id}`);
  }
});

test('objects can be used from a reachable spot, and seats work', () => {
  for (const o of OBJECTS) {
    let ok = false;
    for (let dy = -1; dy <= o.h && !ok; dy++)
      for (let dx = -1; dx <= o.w && !ok; dx++) {
        const p = { x: (o.tx + dx) * 32 + 16, y: (o.ty + dy) * 32 + 28 };
        if (!collides(p.x, p.y) && findPath(SPAWN, p) && objectNear(p.x, p.y)?.id === o.id) ok = true;
      }
    assert.ok(ok, `object ${o.id} usable`);
  }
  const office = inside('office');
  let seat = null;
  for (let r = 0; r < 12 && !seat; r++) seat = seatAt(office.x + r * 32, office.y) ?? seatAt(office.x, office.y + r * 32);
  assert.ok(seat, 'a seat near the office');
  assert.equal(collides(seat.x, seat.y), false);
});

test('calls open when close and close only after the larger distance', () => {
  assert.equal(shouldConnect(base, at({ x: base.x, y: base.y - CONNECT_DIST + 1 }), false), true);
  assert.equal(shouldConnect(base, at({ x: base.x, y: base.y - CONNECT_DIST - 1 }), false), false);
  assert.equal(shouldConnect(base, at({ x: base.x, y: base.y - DISCONNECT_DIST + 1 }), true), true);
  assert.equal(shouldConnect(base, at({ x: base.x, y: base.y - DISCONNECT_DIST - 1 }), true), false);
});

test('volume fades with distance', () => {
  assert.equal(volumeBetween(base, at({ x: base.x + HEAR_FULL, y: base.y })), 1);
  assert.equal(volumeBetween(base, at({ x: base.x + HEAR_MAX, y: base.y })), 0);
  const mid = volumeBetween(base, at({ x: base.x + (HEAR_FULL + HEAR_MAX) / 2, y: base.y }));
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('meeting rooms are private', () => {
  const a = at(inside('roomA'));
  const b = at(inside('roomA', 3, 2));
  const out = at(farPoint());
  assert.equal(shouldConnect(a, b, false), true);
  assert.equal(volumeBetween(a, b), 1);
  assert.equal(shouldConnect(a, out, false), false);
  assert.equal(maySignal(a, out), false);
  // focus mode still talks inside a room
  assert.equal(shouldConnect(at(a, { status: 'focus' }), b, false), true);
});

test('library is quiet, stage reaches the hall', () => {
  const l1 = at(inside('library'));
  const l2 = at({ x: l1.x + 20, y: l1.y });
  assert.equal(shouldConnect(l1, l2, false), false);
  const singer = at(inside('stage'));
  const fan = at(inside('hall', 2, 2));
  assert.equal(shouldConnect(singer, fan, false), true);
  assert.equal(volumeBetween(fan, singer), 1);
});

test('away and focus statuses; megaphone reaches the floor', () => {
  const near = at({ x: base.x + 10, y: base.y });
  assert.equal(shouldConnect(base, { ...near, status: 'away' }, false), false);
  assert.equal(shouldConnect(base, { ...near, status: 'lunch' }, false), false);
  assert.equal(shouldConnect(base, { ...near, status: 'focus' }, false), false);
  assert.equal(shouldConnect(base, { ...near, status: 'meeting' }, false), true);
  const loud = at(SPAWN, { megaphone: true });
  assert.equal(shouldConnect(base, loud, false), true);
  assert.equal(volumeBetween(base, loud), 1);
});

test('broadcasts are one-way: far listeners do not send their media back', () => {
  // "how loud B sounds to A" decides whether B sends media to A
  const speaker = at(SPAWN, { megaphone: true });
  const listener = at(far);
  assert.equal(volumeBetween(listener, speaker), 1, 'listener hears the megaphone');
  assert.equal(volumeBetween(speaker, listener), 0, 'the megaphone user does not get the listener');
  const singer = at(inside('stage'));
  const fan = at(inside('hall', 2, 2));
  assert.equal(volumeBetween(fan, singer), 1);
  assert.equal(volumeBetween(singer, fan), 0, 'the stage does not get the audience');
});

test('nearestFree avoids walls and people', () => {
  const p = nearestFree(SPAWN.x, SPAWN.y, occupiedBy([SPAWN]));
  assert.equal(collides(p.x, p.y), false);
  assert.notDeepEqual(p, SPAWN);
});

test('avatar looks are validated', () => {
  assert.deepEqual(sanitizeLook({}), DEFAULT_LOOK);
  assert.equal(sanitizeLook({ skin: 999 }), null);
  assert.equal(sanitizeLook({ pet: -1 }), null);
  assert.equal(sanitizeLook('x'), null);
  for (let i = 0; i < 50; i++) assert.ok(sanitizeLook(randomLook()));
  const combos = Object.values(LOOK_SIZES).reduce((a, b) => a * b, 1);
  assert.ok(combos > 1000, `combinations: ${combos}`);
});
