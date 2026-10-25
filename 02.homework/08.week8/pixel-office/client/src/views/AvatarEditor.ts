// View: the avatar maker. A big walking preview (with the pet) that slowly
// turns around, category tabs, and choice buttons that each show a tiny
// rendering of that option on your current avatar.

import {
  ACCESSORIES,
  COSTUMES,
  EYES,
  HAIR,
  HAIR_STYLES,
  OUTFITS,
  OUTFIT_COLORS,
  PETS,
  SKIN,
  randomLook,
  type AvatarLook,
} from '../../../shared/avatar.ts';
import type { Dir } from '../../../shared/types.ts';
import { FEET_X, FEET_Y, SPRITE_H, SPRITE_W, avatarSprite } from './avatarSprite.ts';
import { h } from './dom.ts';
import { PET_FEET_X, PET_FEET_Y, PET_H, PET_W, petSprite } from './petSprite.ts';
import './avatarEditor.css';

type Key = keyof AvatarLook;
type Thumb = 'head' | 'face' | 'body' | 'hood' | 'pet';

interface ChoiceGroup {
  key: Key;
  label: string;
  names: string[];
  thumb: Thumb;
}
interface SwatchGroup {
  key: Key;
  label: string;
  colors: string[];
}
interface Tab {
  id: string;
  label: string;
  swatches?: SwatchGroup;
  choices: ChoiceGroup;
}

const TABS: Tab[] = [
  { id: 'face', label: 'かお', swatches: { key: 'skin', label: '肌の色', colors: SKIN }, choices: { key: 'eyes', label: '目', names: EYES, thumb: 'face' } },
  { id: 'hair', label: 'かみがた', swatches: { key: 'hair', label: '髪の色', colors: HAIR }, choices: { key: 'hairStyle', label: '髪型', names: HAIR_STYLES, thumb: 'head' } },
  { id: 'wear', label: 'ふく', swatches: { key: 'outfitColor', label: '服の色', colors: OUTFIT_COLORS }, choices: { key: 'outfit', label: '服', names: OUTFITS, thumb: 'body' } },
  { id: 'acc', label: 'こもの', choices: { key: 'accessory', label: 'こもの', names: ACCESSORIES, thumb: 'head' } },
  { id: 'costume', label: 'きぐるみ', choices: { key: 'costume', label: 'きぐるみ', names: COSTUMES, thumb: 'hood' } },
  { id: 'pet', label: 'ペット', choices: { key: 'pet', label: 'ペット', names: PETS, thumb: 'pet' } },
];

const TURN: Dir[] = ['down', 'left', 'up', 'right'];
const WALK = [1, 0, 2, 0];
const THUMB = 48; // thumbnail canvas size (css px)
const STAGE_W = 168;
const STAGE_H = 136;

let uid = 0;

export class AvatarEditor {
  readonly el: HTMLElement;
  look: AvatarLook;
  onChange: (look: AvatarLook) => void = () => undefined;

  private readonly stage: HTMLCanvasElement;
  private readonly tabs: HTMLButtonElement[] = [];
  private readonly panel: HTMLElement;
  private readonly sitBtn: HTMLButtonElement;
  private readonly id = `ae${++uid}`;
  private tab = 0;
  private items: { btn: HTMLButtonElement; canvas?: HTMLCanvasElement; key: Key; value: number; thumb?: Thumb }[] = [];
  private tick = 0;
  private sitting = false;
  private timer = 0;
  private readonly calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(look: AvatarLook) {
    this.look = { ...look };
    this.stage = h('canvas', {
      class: 'ae-stage-canvas',
      width: STAGE_W,
      height: STAGE_H,
      role: 'img',
      'aria-label': 'アバターのプレビュー（クリックで向きを変える）',
      onclick: () => {
        this.tick = (Math.floor(this.tick / 16) + 1) * 16;
        this.drawStage();
      },
    });
    this.sitBtn = h(
      'button',
      { class: 'ae-mini', type: 'button', 'aria-pressed': 'false', onclick: () => this.toggleSit() },
      'すわる',
    );
    const shuffle = h(
      'button',
      { class: 'ae-shuffle', type: 'button', 'aria-label': 'おまかせ（ランダムに着せかえ）', onclick: () => this.replace(randomLook()) },
      h('span', { class: 'ae-dice', 'aria-hidden': 'true' }, '🎲'),
      'おまかせ',
    );
    const tabList = h('div', { class: 'ae-tabs', role: 'tablist', 'aria-label': 'アバターのパーツ', onkeydown: (e: Event) => this.tabKey(e as KeyboardEvent) });
    TABS.forEach((t, i) => {
      const b = h(
        'button',
        {
          class: 'ae-tab',
          type: 'button',
          role: 'tab',
          id: `${this.id}-tab-${t.id}`,
          'aria-controls': `${this.id}-panel`,
          'aria-selected': String(i === 0),
          tabindex: i === 0 ? 0 : -1,
          onclick: () => this.showTab(i),
        },
        t.label,
      );
      this.tabs.push(b);
      tabList.append(b);
    });
    this.panel = h('div', { class: 'ae-panel', role: 'tabpanel', id: `${this.id}-panel` });

    this.el = h(
      'div',
      { class: 'avatar-editor ae' },
      h(
        'div',
        { class: 'ae-body' },
        h('div', { class: 'ae-stage' }, this.stage, h('div', { class: 'ae-stage-btns' }, this.sitBtn, shuffle)),
        h('div', { class: 'ae-side' }, tabList, this.panel),
      ),
    );
    this.showTab(0);
    this.drawStage();
    this.timer = window.setInterval(() => {
      this.tick++;
      this.drawStage();
    }, this.calm ? 600 : 150);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  // ---- state

  private set(key: Key, v: number): void {
    if (this.look[key] === v) return;
    this.look = { ...this.look, [key]: v };
    this.changed();
  }

  private replace(look: AvatarLook): void {
    this.look = { ...look };
    this.changed();
  }

  private changed(): void {
    this.refresh();
    this.drawStage();
    this.onChange(this.look);
  }

  private toggleSit(): void {
    this.sitting = !this.sitting;
    this.sitBtn.setAttribute('aria-pressed', String(this.sitting));
    this.drawStage();
  }

  // ---- tabs

  private showTab(i: number): void {
    this.tab = i;
    this.tabs.forEach((b, j) => {
      b.setAttribute('aria-selected', String(i === j));
      b.tabIndex = i === j ? 0 : -1;
    });
    const t = TABS[i]!;
    this.panel.setAttribute('aria-labelledby', `${this.id}-tab-${t.id}`);
    this.buildPanel(t);
  }

  private tabKey(e: KeyboardEvent): void {
    const n = TABS.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (this.tab + 1) % n;
    else if (e.key === 'ArrowLeft') next = (this.tab + n - 1) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    this.showTab(next);
    this.tabs[next]!.focus();
  }

  private buildPanel(t: Tab): void {
    this.items = [];
    const parts: HTMLElement[] = [];
    if (t.swatches) {
      const s = t.swatches;
      parts.push(
        h(
          'div',
          { class: 'ae-group' },
          h('span', { class: 'ae-label' }, s.label),
          h(
            'div',
            { class: 'ae-swatches', role: 'group', 'aria-label': s.label },
            ...s.colors.map((c, i) => {
              const b = h('button', {
                class: 'ae-swatch',
                type: 'button',
                'aria-label': `${s.label} ${i + 1}`,
                'aria-pressed': String(this.look[s.key] === i),
                onclick: () => this.set(s.key, i),
              });
              b.style.setProperty('--sw', c);
              this.items.push({ btn: b, key: s.key, value: i });
              return b;
            }),
          ),
        ),
      );
    }
    const g = t.choices;
    parts.push(
      h(
        'div',
        { class: 'ae-group' },
        h('span', { class: 'ae-label' }, g.label),
        h(
          'div',
          { class: `ae-choices ae-choices-${g.thumb}`, role: 'group', 'aria-label': g.label },
          ...g.names.map((name, i) => {
            const canvas = h('canvas', { class: 'ae-thumb', width: THUMB, height: THUMB, 'aria-hidden': 'true' });
            const b = h(
              'button',
              {
                class: 'ae-choice',
                type: 'button',
                'aria-label': `${g.label}: ${name}`,
                'aria-pressed': String(this.look[g.key] === i),
                onclick: () => this.set(g.key, i),
              },
              canvas,
              h('span', { class: 'ae-name', 'aria-hidden': 'true' }, name),
            );
            this.items.push({ btn: b, canvas, key: g.key, value: i, thumb: g.thumb });
            return b;
          }),
        ),
      ),
    );
    this.panel.replaceChildren(...parts);
    this.refresh();
  }

  /** Updates pressed states and redraws every thumbnail with the current look. */
  private refresh(): void {
    for (const it of this.items) {
      it.btn.setAttribute('aria-pressed', String(this.look[it.key] === it.value));
      if (it.canvas && it.thumb) drawThumb(it.canvas, { ...this.look, [it.key]: it.value }, it.thumb);
    }
  }

  // ---- preview stage

  private drawStage(): void {
    const c = this.stage.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    // which way: turn every 16 ticks; walk for 12 of them, stand for 4
    const phase = this.tick % 16;
    const dir = TURN[Math.floor(this.tick / 16) % 4]!;
    const walking = !this.calm && !this.sitting && phase < 12;
    const frame = walking ? WALK[phase % 4]! : 0;
    const z = 2;
    const fx = this.look.pet ? 62 : STAGE_W / 2;
    const fy = STAGE_H - 10;
    // floor shadow
    c.fillStyle = 'rgba(43, 36, 51, 0.18)';
    c.beginPath();
    c.ellipse(fx, fy - 1, 26, 6, 0, 0, Math.PI * 2);
    c.fill();
    if (this.sitting) this.drawCushion(c, fx, fy);
    const pose = this.sitting ? 'sit' : 'stand';
    const bob = walking && frame === 0 ? -z : 0;
    // the pet stands beside, behind when walking up
    const pet = petSprite(this.look.pet, dir, walking ? phase % 2 : Math.floor(this.tick / 3) % 2);
    const px = fx + 58;
    const drawPet = () => {
      if (!pet) return;
      c.fillStyle = 'rgba(43, 36, 51, 0.16)';
      c.beginPath();
      c.ellipse(px, fy - 1, 14, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.drawImage(pet, px - PET_FEET_X * z, fy - PET_FEET_Y * z, PET_W * z, PET_H * z);
    };
    if (dir === 'up') drawPet();
    c.drawImage(avatarSprite(this.look, dir, frame, pose), fx - FEET_X * z, fy - FEET_Y * z + bob, SPRITE_W * z, SPRITE_H * z);
    if (dir !== 'up') drawPet();
  }

  private drawCushion(c: CanvasRenderingContext2D, x: number, y: number): void {
    // a floor cushion (zabuton) a little wider than the avatar
    c.fillStyle = '#2b2433';
    c.fillRect(x - 40, y - 18, 80, 18);
    c.fillStyle = '#ff6f59';
    c.fillRect(x - 38, y - 16, 76, 14);
    c.fillStyle = '#ff9a88';
    c.fillRect(x - 36, y - 16, 72, 4);
    c.fillStyle = '#d9503d';
    c.fillRect(x - 38, y - 4, 76, 2);
  }
}

/** Draws one option thumbnail: a crop of the avatar sprite scaled by a whole number. */
function drawThumb(cv: HTMLCanvasElement, look: AvatarLook, kind: Thumb): void {
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, cv.width, cv.height);
  if (kind === 'pet') {
    const s = petSprite(look.pet, 'down', 0);
    if (!s) {
      drawNone(c, cv.width);
      return;
    }
    // 1.5x keeps every art pixel exactly 3 px wide
    const w = PET_W * 1.5;
    const hh = PET_H * 1.5;
    c.drawImage(s, (cv.width - w) / 2, cv.height - hh - 2, w, hh);
    return;
  }
  const s = avatarSprite(look, 'down', 0);
  const cell = SPRITE_W / 24; // px per art pixel inside the sprite
  if (kind === 'face') {
    // 12 x 12 cells around the eyes, doubled
    c.drawImage(s, 6 * cell, 12 * cell, 12 * cell, 12 * cell, 0, 0, cv.width, cv.height);
    return;
  }
  // 24 x 24 cells: head (and ears/hats) for 'head' and 'hood', the body for 'body'
  const top = kind === 'body' ? 8 : 0;
  c.drawImage(s, 0, top * cell, SPRITE_W, 24 * cell, 0, 0, cv.width, cv.height);
  void SPRITE_H;
}

function drawNone(c: CanvasRenderingContext2D, size: number): void {
  c.strokeStyle = '#b9b0a2';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(size / 2, size / 2, size / 4, 0, Math.PI * 2);
  c.moveTo(size / 2 - size / 6, size / 2 + size / 6);
  c.lineTo(size / 2 + size / 6, size / 2 - size / 6);
  c.stroke();
}
