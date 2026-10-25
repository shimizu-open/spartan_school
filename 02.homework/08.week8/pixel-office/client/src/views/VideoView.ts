// View: video tiles of the people I am talking with.
//   "map"  = each camera floats above its avatar like a speech bubble (default)
//   "row"  = a strip at the top
//   "grid" = equal tiles over the map
// Screen shares always go to the stack at the top right. Click a tile to see it large.

import type { AvatarLook } from '../../../shared/types.ts';
import type { VideoLayout } from '../models/SettingsModel.ts';
import { drawPortrait } from './avatarSprite.ts';
import { h, icon } from './dom.ts';

export interface VideoEntry {
  key: string; // unique per tile, e.g. "<id>:cam"
  playerId: string;
  label: string;
  kind: 'cam' | 'screen';
  stream: MediaStream | null;
  showVideo: boolean;
  look: AvatarLook;
  micOn: boolean;
  speaking: boolean;
  self: boolean;
  megaphone: boolean;
}

interface Tile {
  el: HTMLElement;
  video: HTMLVideoElement;
  avatar: HTMLCanvasElement;
  name: HTMLElement;
  mic: HTMLElement;
  lookKey: string;
  entry: VideoEntry;
}

const BG = ['#ffe9d6', '#d9f5ec', '#e3ecff', '#fff1c9', '#f0e4ff'];

export class VideoView {
  private readonly cams: HTMLElement;
  private readonly shares: HTMLElement;
  private readonly tiles = new Map<string, Tile>();
  private readonly spotlight: HTMLElement;
  private readonly spotVideo: HTMLVideoElement;
  private readonly spotLabel: HTMLElement;
  private spotKey: string | null = null;
  private entries: VideoEntry[] = [];
  layout: VideoLayout = 'map';

  constructor(parent: HTMLElement) {
    this.cams = h('div', { class: 'videos videos-map', 'aria-label': '通話中の人' });
    this.shares = h('div', { class: 'shares', 'aria-label': '共有中の画面' });
    this.spotVideo = h('video', { autoplay: true, playsinline: true, muted: true });
    this.spotLabel = h('div', { class: 'spotlight-label' });
    this.spotlight = h(
      'div',
      { class: 'spotlight', hidden: true },
      this.spotVideo,
      this.spotLabel,
      h('button', { class: 'spotlight-close', 'aria-label': '閉じる', onclick: () => this.setSpot(null) }, icon('close')),
    );
    parent.append(this.cams, this.shares, this.spotlight);
  }

  setLayout(layout: VideoLayout): void {
    this.layout = layout;
    this.cams.className = `videos videos-${layout}`;
    for (const t of this.tiles.values()) {
      t.el.style.transform = '';
      t.el.style.left = '';
      t.el.style.top = '';
    }
    this.render(this.entries);
  }

  render(entries: VideoEntry[]): void {
    this.entries = entries;
    const keep = new Set(entries.map((e) => e.key));
    for (const [k, t] of this.tiles) {
      if (!keep.has(k)) {
        t.el.remove();
        this.tiles.delete(k);
      }
    }
    let ci = 0;
    let si = 0;
    for (const e of entries) {
      let t = this.tiles.get(e.key);
      if (!t) {
        t = this.createTile(e);
        this.tiles.set(e.key, t);
      }
      const box = e.kind === 'screen' ? this.shares : this.cams;
      const i = e.kind === 'screen' ? si++ : ci++;
      if (box.children[i] !== t.el) box.insertBefore(t.el, box.children[i] ?? null);
      t.entry = e;
      this.updateTile(t, e);
    }
    this.cams.hidden = ci === 0;
    this.shares.hidden = si === 0;
    this.cams.dataset.count = String(ci);
    if (this.spotKey && !keep.has(this.spotKey)) this.setSpot(null);
    else if (this.spotKey) this.setSpot(this.spotKey);
  }

  /**
   * In "map" layout, moves each camera bubble above its avatar. Called every frame.
   * Bubbles of people standing close together are pushed apart sideways so they never overlap.
   */
  place(pos: (playerId: string) => { x: number; y: number } | null, scale: number): void {
    if (this.layout !== 'map') return;
    const s = Math.max(0.7, Math.min(1.25, scale));
    const w = 128 * s + 10;
    const h = 96 * s + 14;
    const items: { t: Tile; x: number; y: number }[] = [];
    for (const t of this.tiles.values()) {
      if (t.entry.kind !== 'cam') continue;
      const p = pos(t.entry.playerId);
      if (!p) {
        t.el.style.visibility = 'hidden';
        continue;
      }
      items.push({ t, x: p.x, y: p.y });
    }
    items.sort((a, b) => a.x - b.x);
    const before = items.reduce((n, i) => n + i.x, 0);
    for (let i = 1; i < items.length; i++) {
      const cur = items[i]!;
      for (let j = 0; j < i; j++) {
        const prev = items[j]!;
        if (Math.abs(cur.y - prev.y) < h && cur.x - prev.x < w) cur.x = prev.x + w;
      }
    }
    // keep the group centred over the people instead of drifting to the right
    const shift = items.length ? (before - items.reduce((n, i) => n + i.x, 0)) / items.length : 0;
    for (const { t, x, y } of items) {
      t.el.style.visibility = '';
      t.el.style.transform = `translate(${Math.round(x + shift)}px, ${Math.round(y)}px) translate(-50%, -100%) scale(${s.toFixed(2)})`;
    }
  }

  private createTile(e: VideoEntry): Tile {
    const video = h('video', { autoplay: true, playsinline: true, muted: true });
    const avatar = h('canvas', { width: 160, height: 120 });
    const name = h('span', { class: 'tile-name' });
    const mic = h('span', { class: 'tile-mic' }, icon('micOff', 13));
    const el = h('button', { class: `tile tile-${e.kind}`, title: 'クリックで大きく表示' }, video, avatar, h('div', { class: 'tile-label' }, mic, name));
    el.addEventListener('click', () => this.setSpot(this.spotKey === e.key ? null : e.key));
    return { el, video, avatar, name, mic, lookKey: '', entry: e };
  }

  private updateTile(t: Tile, e: VideoEntry): void {
    t.name.textContent = e.label;
    t.mic.hidden = e.micOn || e.kind === 'screen';
    t.el.classList.toggle('speaking', e.speaking);
    t.el.classList.toggle('megaphone', e.megaphone);
    t.el.classList.toggle('self', e.self);
    const show = e.showVideo && !!e.stream;
    t.video.hidden = !show;
    t.avatar.hidden = show;
    if (show && t.video.srcObject !== e.stream) {
      t.video.srcObject = e.stream;
      void t.video.play().catch(() => undefined);
    }
    if (!show && t.video.srcObject) t.video.srcObject = null;
    t.video.classList.toggle('mirror', e.self && e.kind === 'cam');
    const lookKey = JSON.stringify(e.look);
    if (!show && t.lookKey !== lookKey) {
      drawPortrait(t.avatar, e.look, BG[(e.look.outfitColor + e.look.hair) % BG.length]);
      t.lookKey = lookKey;
    }
  }

  private setSpot(key: string | null): void {
    this.spotKey = key;
    const e = key ? this.entries.find((x) => x.key === key) : null;
    if (!e || !e.stream || !e.showVideo) {
      this.spotKey = null;
      this.spotlight.hidden = true;
      this.spotVideo.srcObject = null;
      return;
    }
    this.spotlight.hidden = false;
    this.spotLabel.textContent = e.label;
    if (this.spotVideo.srcObject !== e.stream) {
      this.spotVideo.srcObject = e.stream;
      void this.spotVideo.play().catch(() => undefined);
    }
    this.spotVideo.classList.toggle('mirror', e.self && e.kind === 'cam');
  }
}
