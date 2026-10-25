// Model: everything the browser knows about the current space.
// Controllers change it; views listen to its events and redraw.

import type {
  ActionKind,
  AvatarLook,
  ChatMessage,
  FileMeta,
  JoinResult,
  MoveMsg,
  Note,
  Player,
  PlayerStatePatch,
} from '../../../shared/types.ts';
import { Emitter } from './Emitter.ts';

/** A player plus values used only for drawing. */
export interface PlayerView extends Player {
  drawX: number; // smoothed position shown on screen
  drawY: number;
  walkTime: number; // drives the walking animation
  petX: number; // the pet trails behind
  petY: number;
  action: { kind: ActionKind; start: number } | null;
  bubble: { text: string; start: number } | null;
}

export interface Reaction {
  playerId: string;
  emoji: string;
  start: number;
}

type Events = {
  players: void; // someone joined, left, or changed name/look
  state: string; // a player's status/mic/cam/... changed (player id)
  chat: ChatMessage;
  reaction: Reaction;
  speaking: void;
  files: void;
  notes: void;
};

export class SpaceModel extends Emitter<Events> {
  readonly spaceId: string;
  readonly selfId: string;
  readonly selfUid: string;
  readonly uploadToken: string;
  readonly downloadToken: string;
  readonly players = new Map<string, PlayerView>();
  readonly chat: ChatMessage[] = [];
  readonly reactions: Reaction[] = [];
  files: FileMeta[] = [];
  notes: Note[] = [];
  /** Ids of people whose microphone is picking up sound right now. */
  speaking = new Set<string>();

  constructor(j: JoinResult) {
    super();
    this.spaceId = j.spaceId;
    this.selfId = j.selfId;
    this.selfUid = j.selfUid;
    this.uploadToken = j.uploadToken;
    this.downloadToken = j.downloadToken;
    for (const p of j.players) this.players.set(p.id, toView(p));
    this.chat.push(...j.chat);
    this.files = [...j.files];
    this.notes = [...j.notes];
  }

  get me(): PlayerView {
    return this.players.get(this.selfId)!;
  }

  others(): PlayerView[] {
    return [...this.players.values()].filter((p) => p.id !== this.selfId);
  }

  add(p: Player): void {
    this.players.set(p.id, toView(p));
    this.emit('players', undefined);
  }

  remove(id: string): void {
    this.players.delete(id);
    this.speaking.delete(id);
    this.emit('players', undefined);
  }

  move(id: string, m: MoveMsg): void {
    const p = this.players.get(id);
    if (!p) return;
    const jump = Math.hypot(p.x - m.x, p.y - m.y) > 64; // teleport: do not slide across the map
    Object.assign(p, m);
    if (jump || id === this.selfId) {
      p.drawX = m.x;
      p.drawY = m.y;
    }
    if (jump) {
      p.petX = m.x - 20;
      p.petY = m.y;
    }
  }

  setState(id: string, patch: PlayerStatePatch): void {
    const p = this.players.get(id);
    if (!p) return;
    Object.assign(p, patch);
    this.emit('state', id);
  }

  setProfile(id: string, name: string, look: AvatarLook): void {
    const p = this.players.get(id);
    if (!p) return;
    p.name = name;
    p.look = look;
    this.emit('players', undefined);
  }

  addChat(m: ChatMessage): void {
    this.chat.push(m);
    if (this.chat.length > 400) this.chat.shift();
    // Show what was said as a speech bubble over the avatar.
    const p = this.players.get(m.from);
    if (p && m.kind !== 'file') p.bubble = { text: m.text, start: performance.now() };
    if (p && m.kind === 'file' && m.file) p.bubble = { text: `📎 ${m.file.name}`, start: performance.now() };
    this.emit('chat', m);
  }

  addReaction(playerId: string, emoji: string): void {
    const r = { playerId, emoji, start: performance.now() };
    this.reactions.push(r);
    this.emit('reaction', r);
  }

  startAction(playerId: string, kind: ActionKind): void {
    const p = this.players.get(playerId);
    if (p) p.action = { kind, start: performance.now() };
  }

  setSpeaking(ids: Set<string>): void {
    const same = ids.size === this.speaking.size && [...ids].every((i) => this.speaking.has(i));
    if (same) return;
    this.speaking = ids;
    this.emit('speaking', undefined);
  }

  addFile(f: FileMeta): void {
    if (!this.files.some((x) => x.id === f.id)) this.files.push(f);
    this.emit('files', undefined);
  }

  removeFile(id: string): void {
    this.files = this.files.filter((f) => f.id !== id);
    this.emit('files', undefined);
  }

  addNote(n: Note): void {
    this.notes.push(n);
    this.emit('notes', undefined);
  }

  removeNote(id: string): void {
    this.notes = this.notes.filter((n) => n.id !== id);
    this.emit('notes', undefined);
  }

  /** URL to show or download a shared file (only works while I am in the space). */
  fileUrl(f: FileMeta, download = false): string {
    const q = new URLSearchParams({ t: this.downloadToken });
    if (download) q.set('dl', '1');
    return `/api/spaces/${encodeURIComponent(this.spaceId)}/files/${encodeURIComponent(f.id)}?${q}`;
  }

  /** Moves the on-screen positions of other people smoothly toward their real positions. */
  tick(dt: number): void {
    const k = 1 - Math.exp(-dt * 14);
    const petK = 1 - Math.exp(-dt * 4);
    const now = performance.now();
    for (const p of this.players.values()) {
      if (p.id !== this.selfId) {
        p.drawX += (p.x - p.drawX) * k;
        p.drawY += (p.y - p.drawY) * k;
      }
      const walking = p.moving || Math.hypot(p.x - p.drawX, p.y - p.drawY) > 1;
      p.walkTime = walking ? p.walkTime + dt : 0;
      // the pet follows a little behind
      const behind = p.dir === 'left' ? 22 : p.dir === 'right' ? -22 : 0;
      const tx = p.drawX + behind;
      const ty = p.drawY + (p.dir === 'up' ? 14 : p.dir === 'down' ? -6 : 2);
      p.petX += (tx - p.petX) * petK;
      p.petY += (ty - p.petY) * petK;
      if (p.action && now - p.action.start > 1200) p.action = null;
      if (p.bubble && now - p.bubble.start > 6000) p.bubble = null;
    }
    while (this.reactions.length && now - this.reactions[0]!.start > 3000) this.reactions.shift();
  }
}

function toView(p: Player): PlayerView {
  return { ...p, drawX: p.x, drawY: p.y, walkTime: 0, petX: p.x - 20, petY: p.y, action: null, bubble: null };
}
