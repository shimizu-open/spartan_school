import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpaceRepository } from '../server/models/SpaceRepository.ts';
import { SpaceStore } from '../server/models/SpaceStore.ts';

const DAY = 24 * 60 * 60 * 1000;

test('spaces stay on disk after people leave, and leave memory later', () => {
  const repo = new SpaceRepository(':memory:');
  const store = new SpaceStore(repo, { maxStoredSpaces: 10, retentionDays: 0, unloadAfterMs: 1000 });
  const s = store.getOrCreate('room-1')!;
  const p = { id: 'p1', uid: 'u1', name: 'A', x: 0, y: 0 } as never;
  s.add(p);
  s.postChat(p, 'space', 'hello');
  s.remove('p1');
  store.sweep(Date.now() + 2000);
  assert.equal(store.get('room-1'), null, 'unloaded from memory');
  assert.equal(repo.exists('room-1'), true, 'still on disk');
  store.sweep(Date.now() + 1000 * DAY);
  assert.equal(repo.exists('room-1'), true, 'kept forever without a retention period');
});

test('with a retention period, long-unused spaces are deleted (with their files)', () => {
  const repo = new SpaceRepository(':memory:');
  const store = new SpaceStore(repo, { maxStoredSpaces: 10, retentionDays: 30, unloadAfterMs: 0 });
  const deleted: string[] = [];
  store.onDelete = (id) => deleted.push(id);
  const who = { id: 'p', uid: 'u', name: 'A', x: 0, y: 0 } as never;
  store.getOrCreate('old-room')!.postChat(who, 'space', 'x');
  repo.touch('old-room', Date.now() - 31 * DAY);
  store.getOrCreate('new-room')!.postChat(who, 'space', 'y');
  store.sweep(Date.now());
  assert.deepEqual(deleted, ['old-room']);
  assert.equal(repo.exists('old-room'), false);
  assert.equal(repo.exists('new-room'), true);
});

test('empty spaces are not saved', () => {
  const repo = new SpaceRepository(':memory:');
  const store = new SpaceStore(repo, { maxStoredSpaces: 10, retentionDays: 0, unloadAfterMs: 0 });
  const s = store.getOrCreate('just-looking')!;
  s.add({ id: 'p', uid: 'u', name: 'A', x: 0, y: 0 } as never);
  s.remove('p');
  store.sweep(Date.now() + 1);
  assert.equal(repo.exists('just-looking'), false);
  assert.equal(repo.count(), 0);
});

test('the number of stored spaces is capped', () => {
  const repo = new SpaceRepository(':memory:');
  const store = new SpaceStore(repo, { maxStoredSpaces: 2, retentionDays: 0, unloadAfterMs: 0 });
  const who = { id: 'p', uid: 'u', name: 'A', x: 0, y: 0 } as never;
  store.getOrCreate('aaaa')!.postChat(who, 'space', 'x');
  store.getOrCreate('bbbb')!.postChat(who, 'space', 'x');
  assert.equal(store.getOrCreate('cccc'), null);
  assert.ok(store.getOrCreate('aaaa'), 'existing spaces still open');
});

import { IpLimits, clientIp, limitKey } from '../server/middleware/ipLimits.ts';
import { hasOriginSecret } from '../server/middleware/originSecret.ts';

test('per-IP limits: open connections and new spaces per hour', () => {
  const l = new IpLimits(2, 3);
  assert.equal(l.connect('1.1.1.1'), true);
  assert.equal(l.connect('1.1.1.1'), true);
  assert.equal(l.connect('1.1.1.1'), false);
  assert.equal(l.connect('2.2.2.2'), true, 'other IPs are not affected');
  l.disconnect('1.1.1.1');
  assert.equal(l.connect('1.1.1.1'), true);
  const t = Date.now();
  assert.deepEqual([1, 2, 3, 4].map(() => l.allowNewSpace('1.1.1.1', t)), [true, true, true, false]);
  assert.equal(l.allowNewSpace('1.1.1.1', t + 61 * 60 * 1000), true, 'allowed again after an hour');
});

test('client IP: only the address added by the proxy is trusted', () => {
  const h = { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' };
  assert.equal(clientIp(h, '10.0.0.5', true), '203.0.113.9');
  assert.equal(clientIp(h, '10.0.0.5', false), '10.0.0.5');
  assert.equal(clientIp({}, '10.0.0.5', true), '10.0.0.5');
});

test('IPv6 is limited per /64, IPv4-mapped addresses as IPv4', () => {
  assert.equal(limitKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(limitKey('2001:db8:1:2:ffff:ffff:ffff:fffe'), '2001:db8:1:2::/64');
  assert.equal(limitKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(limitKey('::ffff:203.0.113.5'), '203.0.113.5');
  assert.equal(limitKey('203.0.113.5'), '203.0.113.5');
});

test('origin secret header: required only when configured', () => {
  const req = (h: Record<string, string>) => ({ headers: h }) as never;
  assert.equal(hasOriginSecret(req({}), ''), true);
  assert.equal(hasOriginSecret(req({}), 's3cret'), false);
  assert.equal(hasOriginSecret(req({ 'x-origin-secret': 'wrong!' }), 's3cret'), false);
  assert.equal(hasOriginSecret(req({ 'x-origin-secret': 's3cret' }), 's3cret'), true);
});
