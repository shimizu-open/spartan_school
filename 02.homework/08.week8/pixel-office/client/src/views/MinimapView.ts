// View: a small map of the whole space in the corner. Everyone is a dot;
// clicking walks you there.

import { TILE } from '../../../shared/constants.ts';
import { MAP_H, MAP_W } from '../../../shared/map.ts';
import type { SpaceModel } from '../models/SpaceModel.ts';
import { h } from './dom.ts';

const SCALE = 3; // minimap pixels per tile

export class MinimapView {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly model: SpaceModel;
  private readonly base: HTMLCanvasElement;
  onPick: (x: number, y: number) => void = () => undefined;

  constructor(model: SpaceModel, mapImage: HTMLCanvasElement) {
    this.model = model;
    this.canvas = h('canvas', { width: MAP_W * SCALE, height: MAP_H * SCALE, class: 'minimap-canvas', 'aria-label': 'ミニマップ。クリックするとそこへ歩きます' });
    this.el = h('div', { class: 'minimap' }, this.canvas);
    this.base = document.createElement('canvas');
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    const b = this.base.getContext('2d')!;
    b.imageSmoothingEnabled = true;
    b.drawImage(mapImage, 0, 0, this.base.width, this.base.height);
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * MAP_W * TILE;
      const y = ((e.clientY - r.top) / r.height) * MAP_H * TILE;
      this.onPick(x, y);
    });
  }

  render(view: { x: number; y: number; w: number; h: number }): void {
    const c = this.canvas.getContext('2d')!;
    c.drawImage(this.base, 0, 0);
    const k = SCALE / TILE;
    c.strokeStyle = 'rgba(255,253,247,0.9)';
    c.lineWidth = 1;
    c.strokeRect(view.x * k + 0.5, view.y * k + 0.5, view.w * k, view.h * k);
    for (const p of this.model.players.values()) {
      const self = p.id === this.model.selfId;
      c.fillStyle = '#2b2433';
      c.fillRect(p.x * k - (self ? 3 : 2), p.y * k - (self ? 3 : 2), self ? 6 : 4, self ? 6 : 4);
      c.fillStyle = self ? '#ffc145' : p.megaphone ? '#ff6f59' : '#fffdf7';
      c.fillRect(p.x * k - (self ? 2 : 1), p.y * k - (self ? 2 : 1), self ? 4 : 2, self ? 4 : 2);
    }
  }
}
