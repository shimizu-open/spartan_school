// Integration test: real server + real Socket.IO clients + HTTP file API.
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { io as connect, type Socket } from 'socket.io-client';
import { DEFAULT_LOOK } from '../shared/avatar.ts';
import { TILE } from '../shared/constants.ts';
import { OBJECTS, areaEntry, collides, nearestFree, privateAreaAt, roomOfObject } from '../shared/map.ts';
import type { ClientToServer, FileMeta, JoinError, JoinResult, ServerToClient, Stroke } from '../shared/types.ts';
import { farPoint } from './helpers.ts';

type Client = Socket<ServerToClient, ClientToServer>;
let url = '';
let close: () => Promise<void>;
let startServer: () => Promise<{ url: string; close: () => Promise<void> }>;
const clients: Client[] = [];
const far = farPoint();

before(async () => {
  process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'pixel-office-test-'));
  process.env.TURN_URLS = 'turn:203.0.113.10:3478?transport=udp';
  process.env.TURN_SECRET = 'test-secret';
  const { createAppServer } = await import('../server/app.ts');
  startServer = async () => {
    const server = await createAppServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    return {
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      close: () => new Promise<void>((r) => {
        server.close(() => r());
        // also end open Socket.IO connections so close() can finish
        (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      }),
    };
  };
  ({ url, close } = await startServer());
});

after(async () => {
  for (const c of clients) c.disconnect();
  await close();
});

function client(at = url): Promise<Client> {
  return new Promise((resolve) => {
    const c: Client = connect(at, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    c.on('connect', () => resolve(c));
  });
}

const newKey = () => randomBytes(24).toString('base64url');

function join(c: Client, spaceId: string, name: string, clientKey = newKey()): Promise<JoinResult | JoinError> {
  return new Promise((r) => c.emit('join', { spaceId, name, look: DEFAULT_LOOK, clientKey }, r));
}

async function pair(spaceId: string): Promise<{ a: Client; b: Client; ra: JoinResult; rb: JoinResult }> {
  const a = await client();
  const b = await client();
  const ra = (await join(a, spaceId, 'A')) as JoinResult;
  const rb = (await join(b, spaceId, 'B')) as JoinResult;
  return { a, b, ra, rb };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upload(spaceId: string, token: string, body: Uint8Array<ArrayBuffer>, name: string, extra = ''): Promise<Response> {
  return fetch(`${url}/api/spaces/${spaceId}/files?name=${encodeURIComponent(name)}${extra}`, {
    method: 'POST',
    headers: { 'X-Upload-Token': token, 'Content-Type': 'application/octet-stream' },
    body,
  });
}

test('rejects bad input when joining', async () => {
  const c = await client();
  assert.equal((await join(c, '../x', 'a')).ok, false);
  assert.equal((await join(c, 'space-1234', '   ')).ok, false);
  const bad = await new Promise<JoinResult | JoinError>((r) => c.emit('join', { spaceId: 'space-1234', name: 'a', look: { skin: 99 } } as never, r));
  assert.equal(bad.ok, false);
});

test('two people meet; names are cleaned; spawn spots differ', async () => {
  const a = await client();
  const b = await client();
  const ra = (await join(a, 'space-meet', '  アリス\u0000  ')) as JoinResult;
  const rb = (await join(b, 'space-meet', 'ボブ')) as JoinResult;
  assert.equal(ra.ok, true);
  assert.equal(typeof ra.uploadToken, 'string');
  assert.equal(rb.players.length, 2);
  const alice = rb.players.find((p) => p.id === ra.selfId)!;
  const bob = rb.players.find((p) => p.id === rb.selfId)!;
  assert.equal(alice.name, 'アリス');
  assert.notDeepEqual([alice.x, alice.y], [bob.x, bob.y]);
});

test('call setup messages only pass between people who are close', async () => {
  const { a, b, rb } = await pair('space-sig');
  const got: unknown[] = [];
  b.on('signal', (m) => got.push(m.data));
  a.emit('signal', { to: rb.selfId, data: { kind: 'offer', sdp: 'x' } });
  await wait(150);
  assert.equal(got.length, 1);
  a.emit('move', { x: far.x, y: far.y, dir: 'up', moving: false });
  await wait(100);
  a.emit('signal', { to: rb.selfId, data: { kind: 'offer', sdp: 'x' } });
  a.emit('signal', { to: rb.selfId, data: { kind: 'bye' } });
  await wait(150);
  assert.deepEqual(got.at(-1), { kind: 'bye' });
  assert.equal(got.length, 2);
});

test('moves into walls are ignored; walking ends sitting', async () => {
  const { a, b, ra } = await pair('space-wall');
  const moves: unknown[] = [];
  const states: unknown[] = [];
  b.on('player:move', (m) => moves.push(m));
  b.on('player:state', (m) => states.push(m));
  a.emit('move', { x: 5, y: 5, dir: 'up', moving: false });
  a.emit('move', { x: Number.NaN, y: 1, dir: 'up', moving: false });
  await wait(150);
  assert.equal(moves.length, 0);
  a.emit('state', { pose: 'sit', status: 'focus', item: '☕' });
  a.emit('state', { status: 'sleeping', item: '<script>' } as never);
  await wait(100);
  assert.deepEqual(states.at(-1), { id: ra.selfId, status: 'focus', pose: 'sit', item: '☕' });
  assert.equal(states.length, 1);
  const p = ra.players.find((x) => x.id === ra.selfId)!;
  a.emit('move', { x: p.x, y: p.y, dir: 'down', moving: true });
  await wait(100);
  assert.deepEqual(states.at(-1), { id: ra.selfId, pose: 'stand', dancing: false });
});

test('chat is rate limited, nearby chat stays nearby, commands roll on the server', async () => {
  const { a, b } = await pair('space-chat');
  const seen: { channel: string; text: string; kind: string }[] = [];
  b.on('chat', (m) => seen.push(m));
  for (let i = 0; i < 8; i++) a.emit('chat', { channel: 'space', text: `m${i}` });
  await wait(200);
  assert.equal(seen.filter((s) => s.channel === 'space').length, 5);
  await wait(1100);
  a.emit('chat', { channel: 'space', text: '/dice' });
  await wait(100);
  assert.equal(seen.at(-1)?.kind, 'roll');
  assert.match(seen.at(-1)!.text, /🎲 サイコロ（6面）：[1-6]$/);
  a.emit('move', { x: far.x, y: far.y, dir: 'up', moving: false });
  await wait(100);
  a.emit('chat', { channel: 'nearby', text: 'secret' });
  await wait(150);
  assert.equal(seen.some((s) => s.text === 'secret'), false);
});

test('files: only members upload/download; images are detected by content; owner deletes', async () => {
  const { a, b, ra, rb } = await pair('space-files');
  const added: FileMeta[] = [];
  const chats: { kind: string; file?: FileMeta }[] = [];
  b.on('file:add', (f) => added.push(f));
  b.on('chat', (m) => chats.push(m));
  // not a member
  assert.equal((await upload('space-files', 'nope', new Uint8Array([1, 2, 3]), 'x.txt')).status, 403);
  // PNG by magic bytes, even with a misleading name
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const r1 = await upload('space-files', ra.uploadToken, png, 'photo.txt');
  assert.equal(r1.status, 201);
  const img = (await r1.json()) as FileMeta;
  assert.equal(img.image, true);
  // SVG is never inline
  const svg = new Uint8Array(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  const svgMeta = (await (await upload('space-files', ra.uploadToken, svg, 'evil.svg')).json()) as FileMeta;
  assert.equal(svgMeta.image, false);
  await wait(150);
  assert.equal(added.length, 2);
  assert.equal(chats.filter((c) => c.kind === 'file').length, 2);

  const dl = await fetch(`${url}/api/spaces/space-files/files/${svgMeta.id}?t=${rb.downloadToken}`);
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
  assert.match(dl.headers.get('content-disposition') ?? '', /^attachment/);
  assert.match(dl.headers.get('content-security-policy') ?? '', /sandbox/);
  const im = await fetch(`${url}/api/spaces/space-files/files/${img.id}?t=${rb.downloadToken}`);
  assert.equal(im.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(`${url}/api/spaces/space-files/files/${img.id}?t=wrong`)).status, 404);

  // placing on the map: only near yourself
  const me = ra.players.find((p) => p.id === ra.selfId)!;
  assert.equal((await upload('space-files', ra.uploadToken, png, 'map.png', `&to=map&x=${me.x}&y=${me.y + 20}`)).status, 201);
  assert.equal((await upload('space-files', ra.uploadToken, png, 'far.png', `&to=map&x=${far.x}&y=${far.y}`)).status, 400);

  const removed: string[] = [];
  b.on('file:remove', (id) => removed.push(id));
  b.emit('file:remove', img.id); // not the owner
  await wait(100);
  assert.equal(removed.length, 0);
  a.emit('file:remove', img.id);
  await wait(100);
  assert.deepEqual(removed, [img.id]);
  assert.equal((await fetch(`${url}/api/spaces/space-files/files/${img.id}?t=${rb.downloadToken}`)).status, 404);
});

test('files: the download token cannot upload, the upload token cannot download', async () => {
  const a = await client();
  const ra = (await join(a, 'space-tokens', 'A')) as JoinResult;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  assert.equal((await upload('space-tokens', ra.downloadToken, png, 'x.png')).status, 403);
  const f = (await (await upload('space-tokens', ra.uploadToken, png, 'x.png')).json()) as FileMeta;
  assert.equal((await fetch(`${url}/api/spaces/space-tokens/files/${f.id}?t=${ra.uploadToken}`)).status, 404);
  assert.equal((await fetch(`${url}/api/spaces/space-tokens/files/${f.id}?t=${ra.downloadToken}`)).status, 200);
});

test('files sent to "nearby" are only for the people who were near', async () => {
  const { a, b, ra } = await pair('space-nearfile');
  const c = await client();
  const rc = (await join(c, 'space-nearfile', 'C')) as JoinResult;
  b.emit('move', { x: far.x, y: far.y, dir: 'up', moving: false }); // B walks away; A and C stay at the entrance
  await wait(100);
  const seenB: FileMeta[] = [];
  const seenC: FileMeta[] = [];
  b.on('file:add', (f) => seenB.push(f));
  c.on('file:add', (f) => seenC.push(f));
  const f = (await (await upload('space-nearfile', ra.uploadToken, new Uint8Array([1, 2, 3]), 'secret.txt', '&to=nearby')).json()) as FileMeta;
  await wait(150);
  assert.equal(seenC.length, 1, 'C (near) sees it');
  assert.equal(seenB.length, 0, 'B (far) does not');
  const rb2 = (await join(await client(), 'space-nearfile', 'B2')) as JoinResult;
  assert.equal(rb2.files.some((x) => x.id === f.id), false, 'not listed for others who join later');
  assert.equal((await fetch(`${url}/api/spaces/space-nearfile/files/${f.id}?t=${rb2.downloadToken}`)).status, 404);
  assert.equal((await fetch(`${url}/api/spaces/space-nearfile/files/${f.id}?t=${rc.downloadToken}`)).status, 200);
  void a;
});

test('files larger than 20 MB are refused', async () => {
  const a = await client();
  const ra = (await join(a, 'space-big', 'A')) as JoinResult;
  const res = await upload('space-big', ra.uploadToken, new Uint8Array(20 * 1024 * 1024 + 1), 'big.bin');
  assert.equal(res.status, 413);
});

test('sticky notes: near yourself only, author removes', async () => {
  const { a, b, ra } = await pair('space-notes');
  const notes: { id: string; text: string }[] = [];
  const gone: string[] = [];
  b.on('note:add', (n) => notes.push(n));
  b.on('note:remove', (id) => gone.push(id));
  const me = ra.players.find((p) => p.id === ra.selfId)!;
  a.emit('note:add', { x: me.x, y: me.y + 10, text: '  ランチ🍛  ', color: 2 });
  a.emit('note:add', { x: far.x, y: far.y, text: 'far', color: 0 });
  await wait(150);
  assert.equal(notes.length, 1);
  assert.equal(notes[0]!.text, 'ランチ🍛');
  b.emit('note:remove', notes[0]!.id);
  await wait(100);
  assert.equal(gone.length, 0);
  a.emit('note:remove', notes[0]!.id);
  await wait(100);
  assert.deepEqual(gone, [notes[0]!.id]);
});

test('whiteboard: only near the board; strokes are validated and shared', async () => {
  const { a, b } = await pair('space-wb');
  const board = OBJECTS.find((o) => o.kind === 'whiteboard')!;
  const open = (c: Client) => new Promise<Stroke[] | null>((r) => c.emit('wb:open', board.id, r));
  a.emit('move', { x: far.x, y: far.y, dir: 'up', moving: false });
  await wait(80);
  assert.equal(await open(a), null);
  const spot = nearestFree((board.tx + board.w / 2) * TILE, (board.ty + board.h + 1) * TILE);
  a.emit('move', { x: spot.x, y: spot.y, dir: 'up', moving: false });
  b.emit('move', { x: spot.x, y: spot.y, dir: 'up', moving: false });
  await wait(80);
  assert.deepEqual(await open(a), []);
  const got: Stroke[] = [];
  b.on('wb:stroke', (m) => got.push(m.stroke));
  a.emit('wb:stroke', { board: board.id, stroke: { color: 1, width: 6, points: [0.1, 0.1, 0.5, 0.5] } });
  a.emit('wb:stroke', { board: board.id, stroke: { color: 99, width: 6, points: [0.1, 0.1, 0.5, 0.5] } });
  a.emit('wb:stroke', { board: board.id, stroke: { color: 1, width: 6, points: [0.1, 0.1, 5, 0.5] } });
  await wait(150);
  assert.equal(got.length, 1);
  assert.equal((await open(b))?.length, 1);
});

test('spaces are saved: chat, notes, files and whiteboards survive a server restart', async () => {
  const key = newKey();
  const a = await client();
  const ra = (await join(a, 'space-keep', 'A', key)) as JoinResult;
  const me = ra.players.find((p) => p.id === ra.selfId)!;
  a.emit('chat', { channel: 'space', text: '残ってね' });
  a.emit('chat', { channel: 'nearby', text: '近くの人だけ（保存しない）' });
  a.emit('note:add', { x: me.x, y: me.y + 10, text: 'メモ', color: 1 });
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const file = (await (await upload('space-keep', ra.uploadToken, png, 'keep.png')).json()) as FileMeta;
  const board = OBJECTS.find((o) => o.kind === 'whiteboard')!;
  const spot = nearestFree((board.tx + board.w / 2) * TILE, (board.ty + board.h + 1) * TILE);
  a.emit('move', { x: spot.x, y: spot.y, dir: 'up', moving: false });
  await wait(80);
  await new Promise((r) => a.emit('wb:open', board.id, r));
  a.emit('wb:stroke', { board: board.id, stroke: { color: 2, width: 6, points: [0.2, 0.2, 0.3, 0.3] } });
  await wait(150);
  a.disconnect();

  // a brand-new server process reading the same data folder
  const second = await startServer();
  try {
    const b = await client(second.url);
    const rb = (await join(b, 'space-keep', 'A again', key)) as JoinResult;
    assert.equal(rb.selfUid, ra.selfUid, 'same browser key -> same uid');
    assert.deepEqual(rb.chat.map((m) => m.text).filter(Boolean), ['残ってね']);
    assert.equal(rb.chat.find((m) => m.kind === 'file')?.file?.id, file.id);
    assert.equal(rb.notes.length, 1);
    assert.equal(rb.files[0]?.id, file.id);
    const dl = await fetch(`${second.url}/api/spaces/space-keep/files/${file.id}?t=${rb.downloadToken}`);
    assert.equal(dl.status, 200);
    assert.deepEqual(new Uint8Array(await dl.arrayBuffer()), png);
    b.emit('move', { x: spot.x, y: spot.y, dir: 'up', moving: false });
    await wait(80);
    const strokes = await new Promise<Stroke[] | null>((r) => b.emit('wb:open', board.id, r));
    assert.equal(strokes?.length, 1);
    // someone else (another browser key) cannot peel my note; I still can on a new visit
    const other = await client(second.url);
    await join(other, 'space-keep', 'B');
    const gone: string[] = [];
    b.on('note:remove', (id) => gone.push(id));
    other.emit('note:remove', rb.notes[0]!.id);
    await wait(100);
    assert.equal(gone.length, 0);
    b.emit('note:remove', rb.notes[0]!.id);
    await wait(100);
    assert.equal(gone.length, 1);
    b.disconnect();
    other.disconnect();
  } finally {
    await second.close();
  }
});

test('TURN: only members get a temporary password made from the shared secret', async () => {
  const a = await client();
  const ra = (await join(a, 'space-turn', 'A')) as JoinResult;
  const turn = ra.iceServers.find((s) => String(s.urls).startsWith('turn:'))!;
  assert.ok(turn, 'a TURN entry is given after joining');
  const [expiry, uid] = turn.username!.split(':');
  assert.equal(uid, ra.selfUid);
  assert.ok(Number(expiry) > Date.now() / 1000 + 11 * 3600, 'valid for about 12 hours');
  assert.equal(turn.credential, createHmac('sha1', 'test-secret').update(turn.username!).digest('base64'));
});

test('signals: junk is dropped and only clean fields are relayed', async () => {
  const { a, b, rb } = await pair('space-junk');
  const got: unknown[] = [];
  b.on('signal', (m) => got.push(m.data));
  a.emit('signal', { to: rb.selfId, data: { kind: 'offer', sdp: 'x'.repeat(30_000) } });
  a.emit('signal', { to: rb.selfId, data: { kind: 'evil', x: 1 } });
  a.emit('signal', { to: rb.selfId, data: { kind: 'ice', candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0, extra: 'no' } } });
  await wait(150);
  assert.deepEqual(got, [{ kind: 'ice', candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 } }]);
});

test('meeting-room whiteboards can only be used from inside the room', async () => {
  const a = await client();
  await join(a, 'space-roomwb', 'A');
  const board = OBJECTS.find((o) => o.id === 'wb-roomC')!;
  const room = roomOfObject(board)!;
  // the closest walkable spot outside the room, near the board
  let outside: { x: number; y: number } | null = null;
  for (let r = 1; r < 8 && !outside; r++)
    for (let dx = -r; dx <= r && !outside; dx++)
      for (const dy of [-r, r]) {
        const p = { x: (board.tx + 1 + dx) * TILE + 16, y: (board.ty + dy) * TILE + 28 };
        if (!collides(p.x, p.y) && privateAreaAt(p.x, p.y)?.id !== room.id && Math.hypot(p.x - (board.tx + 1.5) * TILE, p.y - board.ty * TILE) < TILE * 5) {
          outside = p;
          break;
        }
      }
  assert.ok(outside, 'found a hallway spot near the board');
  a.emit('move', { x: outside.x, y: outside.y, dir: 'up', moving: false });
  await wait(80);
  assert.equal(await new Promise((r) => a.emit('wb:open', board.id, r)), null);
  const inRoom = areaEntry(room);
  a.emit('move', { x: inRoom.x, y: inRoom.y, dir: 'up', moving: false });
  await wait(80);
  assert.deepEqual(await new Promise((r) => a.emit('wb:open', board.id, r)), []);
  // someone in the hallway does not receive what is drawn inside the room
  const spy = await client();
  await join(spy, 'space-roomwb', 'Spy');
  spy.emit('move', { x: outside.x, y: outside.y, dir: 'up', moving: false });
  await wait(80);
  const leaked: unknown[] = [];
  spy.on('wb:stroke', (m) => leaked.push(m));
  spy.on('wb:clear', (m) => leaked.push(m));
  a.emit('wb:stroke', { board: board.id, stroke: { color: 0, width: 3, points: [0.1, 0.1, 0.2, 0.2] } });
  a.emit('wb:clear', board.id);
  await wait(150);
  assert.deepEqual(leaked, []);
});

test('HTTP: health and security headers', async () => {
  const res = await fetch(`${url}/healthz`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  // ICE/TURN settings are no longer handed out before joining
  assert.equal((await fetch(`${url}/api/config`)).status, 404);
});

test('Socket.IO refuses connections from other websites', async () => {
  const res = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, { headers: { origin: 'https://evil.example' } });
  assert.notEqual(res.status, 200);
});
