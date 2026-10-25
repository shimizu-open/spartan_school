// Controller: moves my avatar.
//   keyboard (arrows / WASD), click = walk there (path finding), double-click = teleport,
//   "follow" someone, and other shortcut keys passed to the space controller.

import type { Socket } from 'socket.io-client';
import { TILE, WALK_SPEED } from '../../../shared/constants.ts';
import { collides, nearestFree, occupiedBy } from '../../../shared/map.ts';
import { findPath, type Point } from '../../../shared/path.ts';
import type { ClientToServer, Dir, FileMeta, Note, ServerToClient } from '../../../shared/types.ts';
import type { PlayerView, SpaceModel } from '../models/SpaceModel.ts';
import type { MapView } from '../views/MapView.ts';

type Sock = Socket<ServerToClient, ClientToServer>;

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

export interface InputHandlers {
  playerClick: (p: PlayerView, clientX: number, clientY: number) => void;
  noteClick: (n: Note) => void;
  fileClick: (f: FileMeta) => void;
  /** Any other key (not movement). Return true if it was used. */
  hotkey: (e: KeyboardEvent) => boolean;
}

export class InputController {
  private readonly held = new Set<Dir>();
  private lastSent = 0;
  private wasMoving = false;
  private path: Point[] = [];
  private followId: string | null = null;
  private followTimer = 0;
  private readonly socket: Sock;
  private readonly model: SpaceModel;
  private readonly view: MapView;
  private readonly on: InputHandlers;

  constructor(socket: Sock, model: SpaceModel, view: MapView, handlers: InputHandlers) {
    this.socket = socket;
    this.model = model;
    this.view = view;
    this.on = handlers;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    view.canvas.addEventListener('dblclick', this.onDblClick);
    view.canvas.addEventListener('click', this.onClick);
    view.canvas.addEventListener('mousemove', this.onMouseMove);
    view.canvas.addEventListener('mouseleave', () => (view.hover = null));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  get following(): string | null {
    return this.followId;
  }

  /** Teleports me (double-click, "enter room" buttons). */
  teleport(x: number, y: number): void {
    this.stopAuto();
    const me = this.model.me;
    const p = nearestFree(x, y, occupiedBy(this.model.others(), 40));
    this.model.move(me.id, { x: p.x, y: p.y, dir: me.dir, moving: false });
    this.socket.emit('move', { x: p.x, y: p.y, dir: me.dir, moving: false });
  }

  /** Walks to a point along a path around walls. Returns false if there is no way. */
  walkTo(x: number, y: number): boolean {
    const me = this.model.me;
    const path = findPath(me, { x, y });
    if (!path) return false;
    this.path = path;
    this.view.target = path[path.length - 1] ?? null;
    return true;
  }

  follow(id: string | null): void {
    this.followId = id;
    this.followTimer = 0;
    if (!id) this.stopAuto();
  }

  /** Puts me at an exact spot facing a direction (used for sitting down). */
  place(x: number, y: number, dir: Dir): void {
    this.stopAuto();
    this.model.move(this.model.selfId, { x, y, dir, moving: false });
    this.socket.emit('move', { x, y, dir, moving: false });
  }

  private stopAuto(): void {
    this.path = [];
    this.view.target = null;
  }

  update(dt: number): void {
    const me = this.model.me;
    let dx = 0;
    let dy = 0;
    if (this.held.has('left')) dx -= 1;
    if (this.held.has('right')) dx += 1;
    if (this.held.has('up')) dy -= 1;
    if (this.held.has('down')) dy += 1;
    const keyMoving = dx !== 0 || dy !== 0;
    if (keyMoving) {
      this.stopAuto();
      this.followId = null;
    }

    // follow: re-plan the path toward the person now and then
    if (this.followId && !keyMoving) {
      const target = this.model.players.get(this.followId);
      if (!target) this.followId = null;
      else {
        this.followTimer -= dt;
        const dist = Math.hypot(target.x - me.x, target.y - me.y);
        if (this.followTimer <= 0) {
          this.followTimer = 0.5;
          if (dist > TILE * 1.8) this.walkTo(target.x, target.y);
        }
        if (dist <= TILE * 1.4) this.stopAuto();
      }
    }

    let moving = false;
    const step = Math.min(dt, 0.05) * WALK_SPEED;
    if (keyMoving) {
      const len = Math.hypot(dx, dy);
      let x = me.x;
      let y = me.y;
      // Try each axis separately so you can slide along walls.
      const nx = x + (dx / len) * step;
      if (!collides(nx, y)) x = nx;
      const ny = y + (dy / len) * step;
      if (!collides(x, ny)) y = ny;
      const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      this.model.move(me.id, { x, y, dir, moving: true });
      moving = true;
    } else if (this.path.length) {
      const next = this.path[0]!;
      const vx = next.x - me.x;
      const vy = next.y - me.y;
      const d = Math.hypot(vx, vy);
      const dir: Dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
      if (d <= step) {
        this.path.shift();
        if (!collides(next.x, next.y)) this.model.move(me.id, { x: next.x, y: next.y, dir, moving: this.path.length > 0 });
        if (!this.path.length) this.view.target = null;
      } else {
        const x = me.x + (vx / d) * step;
        const y = me.y + (vy / d) * step;
        if (collides(x, y)) this.stopAuto();
        else this.model.move(me.id, { x, y, dir, moving: true });
      }
      moving = this.path.length > 0;
    } else if (this.wasMoving) {
      me.moving = false;
    }
    if (moving && me.pose === 'sit') me.pose = 'stand';
    if (moving && me.dancing) me.dancing = false;

    const now = performance.now();
    if ((moving && now - this.lastSent > 50) || (!moving && this.wasMoving)) {
      this.socket.emit('move', { x: me.x, y: me.y, dir: me.dir, moving });
      this.lastSent = now;
    }
    this.wasMoving = moving;
  }

  private typing(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal')) return; // a dialog is open
    const dir = KEYS[e.code];
    if (dir) {
      e.preventDefault();
      this.held.add(dir);
      return;
    }
    if (!e.repeat && this.on.hotkey(e)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const dir = KEYS[e.code];
    if (dir) this.held.delete(dir);
  };

  private onBlur = (): void => this.held.clear();

  private local(e: MouseEvent): { x: number; y: number } {
    const r = this.view.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDblClick = (e: MouseEvent): void => {
    const s = this.local(e);
    const w = this.view.screenToWorld(s.x, s.y);
    this.followId = null;
    this.teleport(w.x, w.y + 8);
  };

  private onClick = (e: MouseEvent): void => {
    const s = this.local(e);
    this.view.canvas.focus();
    const p = this.view.playerAt(s.x, s.y);
    if (p) return this.on.playerClick(p, e.clientX, e.clientY);
    const n = this.view.noteAt(s.x, s.y);
    if (n) return this.on.noteClick(n);
    const f = this.view.fileAt(s.x, s.y);
    if (f) return this.on.fileClick(f);
    const w = this.view.screenToWorld(s.x, s.y);
    this.followId = null;
    this.walkTo(w.x, w.y + 8);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const s = this.local(e);
    this.view.hover = s;
    const over = this.view.playerAt(s.x, s.y) || this.view.noteAt(s.x, s.y) || this.view.fileAt(s.x, s.y);
    this.view.canvas.style.cursor = over ? 'pointer' : 'default';
  };
}
