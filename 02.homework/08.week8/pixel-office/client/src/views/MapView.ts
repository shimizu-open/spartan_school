// View: draws the map and everything on it (avatars, pets, notes, files,
// speech bubbles, reactions, confetti, weather, light). It only reads the model.

import { HEAR_MAX, NOTE_COLORS, STATUSES, TILE } from '../../../shared/constants.ts';
import { MAP_H, MAP_W, privateAreaAt, type Area, type MapObject } from '../../../shared/map.ts';
import type { Dir, FileMeta, Note } from '../../../shared/types.ts';
import type { PlayerView, SpaceModel } from '../models/SpaceModel.ts';
import type { Daylight, Weather } from '../models/SettingsModel.ts';
import { FEET_X, FEET_Y, SIT_DROP, SPRITE_H, SPRITE_W, avatarSprite, headTop } from './avatarSprite.ts';
import { Effects } from './effects.ts';
import { PET_FEET_X, PET_FEET_Y, PET_H, PET_W, petSprite } from './petSprite.ts';
import { renderMap, renderMapTop } from './tileArt.ts';

export const PIXEL_FONT = '"DotGothic16", system-ui, sans-serif';
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];
const WALK_FRAMES = [1, 0, 2, 0];
const DIRS: Dir[] = ['down', 'left', 'up', 'right'];

export class MapView {
  readonly canvas: HTMLCanvasElement;
  readonly base: HTMLCanvasElement;
  private readonly top: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly model: SpaceModel;
  private readonly effects = new Effects();
  private readonly images = new Map<string, HTMLImageElement>();
  private zoomIndex = 2;
  private camX = 0;
  private camY = 0;
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  /** Mouse position over the canvas (css px), for hover tooltips. */
  hover: { x: number; y: number } | null = null;
  /** Where I am walking to (shown as a marker). */
  target: { x: number; y: number } | null = null;
  /** Object I can use right now (highlighted). */
  nearObject: MapObject | null = null;
  weather: Weather = 'none';
  daylight: Daylight = 'auto';

  constructor(parent: HTMLElement, model: SpaceModel) {
    this.model = model;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'マップ。矢印キーかWASDで移動、クリックした場所へ歩く、ダブルクリックで瞬間移動');
    parent.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.base = renderMap();
    this.top = renderMapTop();
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
    model.on('reaction', (r) => {
      const p = model.players.get(r.playerId);
      if (p && (r.emoji === '🎉' || r.emoji === '🔥')) this.effects.confetti(p.drawX, p.drawY - headTop(p.look), r.emoji === '🔥' ? 'fire' : 'party');
    });
  }

  get zoom(): number {
    return ZOOMS[this.zoomIndex]!;
  }

  zoomBy(step: number): number {
    this.zoomIndex = Math.max(0, Math.min(ZOOMS.length - 1, this.zoomIndex + step));
    return this.zoom;
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, r.width);
    this.cssH = Math.max(1, r.height);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
  }

  /** Converts a mouse position (css px relative to the canvas) to map pixels. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx / this.zoom + this.camX, y: sy / this.zoom + this.camY };
  }

  /** Converts map pixels to css px relative to the canvas. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.camX) * this.zoom, y: (y - this.camY) * this.zoom };
  }

  /** The visible part of the map, in map pixels. */
  viewRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.camX, y: this.camY, w: this.cssW / this.zoom, h: this.cssH / this.zoom };
  }

  playerAt(sx: number, sy: number): PlayerView | null {
    const w = this.screenToWorld(sx, sy);
    let best: PlayerView | null = null;
    for (const p of this.model.players.values()) {
      const inside = w.x > p.drawX - 18 && w.x < p.drawX + 18 && w.y > p.drawY - headTop(p.look) && w.y < p.drawY + 2;
      if (inside && (!best || p.drawY > best.drawY)) best = p;
    }
    return best;
  }

  noteAt(sx: number, sy: number): Note | null {
    const w = this.screenToWorld(sx, sy);
    return [...this.model.notes].reverse().find((n) => Math.abs(w.x - n.x) < 11 && Math.abs(w.y - (n.y - 10)) < 11) ?? null;
  }

  fileAt(sx: number, sy: number): FileMeta | null {
    const w = this.screenToWorld(sx, sy);
    return (
      [...this.model.files]
        .reverse()
        .find((f) => f.x !== undefined && f.y !== undefined && Math.abs(w.x - f.x) < 15 && Math.abs(w.y - (f.y - 12)) < 15) ?? null
    );
  }

  render(dt: number): void {
    const c = this.ctx;
    const z = this.zoom;
    const viewW = this.cssW / z;
    const viewH = this.cssH / z;
    const me = this.model.me;
    const mapW = MAP_W * TILE;
    const mapH = MAP_H * TILE;
    this.camX = mapW <= viewW ? (mapW - viewW) / 2 : clamp(me.drawX - viewW / 2, 0, mapW - viewW);
    this.camY = mapH <= viewH ? (mapH - viewH) / 2 : clamp(me.drawY - 24 - viewH / 2, 0, mapH - viewH);
    this.camX = Math.round(this.camX * z) / z;
    this.camY = Math.round(this.camY * z) / z;
    const now = performance.now();

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2b2433';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(z * this.dpr, 0, 0, z * this.dpr, -this.camX * z * this.dpr, -this.camY * z * this.dpr);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.base, 0, 0);

    const myRoom = privateAreaAt(me.x, me.y);
    if (myRoom) this.drawRoomTint(myRoom);
    else if (me.status === 'present' || me.status === 'meeting') this.drawHearingRange(me);
    if (this.nearObject) this.drawObjectHighlight(this.nearObject, now);
    if (this.target) this.drawTarget(this.target, now);

    for (const n of this.model.notes) this.drawNote(n);
    for (const f of this.model.files) if (f.x !== undefined) this.drawFile(f);

    // avatars and pets, sorted by their feet so nearer things cover farther ones
    const things: { y: number; draw: () => void }[] = [];
    for (const p of this.model.players.values()) {
      things.push({ y: p.drawY, draw: () => this.drawAvatar(p, now) });
      if (p.look.pet) things.push({ y: p.petY, draw: () => this.drawPet(p, now) });
    }
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();

    c.drawImage(this.top, 0, 0);

    const sorted = [...this.model.players.values()].sort((a, b) => a.drawY - b.drawY);
    for (const p of sorted) this.drawLabel(p, now);
    for (const p of sorted) if (p.bubble) this.drawBubble(p, now);
    this.drawReactions(now);
    this.effects.drawWorld(c, dt);
    this.drawHoverTip();

    // screen-space effects: weather and time of day
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.effects.drawWeather(c, this.weather, this.cssW, this.cssH, dt);
    this.effects.drawDaylight(c, this.daylight, this.cssW, this.cssH);
  }

  // ---- floor things --------------------------------------------------------

  private drawRoomTint(a: Area): void {
    const c = this.ctx;
    c.fillStyle = 'rgba(255, 111, 89, 0.10)';
    c.fillRect(a.x * TILE, a.y * TILE, a.w * TILE, a.h * TILE);
    c.setLineDash([8, 6]);
    c.strokeStyle = 'rgba(255, 111, 89, 0.85)';
    c.lineWidth = 2;
    c.strokeRect(a.x * TILE + 2, a.y * TILE + 2, a.w * TILE - 4, a.h * TILE - 4);
    c.setLineDash([]);
  }

  private drawHearingRange(me: PlayerView): void {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(me.drawX, me.drawY - 6, HEAR_MAX, HEAR_MAX * 0.8, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(46, 196, 166, 0.07)';
    c.fill();
    c.setLineDash([4, 6]);
    c.strokeStyle = 'rgba(46, 196, 166, 0.55)';
    c.lineWidth = 1.5;
    c.stroke();
    c.setLineDash([]);
  }

  private drawObjectHighlight(o: MapObject, now: number): void {
    const c = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(now / 250);
    c.strokeStyle = `rgba(255, 193, 69, ${0.6 + pulse * 0.4})`;
    c.lineWidth = 3;
    c.strokeRect(o.tx * TILE - 2, o.ty * TILE - 2, o.w * TILE + 4, o.h * TILE + 4);
  }

  private drawTarget(t: { x: number; y: number }, now: number): void {
    const c = this.ctx;
    const r = 6 + Math.sin(now / 150) * 2;
    c.strokeStyle = '#ffc145';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(t.x, t.y - 4, r * 1.6, r, 0, 0, Math.PI * 2);
    c.stroke();
  }

  private drawNote(n: Note): void {
    const c = this.ctx;
    const x = Math.round(n.x) - 10;
    const y = Math.round(n.y) - 20;
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(x + 2, y + 2, 20, 20);
    c.fillStyle = NOTE_COLORS[n.color] ?? NOTE_COLORS[0]!;
    c.fillRect(x, y, 20, 20);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(x + 14, y, 6, 6);
    c.fillStyle = 'rgba(43,36,51,0.55)';
    for (let i = 0; i < 3; i++) c.fillRect(x + 4, y + 7 + i * 4, i === 2 ? 7 : 12, 1);
    c.fillStyle = '#ff6f59';
    c.fillRect(x + 8, y - 2, 4, 4);
  }

  private drawFile(f: FileMeta): void {
    const c = this.ctx;
    const x = Math.round(f.x!) - 14;
    const y = Math.round(f.y!) - 26;
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath();
    c.ellipse(x + 14, y + 27, 13, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2b2433';
    c.fillRect(x - 2, y - 2, 32, 28);
    c.fillStyle = '#fffdf7';
    c.fillRect(x, y, 28, 24);
    const img = f.image ? this.image(f) : null;
    if (img && img.complete && img.naturalWidth > 0) {
      const s = Math.max(24 / img.naturalWidth, 20 / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      c.save();
      c.beginPath();
      c.rect(x + 2, y + 2, 24, 20);
      c.clip();
      c.imageSmoothingEnabled = true;
      c.drawImage(img, x + 14 - w / 2, y + 12 - h / 2, w, h);
      c.restore();
      c.imageSmoothingEnabled = false;
    } else {
      c.font = `14px ${PIXEL_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(fileEmoji(f), x + 14, y + 13);
      c.textAlign = 'left';
    }
  }

  private image(f: FileMeta): HTMLImageElement {
    let img = this.images.get(f.id);
    if (!img) {
      img = new Image();
      img.src = this.model.fileUrl(f);
      this.images.set(f.id, img);
    }
    return img;
  }

  // ---- avatars -------------------------------------------------------------

  private drawAvatar(p: PlayerView, now: number): void {
    const c = this.ctx;
    const x = Math.round(p.drawX);
    let y = Math.round(p.drawY);
    let dir = p.dir;
    let frame = p.walkTime > 0 ? WALK_FRAMES[Math.floor(p.walkTime * 8) % 4]! : 0;
    let bob = frame === 0 && p.walkTime > 0 ? -1 : 0;
    let scaleY = 1;
    if (p.dancing && p.pose !== 'sit') {
      const beat = Math.floor(now / 220);
      dir = DIRS[beat % 4]!;
      frame = beat % 2 ? 1 : 2;
      bob = beat % 2 ? -3 : 0;
    }
    if (p.action) {
      const t = (now - p.action.start) / 1000;
      if (p.action.kind === 'jump' && t < 0.6) {
        bob = -Math.round(Math.sin((t / 0.6) * Math.PI) * 22);
        scaleY = t < 0.06 ? 0.85 : 1;
      }
      if (p.action.kind === 'spin' && t < 0.9) dir = DIRS[Math.floor(t * 12) % 4]!;
    }
    // shadow (shrinks while jumping)
    const sh = Math.max(0.5, 1 + bob / 40);
    c.fillStyle = 'rgba(43, 36, 51, 0.25)';
    c.beginPath();
    c.ellipse(x, y - 1, 13 * sh, 4.5 * sh, 0, 0, Math.PI * 2);
    c.fill();
    const away = !STATUSES[p.status].talk && p.status !== 'focus';
    c.globalAlpha = away ? 0.6 : 1;
    const sprite = avatarSprite(p.look, dir, frame, p.pose === 'sit' ? 'sit' : 'stand');
    y += bob;
    if (scaleY !== 1) {
      c.drawImage(sprite, x - FEET_X, y - FEET_Y * scaleY, SPRITE_W, SPRITE_H * scaleY);
    } else {
      c.drawImage(sprite, x - FEET_X, y - FEET_Y, SPRITE_W, SPRITE_H);
    }
    c.globalAlpha = 1;
    // a drink in hand, on a small white badge so it reads on any floor
    if (p.item) {
      const side = dir === 'left' ? -17 : 17;
      c.fillStyle = '#2b2433';
      c.beginPath();
      c.arc(x + side, y - 20, 10, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fffdf7';
      c.beginPath();
      c.arc(x + side, y - 20, 8.5, 0, Math.PI * 2);
      c.fill();
      c.font = `12px ${PIXEL_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.item, x + side, y - 19);
    }
    if (p.action?.kind === 'wave') {
      const t = (now - p.action.start) / 1000;
      c.font = `16px ${PIXEL_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('👋', x + 18 + Math.sin(t * 18) * 3, y - headTop(p.look) + 14);
    }
    c.textAlign = 'left';
  }

  private drawPet(p: PlayerView, now: number): void {
    const moving = Math.hypot(p.drawX - p.petX, p.drawY - p.petY) > 26 || p.walkTime > 0;
    const frame = moving ? Math.floor(now / 180) % 2 : 0;
    const dx = p.drawX - p.petX;
    const dy = p.drawY - p.petY;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    const s = petSprite(p.look.pet, moving ? dir : 'down', frame);
    if (!s) return;
    const c = this.ctx;
    const x = Math.round(p.petX);
    const y = Math.round(p.petY);
    c.fillStyle = 'rgba(43, 36, 51, 0.2)';
    c.beginPath();
    c.ellipse(x, y - 1, 7, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.drawImage(s, x - PET_FEET_X, y - PET_FEET_Y, PET_W, PET_H);
  }

  private drawLabel(p: PlayerView, now: number): void {
    const c = this.ctx;
    const x = Math.round(p.drawX);
    const lift = p.pose === 'sit' ? SIT_DROP : 0;
    const top = Math.round(p.drawY) - headTop(p.look) + lift - 4;
    const self = p.id === this.model.selfId;
    const st = STATUSES[p.status];
    const text = p.status === 'present' ? p.name : `${st.emoji} ${p.name}`;
    c.font = `12px ${PIXEL_FONT}`;
    const w = Math.ceil(c.measureText(text).width) + 14;
    const lx = Math.round(x - w / 2);
    const ly = top - 17;
    const speaking = this.model.speaking.has(p.id);
    c.fillStyle = '#2b2433';
    c.beginPath();
    c.roundRect(lx - 1, ly - 1, w + 2, 18, 5);
    c.fill();
    c.fillStyle = p.megaphone ? '#ff6f59' : self ? '#ffc145' : '#fffdf7';
    c.beginPath();
    c.roundRect(lx + 1, ly + 1, w - 2, 14, 4);
    c.fill();
    if (speaking) {
      c.strokeStyle = '#2ec4a6';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(lx - 3, ly - 3, w + 6, 22, 7);
      c.stroke();
    }
    c.fillStyle = p.megaphone ? '#fffdf7' : '#2b2433';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, x, ly + 8.5);
    let ix = lx + w + 4;
    c.textAlign = 'left';
    c.font = `13px ${PIXEL_FONT}`;
    if (p.hand) {
      c.fillText('✋', ix, ly + 8 + Math.sin(now / 200) * 2);
      ix += 16;
    }
    if (p.screen) c.fillText('🖥️', ix, ly + 8);
    if (p.statusNote && !st.talk) {
      c.font = `10px ${PIXEL_FONT}`;
      const nw = c.measureText(p.statusNote).width + 10;
      c.fillStyle = 'rgba(43, 36, 51, 0.8)';
      c.beginPath();
      c.roundRect(x - nw / 2, ly - 15, nw, 13, 4);
      c.fill();
      c.fillStyle = '#fffdf7';
      c.textAlign = 'center';
      c.fillText(p.statusNote, x, ly - 8);
      c.textAlign = 'left';
    }
  }

  private drawBubble(p: PlayerView, now: number): void {
    const b = p.bubble!;
    const age = now - b.start;
    const c = this.ctx;
    c.font = `12px ${PIXEL_FONT}`;
    const lines = wrap(c, b.text, 150, 3);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 16;
    const h = lines.length * 15 + 10;
    const x = Math.round(p.drawX - w / 2);
    const lift = p.pose === 'sit' ? SIT_DROP : 0;
    const extra = p.statusNote && !STATUSES[p.status].talk ? 16 : 0;
    const y = Math.round(p.drawY - headTop(p.look) + lift - 28 - h - extra);
    c.globalAlpha = age > 5500 ? Math.max(0, 1 - (age - 5500) / 500) : Math.min(1, age / 120);
    c.fillStyle = '#2b2433';
    c.beginPath();
    c.roundRect(x - 2, y - 2, w + 4, h + 4, 8);
    c.fill();
    c.beginPath();
    c.moveTo(p.drawX - 6, y + h);
    c.lineTo(p.drawX + 6, y + h);
    c.lineTo(p.drawX, y + h + 8);
    c.fill();
    c.fillStyle = '#fffdf7';
    c.beginPath();
    c.roundRect(x, y, w, h, 6);
    c.fill();
    c.beginPath();
    c.moveTo(p.drawX - 4, y + h - 1);
    c.lineTo(p.drawX + 4, y + h - 1);
    c.lineTo(p.drawX, y + h + 5);
    c.fill();
    c.fillStyle = '#2b2433';
    c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, x + 8, y + 6 + i * 15));
    c.globalAlpha = 1;
  }

  private drawReactions(now: number): void {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const r of this.model.reactions) {
      const p = this.model.players.get(r.playerId);
      if (!p) continue;
      const t = (now - r.start) / 3000;
      c.globalAlpha = t < 0.8 ? 1 : Math.max(0, 1 - (t - 0.8) / 0.2);
      const pop = t < 0.08 ? 0.6 + t * 5 : 1;
      c.font = `${Math.round(24 * pop)}px ${PIXEL_FONT}`;
      c.fillText(r.emoji, p.drawX + Math.sin(t * 10) * 4, p.drawY - headTop(p.look) - 34 - t * 30);
    }
    c.globalAlpha = 1;
    c.textAlign = 'left';
  }

  private drawHoverTip(): void {
    if (!this.hover) return;
    const note = this.noteAt(this.hover.x, this.hover.y);
    const file = note ? null : this.fileAt(this.hover.x, this.hover.y);
    if (!note && !file) return;
    const c = this.ctx;
    const w = this.screenToWorld(this.hover.x, this.hover.y);
    const text = note ? `${note.text}\n— ${note.byName}` : `${file!.name}\n${file!.byName}・クリックで開く`;
    c.font = `12px ${PIXEL_FONT}`;
    const lines = text.split('\n').flatMap((l) => wrap(c, l, 200, 6));
    const bw = Math.max(...lines.map((l) => c.measureText(l).width)) + 16;
    const bh = lines.length * 15 + 10;
    const x = Math.round(w.x + 12);
    const y = Math.round(w.y - bh - 8);
    c.fillStyle = '#2b2433';
    c.fillRect(x - 2, y - 2, bw + 4, bh + 4);
    c.fillStyle = note ? (NOTE_COLORS[note.color] ?? '#ffe27a') : '#fffdf7';
    c.fillRect(x, y, bw, bh);
    c.fillStyle = '#2b2433';
    c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, x + 8, y + 6 + i * 15));
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Splits text into lines that fit `max` px (character by character, works for Japanese). */
function wrap(c: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (c.measureText(line + ch).width > max) {
        out.push(line);
        line = ch;
      } else line += ch;
    }
    out.push(line);
  }
  if (out.length > maxLines) {
    const cut = out.slice(0, maxLines);
    cut[maxLines - 1] = `${cut[maxLines - 1]!.slice(0, -1)}…`;
    return cut;
  }
  return out;
}

export function fileEmoji(f: Pick<FileMeta, 'name' | 'image'>): string {
  if (f.image) return '🖼️';
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return '📕';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx', 'key'].includes(ext)) return '📽️';
  if (['zip', '7z', 'rar', 'gz', 'tar'].includes(ext)) return '🗜️';
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return '🎵';
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return '🎬';
  if (['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) return '🖼️';
  return '📄';
}
