// Controller: handles realtime events from one browser connection.
// It checks rate limits, asks the models to change, and sends the views out.

import type { Server, Socket } from 'socket.io';
import { ACTIONS, REACTIONS } from '../../shared/constants.ts';
import { maySignal } from '../../shared/proximity.ts';
import { cleanSignal } from '../../shared/signal.ts';
import type { ClientToServer, JoinError, Player, RTCIceServerLike, ServerToClient } from '../../shared/types.ts';
import { config } from '../config.ts';
import { iceServersFor } from '../lib/turn.ts';
import type { FileStorage } from '../lib/FileStorage.ts';
import type { IpLimits } from '../middleware/ipLimits.ts';
import { RateLimiter } from '../lib/RateLimiter.ts';
import { applyMove, applyState, createPlayer, parseProfile, uidFromKey } from '../models/Player.ts';
import type { Space } from '../models/Space.ts';
import { SpaceStore } from '../models/SpaceStore.ts';
import { chatView, joinView, noteView, playerView, strokeView } from '../views/spaceView.ts';

export type IO = Server<ClientToServer, ServerToClient>;
type Sock = Socket<ClientToServer, ServerToClient>;

export class SpaceSocketController {
  private readonly io: IO;
  private readonly store: SpaceStore;
  private readonly files: FileStorage;
  private readonly ipLimits: IpLimits;
  private readonly ipOf: (socket: Sock) => string;
  private readonly maxTotalBytes: number;

  constructor(io: IO, store: SpaceStore, files: FileStorage, ipLimits: IpLimits, ipOf: (socket: Sock) => string, maxTotalBytes: number) {
    this.maxTotalBytes = maxTotalBytes;
    this.io = io;
    this.store = store;
    this.files = files;
    this.ipLimits = ipLimits;
    this.ipOf = ipOf;
  }

  attach(): void {
    // Refuse a new connection when one IP already has too many open.
    this.io.use((socket, next) => {
      const ip = this.ipOf(socket);
      if (!this.ipLimits.connect(ip)) return next(new Error('too many connections'));
      socket.once('disconnect', () => this.ipLimits.disconnect(ip));
      next();
    });
    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  private onConnection(socket: Sock): void {
    const io = this.io;
    const store = this.store;
    let space: Space | null = null;
    let me: Player | null = null;

    // Per-connection limits: average events per second, and burst size.
    const limit = {
      move: new RateLimiter(40, 60),
      state: new RateLimiter(5, 20),
      chat: new RateLimiter(1, 5),
      react: new RateLimiter(3, 8),
      signal: new RateLimiter(100, 300),
      intercom: new RateLimiter(0.2, 2),
      profile: new RateLimiter(0.5, 3),
      note: new RateLimiter(0.3, 4),
      file: new RateLimiter(1, 5),
      wb: new RateLimiter(30, 120),
      wbOpen: new RateLimiter(0.3, 3),
      wbClear: new RateLimiter(0.2, 2),
    };

    /** Runs `fn` only if this socket has joined a space and the limiter allows it. */
    const guard = (l: RateLimiter, fn: (space: Space, me: Player) => void) => {
      if (!space || !me || !l.take()) return;
      fn(space, me);
    };

    socket.on('join', (req, ack) => {
      if (typeof ack !== 'function') return;
      const fail = (error: string) => ack({ ok: false, error } satisfies JoinError);
      if (space) return fail('すでに入室しています');
      if (!SpaceStore.isValidId(req?.spaceId)) return fail('スペースIDが正しくありません');
      const profile = parseProfile(req);
      if (!profile) return fail('名前とアバターを確認してください');
      const ip = this.ipOf(socket);
      const s = store.getOrCreate(req.spaceId, () => this.ipLimits.allowNewSpace(ip));
      if (!s) return fail('新しいスペースを作れませんでした（作りすぎか、サーバーの上限です）。時間をおいてお試しください');
      if (s.isFull) return fail('このスペースは満員です');

      me = createPlayer(socket.id, uidFromKey(req.clientKey, socket.id), profile.name, profile.look, s.players.values());
      space = s;
      const tokens = s.add(me);
      void socket.join(s.id);
      socket.to(s.id).emit('player:join', playerView(me));
      ack(joinView(s, me.id, me.uid, tokens, iceServersFor(me.uid, config.iceServers, config.turnUrls, config.turnSecret) as RTCIceServerLike[]));
    });

    socket.on('move', (m) =>
      guard(limit.move, (s, p) => {
        const wasPose = p.pose;
        const wasDancing = p.dancing;
        if (!applyMove(p, m)) return;
        socket.volatile.to(s.id).emit('player:move', { id: p.id, x: p.x, y: p.y, dir: p.dir, moving: p.moving });
        if (wasPose !== p.pose || wasDancing !== p.dancing) io.to(s.id).emit('player:state', { id: p.id, pose: p.pose, dancing: p.dancing });
      }),
    );

    socket.on('state', (patch) =>
      guard(limit.state, (s, p) => {
        const changed = applyState(p, patch);
        if (Object.keys(changed).length > 0) io.to(s.id).emit('player:state', { id: p.id, ...changed });
      }),
    );

    socket.on('profile', (m) =>
      guard(limit.profile, (s, p) => {
        const profile = parseProfile(m);
        if (!profile) return;
        p.name = profile.name;
        p.look = profile.look;
        io.to(s.id).emit('player:profile', { id: p.id, ...profile });
      }),
    );

    socket.on('react', (emoji) =>
      guard(limit.react, (s, p) => {
        if ((REACTIONS as readonly string[]).includes(emoji)) io.to(s.id).emit('react', { id: p.id, emoji });
      }),
    );

    socket.on('action', (kind) =>
      guard(limit.react, (s, p) => {
        if (ACTIONS.includes(kind)) io.to(s.id).emit('action', { id: p.id, kind });
      }),
    );

    socket.on('chat', (m) =>
      guard(limit.chat, (s, p) => {
        const msg = s.postChat(p, m?.channel, m?.text);
        if (!msg) return;
        if (msg.channel === 'space') io.to(s.id).emit('chat', chatView(msg));
        else for (const o of s.nearby(p)) io.to(o.id).emit('chat', chatView(msg));
      }),
    );

    // WebRTC offers/answers/ICE candidates are passed on unchanged, and only
    // between people who are close. Audio and video never go through the server.
    socket.on('signal', (m) =>
      guard(limit.signal, (s, p) => {
        const to = typeof m?.to === 'string' ? m.to : '';
        const target = s.players.get(to);
        if (!target || to === p.id) return;
        const data = cleanSignal(m.data);
        if (!data) return;
        if (data.kind !== 'bye' && !maySignal(p, target)) return;
        io.to(to).emit('signal', { from: p.id, data });
      }),
    );

    socket.on('intercom', (to) =>
      guard(limit.intercom, (s, p) => {
        if (typeof to === 'string' && to !== p.id && s.has(to)) io.to(to).emit('intercom', { from: p.id, name: p.name });
      }),
    );

    socket.on('file:remove', (id) =>
      guard(limit.file, (s, p) => {
        const f = s.removeFile(id, p);
        if (!f) return;
        void this.files.remove(s.id, f.id);
        io.to(s.id).emit('file:remove', f.id);
      }),
    );

    socket.on('note:add', (m) =>
      guard(limit.note, (s, p) => {
        const note = s.addNote(p, m);
        if (note) io.to(s.id).emit('note:add', noteView(note));
      }),
    );

    socket.on('note:remove', (id) =>
      guard(limit.note, (s, p) => {
        if (s.removeNote(id, p)) io.to(s.id).emit('note:remove', String(id));
      }),
    );

    socket.on('wb:open', (board, ack) => {
      if (typeof ack !== 'function') return;
      if (!space || !me || !limit.wbOpen.take() || !space.canUseBoard(me, board)) return ack(null);
      ack(space.strokes(board).map(strokeView));
    });

    socket.on('wb:stroke', (m) =>
      guard(limit.wb, (s, p) => {
        const board = m?.board;
        if (typeof board !== 'string' || !s.canUseBoard(p, board)) return;
        const stroke = s.addStroke(board, p, m.stroke, this.maxTotalBytes);
        if (typeof stroke === 'string') socket.emit('notice', stroke);
        else if (stroke) for (const o of boardUsers(s, board)) io.to(o.id).emit('wb:stroke', { board, stroke: strokeView(stroke) });
      }),
    );

    socket.on('wb:clear', (board) =>
      guard(limit.wbClear, (s, p) => {
        if (typeof board !== 'string' || !s.canUseBoard(p, board)) return;
        s.clearBoard(board);
        for (const o of boardUsers(s, board)) io.to(o.id).emit('wb:clear', { board, by: p.id });
      }),
    );

    socket.on('disconnect', () => {
      if (!space || !me) return;
      space.remove(me.id);
      io.to(space.id).emit('player:leave', me.id);
      if (space.isEmpty) space.boards.clear(); // whiteboards are reloaded from disk next time
      space = null;
      me = null;
    });
  }
}

/** Only people who may use a whiteboard receive its drawing (meeting-room boards stay in the room). */
function boardUsers(s: Space, board: string): Player[] {
  return [...s.players.values()].filter((o) => s.canUseBoard(o, board));
}
