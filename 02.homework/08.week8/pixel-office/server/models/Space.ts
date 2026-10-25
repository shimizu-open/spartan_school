// Model: one space (a map with the people in it, chat log, files, sticky notes
// and whiteboards). Kept in memory while in use; every change is also written
// to disk through SpaceRepository, so nothing is lost when the room empties.
// Ownership ("only the author can remove") uses the stable uid, not the connection id.

import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  CHAT_HISTORY,
  HEAR_MAX,
  MAX_CHAT,
  MAX_FILES_PER_SPACE,
  MAX_NOTE_TEXT,
  MAX_NOTES_PER_SPACE,
  MAX_PLAYERS_PER_SPACE,
  MAX_SPACE_BYTES,
  NOTE_COLORS,
  TILE,
  WB_COLORS,
  WB_MAX_BYTES_PER_SPACE,
  WB_MAX_POINTS,
  WB_MAX_STROKES,
  cleanMultiline,
} from '../../shared/constants.ts';
import { MAP_H, MAP_W, OBJECTS, privateAreaAt, roomOfObject } from '../../shared/map.ts';
import { distance } from '../../shared/proximity.ts';
import type { ChatChannel, ChatMessage, FileMeta, Note, Player, Stroke } from '../../shared/types.ts';
import type { SpaceRepository, StoredSpace } from './SpaceRepository.ts';

export class Space {
  readonly id: string;
  readonly players = new Map<string, Player>();
  readonly chat: ChatMessage[];
  readonly files: FileMeta[];
  readonly notes: Note[];
  /** Whiteboards are loaded from disk the first time someone opens them. */
  readonly boards = new Map<string, Stroke[]>();
  private readonly repo: SpaceRepository;
  /** token -> player id, for people in the space right now. Upload and download tokens are separate. */
  private readonly tokens = { upload: new Map<string, string>(), download: new Map<string, string>() };
  /** False until something is written: an empty, never-used space is not saved at all. */
  private saved: boolean;
  private bytes = 0;
  /** Saved whiteboard bytes of this space (read from disk the first time it is needed). */
  private boardBytes: number | null = null;
  /** When the last person left (null while someone is here). */
  emptySince: number | null = null;

  constructor(id: string, repo: SpaceRepository, stored: StoredSpace, saved: boolean) {
    this.id = id;
    this.repo = repo;
    this.saved = saved;
    this.chat = stored.chat;
    this.files = stored.files;
    this.notes = stored.notes;
    this.bytes = this.files.reduce((n, f) => n + f.size, 0);
  }

  get isFull(): boolean {
    return this.players.size >= MAX_PLAYERS_PER_SPACE;
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  get isSaved(): boolean {
    return this.saved;
  }

  /** Writes the space row the first time it gets content. */
  private persist(): void {
    if (this.saved) return;
    this.repo.create(this.id);
    this.saved = true;
  }

  /** Adds a person and returns their upload and download tokens. */
  add(p: Player): { upload: string; download: string } {
    this.players.set(p.id, p);
    this.emptySince = null;
    if (this.saved) this.repo.touch(this.id);
    const upload = randomBytes(24).toString('base64url');
    const download = randomBytes(24).toString('base64url');
    this.tokens.upload.set(upload, p.id);
    this.tokens.download.set(download, p.id);
    return { upload, download };
  }

  remove(id: string): void {
    this.players.delete(id);
    for (const map of [this.tokens.upload, this.tokens.download]) for (const [t, pid] of map) if (pid === id) map.delete(t);
    if (this.isEmpty) {
      this.emptySince = Date.now();
      if (this.saved) this.repo.touch(this.id);
    }
  }

  has(id: string): boolean {
    return this.players.has(id);
  }

  /** Who owns a token (null if it is not valid in this space). */
  playerByToken(token: unknown, kind: 'upload' | 'download'): Player | null {
    if (typeof token !== 'string' || token.length > 64) return null;
    const id = this.tokens[kind].get(token);
    return id ? (this.players.get(id) ?? null) : null;
  }

  /** Files this person may see (files sent to "nearby" are only for the people who were near). */
  filesFor(uid: string): FileMeta[] {
    return this.files.filter((f) => !f.audience || f.audience.includes(uid));
  }

  mayRead(f: FileMeta, uid: string): boolean {
    return !f.audience || f.audience.includes(uid);
  }

  // ---- chat ----------------------------------------------------------------

  /** Creates a chat message. Space-wide messages are kept in the log. Returns null if empty. */
  postChat(from: Player, channel: unknown, text: unknown): ChatMessage | null {
    const clean = cleanMultiline(text, MAX_CHAT);
    if (!clean) return null;
    const ch: ChatChannel = channel === 'nearby' ? 'nearby' : 'space';
    const command = runCommand(clean);
    const msg: ChatMessage = {
      id: randomUUID(),
      channel: ch,
      from: from.id,
      uid: from.uid,
      name: from.name,
      text: command ?? clean,
      at: Date.now(),
      kind: command ? 'roll' : 'text',
    };
    this.keep(msg);
    return msg;
  }

  /** A chat message that announces a shared file. */
  postFile(from: Player, channel: ChatChannel, file: FileMeta): ChatMessage {
    const msg: ChatMessage = { id: randomUUID(), channel, from: from.id, uid: from.uid, name: from.name, text: '', at: Date.now(), kind: 'file', file };
    this.keep(msg);
    return msg;
  }

  /** "#みんな" messages are kept (and saved); "nearby" ones are not. */
  private keep(msg: ChatMessage): void {
    if (msg.channel !== 'space') return;
    this.chat.push(msg);
    if (this.chat.length > CHAT_HISTORY) this.chat.shift();
    this.persist();
    this.repo.addChat(this.id, msg);
  }

  /** People who should see a "nearby" message from p: same meeting room, or close by. */
  nearby(p: Player): Player[] {
    const myRoom = privateAreaAt(p.x, p.y)?.id;
    return [...this.players.values()].filter((o) => {
      const room = privateAreaAt(o.x, o.y)?.id;
      return myRoom || room ? myRoom === room : distance(p, o) <= HEAR_MAX * 1.5;
    });
  }

  // ---- files ---------------------------------------------------------------

  /** Checks the space limits before accepting an upload of `size` bytes. */
  canStore(size: number): string | null {
    if (this.files.length >= MAX_FILES_PER_SPACE) return `このスペースのファイルは${MAX_FILES_PER_SPACE}個までです`;
    if (this.bytes + size > MAX_SPACE_BYTES) return 'このスペースの保存容量がいっぱいです';
    return null;
  }

  addFile(f: FileMeta): void {
    this.files.push(f);
    this.bytes += f.size;
    this.persist();
    this.repo.addFile(this.id, f);
  }

  /** Only the person who uploaded a file can delete it. */
  removeFile(id: unknown, by: Player): FileMeta | null {
    const i = this.files.findIndex((f) => f.id === id);
    if (i < 0 || this.files[i]!.by !== by.uid) return null;
    const [f] = this.files.splice(i, 1);
    this.bytes -= f!.size;
    this.repo.removeFile(this.id, f!.id);
    return f!;
  }

  file(id: unknown): FileMeta | null {
    return this.files.find((f) => f.id === id) ?? null;
  }

  // ---- sticky notes ----------------------------------------------------------

  addNote(by: Player, raw: unknown): Note | null {
    if (!raw || typeof raw !== 'object' || this.notes.length >= MAX_NOTES_PER_SPACE) return null;
    const o = raw as Record<string, unknown>;
    const text = cleanMultiline(o.text, MAX_NOTE_TEXT);
    const x = Number(o.x);
    const y = Number(o.y);
    const color = Number(o.color);
    if (!text || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || y < 0 || x > MAP_W * TILE || y > MAP_H * TILE) return null;
    // a note can only be stuck close to where you stand
    if (Math.hypot(x - by.x, y - by.y) > TILE * 3) return null;
    const note: Note = {
      id: randomUUID(),
      x: Math.round(x),
      y: Math.round(y),
      text,
      color: Number.isInteger(color) && color >= 0 && color < NOTE_COLORS.length ? color : 0,
      by: by.uid,
      byName: by.name,
      at: Date.now(),
    };
    this.notes.push(note);
    this.persist();
    this.repo.addNote(this.id, note);
    return note;
  }

  /** Notes can be removed by their author. */
  removeNote(id: unknown, by: Player): boolean {
    const i = this.notes.findIndex((n) => n.id === id);
    if (i < 0 || this.notes[i]!.by !== by.uid) return false;
    const [n] = this.notes.splice(i, 1);
    this.repo.removeNote(this.id, n!.id);
    return true;
  }

  // ---- whiteboards -----------------------------------------------------------

  /** True if p is close enough to use the whiteboard `board` (or in the same meeting room). */
  canUseBoard(p: Player, board: unknown): boolean {
    const obj = OBJECTS.find((o) => o.id === board && o.kind === 'whiteboard');
    if (!obj) return false;
    // A meeting-room board: only people inside that room (it is private, like the voices).
    const room = roomOfObject(obj);
    if (room) return privateAreaAt(p.x, p.y)?.id === room.id;
    const cx = (obj.tx + obj.w / 2) * TILE;
    const cy = (obj.ty + obj.h / 2) * TILE;
    return Math.hypot(p.x - cx, p.y - cy) <= TILE * 5;
  }

  strokes(board: string): Stroke[] {
    let s = this.boards.get(board);
    if (!s) this.boards.set(board, (s = this.saved ? this.repo.strokes(this.id, board) : []));
    return s;
  }

  /** Why a stroke cannot be saved right now, or null if it can. */
  boardFull(bytes: number, maxTotalBytes: number): string | null {
    this.boardBytes ??= this.saved ? this.repo.strokeBytes(this.id) : 0;
    if (this.boardBytes + bytes > WB_MAX_BYTES_PER_SPACE) return 'ホワイトボードがいっぱいです。「全部消す」で空けてください';
    if (this.repo.totalBytes() + bytes > maxTotalBytes) return 'サーバーの保存容量がいっぱいです';
    return null;
  }

  addStroke(board: string, by: Player, raw: unknown, maxTotalBytes = Infinity): Stroke | string | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const color = Number(o.color);
    const width = Number(o.width);
    if (!Number.isInteger(color) || color < 0 || color >= WB_COLORS.length) return null;
    if (!Number.isFinite(width) || width < 1 || width > 40) return null;
    if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > WB_MAX_POINTS || o.points.length % 2) return null;
    const points: number[] = [];
    for (const v of o.points) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return null;
      points.push(Math.round(v * 10000) / 10000);
    }
    const size = JSON.stringify(points).length;
    const full = this.boardFull(size, maxTotalBytes);
    if (full) return full;
    const list = this.strokes(board);
    const dropped = list.length >= WB_MAX_STROKES ? list.shift() : undefined;
    this.boardBytes = this.boardBytes! + size - (dropped ? JSON.stringify(dropped.points).length : 0);
    this.persist();
    const stroke: Stroke = { id: randomUUID(), color, width: Math.round(width), points, by: by.uid };
    list.push(stroke);
    this.repo.addStroke(this.id, board, stroke, dropped?.id);
    return stroke;
  }

  clearBoard(board: string): void {
    const freed = this.saved ? this.repo.strokeBytes(this.id, board) : 0;
    this.boards.set(board, []);
    if (this.saved) this.repo.clearBoard(this.id, board);
    if (this.boardBytes !== null) this.boardBytes = Math.max(0, this.boardBytes - freed);
  }
}

const OMIKUJI = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
const HANDS = ['グー', 'チョキ', 'パー'];

/** Chat commands. The server rolls, so nobody can fake the result. */
function runCommand(text: string): string | null {
  const [cmd, arg] = text.split(/\s+/, 2);
  switch (cmd) {
    case '/dice': {
      const sides = Math.min(100, Math.max(2, Number.parseInt(arg ?? '6', 10) || 6));
      return `🎲 サイコロ（${sides}面）：${randomInt(1, sides + 1)}`;
    }
    case '/omikuji':
      return `⛩️ おみくじ：${OMIKUJI[randomInt(OMIKUJI.length)]}`;
    case '/coin':
      return `🪙 コイン：${randomInt(2) ? 'おもて' : 'うら'}`;
    case '/janken': {
      const mine = HANDS.indexOf(arg ?? '');
      const cpu = randomInt(3);
      if (mine < 0) return `✊ じゃんけん：${HANDS[cpu]}！（/janken グー のように出してね）`;
      const result = (mine - cpu + 3) % 3;
      const label = result === 0 ? 'あいこ' : result === 2 ? 'かち！' : 'まけ…';
      return `✊ じゃんけん：あなた ${HANDS[mine]} vs ${HANDS[cpu]} → ${label}`;
    }
    default:
      return null;
  }
}
