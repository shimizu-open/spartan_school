// View: the start page. Create a new space or join one by its ID / link.

import { randomLook } from '../../../shared/avatar.ts';
import { SPACE_ID_RE } from '../../../shared/constants.ts';
import { SPAWN } from '../../../shared/map.ts';
import type { Dir } from '../../../shared/types.ts';
import { FEET_X, FEET_Y, SPRITE_H, SPRITE_W, avatarSprite } from './avatarSprite.ts';
import { h } from './dom.ts';
import { renderMap } from './tileArt.ts';

export interface HomeActions {
  open: (spaceId: string) => void;
  install: (() => void) | null;
}

export function newSpaceId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

/** Accepts either a bare ID or a full link like https://host/s/ID. */
export function parseSpaceInput(v: string): string | null {
  const s = v.trim();
  const m = s.match(/\/s\/([A-Za-z0-9_-]+)/);
  const id = m ? m[1]! : s;
  return SPACE_ID_RE.test(id) ? id : null;
}

export function renderHome(root: HTMLElement, recent: string[], actions: HomeActions): void {
  const input = h('input', { class: 'input', placeholder: 'スペースIDか招待リンク', 'aria-label': 'スペースIDか招待リンク', maxlength: 200 });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const join = (e: Event) => {
    e.preventDefault();
    const id = parseSpaceInput(input.value);
    if (!id) {
      error.textContent = 'IDは英数字・-・_ の4〜32文字です';
      return;
    }
    actions.open(id);
  };

  root.append(
    h(
      'main',
      { class: 'home' },
      h(
        'section',
        { class: 'home-card' },
        h('h1', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), 'Pixel Office'),
        h('p', { class: 'home-lead' }, '近づくだけで話せる、ドット絵のバーチャルオフィス'),
        heroScene(),
        h('button', { class: 'btn btn-primary btn-lg', onclick: () => actions.open(newSpaceId()) }, '新しいスペースを作る'),
        h('div', { class: 'divider' }, 'または'),
        h('form', { class: 'join-form', onsubmit: join }, input, h('button', { class: 'btn', type: 'submit' }, '参加する')),
        error,
        recent.length
          ? h(
              'div',
              { class: 'recent' },
              h('h2', null, '最近のスペース'),
              h('ul', null, ...recent.map((id) => h('li', null, h('button', { class: 'link', onclick: () => actions.open(id) }, id)))),
            )
          : null,
        actions.install ? h('button', { class: 'btn btn-ghost', onclick: actions.install }, 'アプリとしてインストール') : null,
      ),
      h(
        'ul',
        { class: 'home-features' },
        h('li', null, h('b', null, '🗣️ 近づいて話す'), '近くの人と声と映像がつながる'),
        h('li', null, h('b', null, '🔒 会議室'), '部屋の中の人とだけ話せる'),
        h('li', null, h('b', null, '📎 ファイル共有'), 'チャットやマップに置ける'),
        h('li', null, h('b', null, '🖍️ ホワイトボード'), 'みんなで同時にお絵描き'),
        h('li', null, h('b', null, '🐱 着ぐるみ＆ペット'), 'アバターは約22億通り'),
        h('li', null, h('b', null, '🔗 ログイン不要'), 'リンクを送るだけで招待'),
      ),
    ),
  );
}

/** A small live scene for the start page: a piece of the map with people walking around. */
function heroScene(): HTMLCanvasElement {
  const W = 400;
  const H = 120;
  const cv = h('canvas', { class: 'home-hero', width: W, height: H, 'aria-hidden': 'true' });
  const map = renderMap();
  const ox = Math.max(0, Math.min(map.width - W, SPAWN.x - W / 2));
  const oy = Math.max(0, Math.min(map.height - H, SPAWN.y - H / 2 - 10));
  const walkers = Array.from({ length: 5 }, (_, i) => ({
    look: randomLook(),
    x: 40 + i * 75,
    y: 70 + (i % 2) * 28,
    vx: (i % 2 ? -1 : 1) * (18 + i * 4),
  }));
  const ctx = cv.getContext('2d')!;
  const born = performance.now();
  let last = born;
  const frame = (now: number) => {
    if (!cv.isConnected && now - born > 1000) return; // stop once the page changes
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, ox, oy, W, H, 0, 0, W, H);
    for (const w of walkers.sort((a, b) => a.y - b.y)) {
      w.x += w.vx * dt;
      if (w.x < 20 || w.x > W - 20) w.vx = -w.vx;
      const dir: Dir = w.vx < 0 ? 'left' : 'right';
      const f = [1, 0, 2, 0][Math.floor(now / 140) % 4]!;
      ctx.fillStyle = 'rgba(43,36,51,0.25)';
      ctx.beginPath();
      ctx.ellipse(w.x, w.y - 1, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(avatarSprite(w.look, dir, f), Math.round(w.x - FEET_X), Math.round(w.y - FEET_Y), SPRITE_W, SPRITE_H);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return cv;
}
