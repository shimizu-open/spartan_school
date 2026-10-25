// Little pixel pets that follow their owner around the map.
// Same technique as avatarSprite.ts: small character pictures on a grid,
// an automatic dark outline, scaled up and cached. 'right' is 'left' mirrored.

import type { Dir } from '../../../shared/types.ts';

const SCALE = 2;
const GW = 16;
const GH = 14;
const GROUND = 12; // last row the feet stand on

export const PET_W = GW * SCALE;
export const PET_H = GH * SCALE;
export const PET_FEET_X = (GW / 2) * SCALE;
export const PET_FEET_Y = (GROUND + 1) * SCALE;

const INK = '#2b2433';

interface PetArt {
  pal: Record<string, string>;
  down: string[];
  left: string[];
  /** Back view. Defaults to the front view with the face painted over. */
  up?: string[];
  /** Characters that belong to the face (hidden in the back view) and what replaces them. */
  face?: Record<string, string>;
  /** How it moves on frame 1: hop (default), squash (slime) or float (always in the air). */
  move?: 'hop' | 'squash' | 'float';
}

const PETS: (PetArt | null)[] = [
  null,
  // 1 ネコ
  {
    pal: { m: '#f2a65a', d: '#d27f34', w: '#fff4e3', p: '#ff8fa3', k: INK },
    face: { k: 'm', p: 'm', w: 'm' },
    down: [
      'm......m',
      'mm....mm',
      'mpmddmpm',
      'mmmmmmmm',
      'mkmmmmkm',
      'mwwppwwm',
      '.mwwwwm..m',
      '.mmmmmm.m.',
      '.mdmmdmm..',
      '.ww..ww...',
    ],
    left: [
      '.m...m......',
      '.mm.mm......',
      '.mpmdm.....m',
      '.mmmmm.....m',
      '.kmmmm....m.',
      'pwmmmmmmmmm.',
      '.wwmmdmdmmm.',
      '..mmmmmmmmm.',
      '..mw.mm.mw..',
      '..ww.ww.ww..',
    ],
    up: [
      'm......m',
      'mm....mm',
      'mmmddmmm',
      'mmmdmmmm',
      'mmmmmmmm',
      'mmmmmmmm',
      '.mmmmmm.',
      '.mdmmdm.',
      '.mmmmmm.',
      '.mmmmmm.',
      '...mm...',
      '...m....',
    ],
  },
  // 2 イヌ
  {
    pal: { m: '#d9a066', e: '#8a5a32', w: '#fff4e3', k: INK, t: '#ff7f8f' },
    face: { k: 'm', w: 'm', t: 'm' },
    down: [
      '..mmmm..',
      '.mmmmmm.',
      'emmmmmme',
      'emkmmkme',
      'emwwwwme',
      'e.wkkw.e',
      '..wttw..',
      '.mmmmmm.',
      '.mmmmmm.',
      '.ww..ww.',
    ],
    left: [
      '..mmmm......',
      '.mmmmme.....',
      '.kmmmee....m',
      'mmmmmee...m.',
      'kwwmmmmmmmm.',
      '.wwmmmmmmmm.',
      '..mmmmmmmmm.',
      '..mm.mm.mm..',
      '..ww.ww.ww..',
    ],
    up: [
      '..mmmm..',
      '.mmmmmm.',
      'emmmmmme',
      'emmmmmme',
      'emmmmmme',
      'e.mmmm.e',
      '...mm...',
      '.mmmmmm.',
      '.mmmmmm.',
      '.mmmmmm.',
      '...m....',
      '...m....',
    ],
  },
  // 3 ひよこ
  {
    pal: { y: '#ffd84a', d: '#f0b528', o: '#ff9a2e', k: INK, p: '#ffab9a' },
    face: { k: 'y', o: 'y', p: 'y' },
    down: [
      '...yy...',
      '..yyyy..',
      '.yyyyyy.',
      'yykyykyy',
      'ypyooypy',
      'dyyyyyyd',
      '.yyyyyy.',
      '..o..o..',
    ],
    left: [
      '...yy...',
      '..yyyy..',
      '.yyyyyy.',
      '.kyyyyyy',
      'ooyyydyy',
      '.yyyddyy',
      '..yyyyy.',
      '...o.o..',
    ],
    up: [
      '...yy...',
      '..yyyy..',
      '.yyyyyy.',
      'yyyyyyyy',
      'yyyyyyyy',
      'dyyyyyyd',
      '.yyyyyy.',
      '..o..o..',
    ],
  },
  // 4 スライム
  {
    pal: { b: '#5bc8f0', d: '#3a9ed0', l: '#c9f1ff', k: INK, p: '#ff9fc0' },
    face: { k: 'b', p: 'b' },
    move: 'squash',
    down: [
      '....bb....',
      '...bbbb...',
      '..blbbbb..',
      '.bllbbbbb.',
      '.bbkbbkbb.',
      'bbpbbbbpbb',
      'bbbbbbbbbb',
      '.dbbbbbbd.',
    ],
    left: [
      '....bb....',
      '...bbbb...',
      '..blbbbb..',
      '.bllbbbbb.',
      '.kbbbbbbb.',
      'pbbbbbbbbb',
      'bbbbbbbbbb',
      '.dbbbbbbd.',
    ],
  },
  // 5 ペンギン
  {
    pal: { n: '#3a4258', w: '#ffffff', o: '#ffa53a', k: INK },
    face: { k: 'n', o: 'n', w: 'n' },
    down: [
      '..nnnn..',
      '.nnnnnn.',
      'nnwnnwnn',
      'nwkwwkwn',
      'nwwoowwn',
      'nnwwwwnn',
      'nnwwwwnn',
      '.nwwwwn.',
      '..o..o..',
    ],
    left: [
      '..nnnn..',
      '.nnnnnn.',
      '.wnnnnn.',
      '.kwnnnn.',
      'oownnnnn',
      '.wwnnnnn',
      '.wwwnnn.',
      '.wwwnnn.',
      '..oo.o..',
    ],
    up: [
      '..nnnn..',
      '.nnnnnn.',
      'nnnnnnnn',
      'nnnnnnnn',
      'nnnnnnnn',
      'nnnnnnnn',
      'nnnnnnnn',
      '.nnnnnn.',
      '..o..o..',
    ],
  },
  // 6 ウサギ
  {
    pal: { w: '#fbf6f8', p: '#ffb3c6', k: INK, g: '#e6dce0' },
    face: { k: 'w' },
    down: [
      '.ww..ww.',
      '.wp..pw.',
      '.wp..pw.',
      '.ww..ww.',
      'wwwwwwww',
      'wkwwwwkw',
      'wpwppwpw',
      '.wwwwww.',
      '.wwwwww.',
      '.gg..gg.',
    ],
    left: [
      '...ww.......',
      '..wpw.......',
      '..wpw.......',
      '..ww........',
      '.wwww.......',
      '.kwwwwwww...',
      'pwwwwwwwwww.',
      '.wwwwwwwwww.',
      '..wwwwwwwg..',
      '..gg...gg...',
    ],
    up: [
      '.ww..ww.',
      '.ww..ww.',
      '.ww..ww.',
      '.ww..ww.',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      '.wwwwww.',
      '.wwwwww.',
      '...ww...',
    ],
  },
  // 7 おばけ
  {
    pal: { w: '#f4f6ff', b: '#d6dcf7', k: INK, p: '#ffb3c6' },
    face: { k: 'w', p: 'w' },
    move: 'float',
    down: [
      '..wwww..',
      '.wwwwww.',
      'wwwwwwww',
      'wkwwwwkw',
      'wpwkkwpw',
      'wwwwwwww',
      'wwwwwwww',
      'bwbwwbwb',
      '.b..b..b',
    ],
    left: [
      '..wwww...',
      '.wwwwwww.',
      'wwwwwwww.',
      'kwwwwwwww',
      'wpwwwwwww',
      'wwwwwwwww',
      'wwwwwwwww',
      'bwbwwbwbw',
      '.b..b..b.',
    ],
  },
  // 8 ミニロボ
  {
    pal: { g: '#b5c0cf', d: '#7d8aa0', s: '#2c3e50', c: '#5ee0c2', r: '#e8475a', k: INK },
    face: { c: 's' },
    down: [
      '...rr...',
      '....d...',
      '.gggggg.',
      'gssssssg',
      'gscsscsg',
      'gssssssg',
      '.gggggg.',
      '.gdrcdg.',
      '.gggggg.',
      '.dd..dd.',
    ],
    left: [
      '...rr...',
      '....d...',
      '.gggggg.',
      'sssssggg',
      'scsssggd',
      'sssssggg',
      '.gggggg.',
      '.ggggdg.',
      '.gggggg.',
      '.dd..dd.',
    ],
    up: [
      '...rr...',
      '....d...',
      '.gggggg.',
      'gggggggg',
      'ggdddggg',
      'gggggggg',
      '.gggggg.',
      '.gdddgg.',
      '.gggggg.',
      '.dd..dd.',
    ],
  },
  // 9 ハムスター
  {
    pal: { m: '#f0b77a', w: '#fff3e2', p: '#ff9fb4', k: INK, d: '#d9965a' },
    face: { k: 'm', p: 'm', w: 'm' },
    down: [
      '.dd..dd.',
      'dmmmmmmd',
      'mmmmmmmm',
      'mkmmmmkm',
      'pwwkkwwp',
      'mwwwwwwm',
      '.wwwwww.',
      '.p....p.',
    ],
    left: [
      '..dd....',
      '.mmmmm..',
      'mmmmmmm.',
      'kmmmmmmm',
      'pwmmmmmm',
      'wwwwmmmm',
      '.wwwwmm.',
      '.p...p..',
    ],
    up: [
      '.dd..dd.',
      'dmmmmmmd',
      'mmmmmmmm',
      'mmmdmmmm',
      'mmmmmmmm',
      'mmmmmmmm',
      '.mmmmmm.',
      '.p....p.',
    ],
  },
  // 10 カメ
  {
    pal: { g: '#7cc85a', s: '#4f9a3a', h: '#a8742e', H: '#7f5320', k: INK },
    face: { k: 'g' },
    down: [
      '...gggg...',
      '...gkkg...',
      '..hhhhhh..',
      '.hHhhhHhh.',
      'ghhhHhhhhg',
      '.hHhhhHhh.',
      '..hhhhhh..',
      '.gg....gg.',
    ],
    left: [
      '.gg.........',
      'gkgg........',
      'gggg.hhhhh..',
      '.ggghHhhHhh.',
      '...hhhHhhhhg',
      '...hHhhhHhh.',
      '...gg...gg..',
    ],
    up: [
      '..hhhhhh..',
      '.hHhhhHhh.',
      'ghhhHhhhhg',
      '.hHhhhHhh.',
      '.hhhhhhhh.',
      '..hhhhhh..',
      '.gg.gg.gg.',
    ],
  },
  // 11 ミニドラゴン
  {
    pal: { m: '#9b6cf0', d: '#7349c9', l: '#e6d6ff', y: '#ffc145', w: '#ffffff', k: INK },
    face: { k: 'm', w: 'm' },
    down: [
      '.y......y.',
      '.yy....yy.',
      '..mmmmmm..',
      '.mmmmmmmm.',
      'dmkwmmkwmd',
      'ddmmmmmmdd',
      'dd.mllm.dd',
      '...mllm...',
      '...m..m...',
    ],
    left: [
      '..y.y.......',
      '..yyy.......',
      '.mmmm.......',
      'kwmmmm..d...',
      'mmmmmm.dd..m',
      '..mmmmddd.m.',
      '..lmmmmmmm..',
      '..lmmmmm....',
      '...m..m.....',
    ],
    up: [
      '.y......y.',
      '.yy....yy.',
      '..mmmmmm..',
      '.mmmmmmmm.',
      'dmmmmmmmmd',
      'ddmmyymmdd',
      'dd.myym.dd',
      '...mmmm...',
      '...m..m...',
      '....mm....',
      '.....m....',
    ],
  },
];

function hideFace(rows: string[], face: Record<string, string>): string[] {
  return rows.map((r) => [...r].map((ch) => face[ch] ?? ch).join(''));
}

function paint(art: PetArt, dir: Dir, frame: number): (string | null)[] {
  const px = new Array<string | null>(GW * GH).fill(null);
  const v = dir === 'right' ? 'left' : dir;
  let rows = v === 'left' ? art.left : v === 'up' ? (art.up ?? hideFace(art.down, art.face ?? {})) : art.down;
  const move = art.move ?? 'hop';
  let lift = 0;
  if (move === 'hop') lift = frame === 1 ? 1 : 0;
  if (move === 'float') lift = frame === 1 ? 2 : 1;
  if (move === 'squash' && frame === 1) {
    // squash: drop the second row and widen the bottom
    rows = rows.filter((_, i) => i !== 1).map((r, i, a) => (i >= a.length - 3 ? r.replace(/^\./, r[1] ?? '.').replace(/\.$/, r[r.length - 2] ?? '.') : r));
  }
  const w = Math.max(...rows.map((r) => r.length));
  const x0 = Math.floor((GW - w) / 2);
  const y0 = GROUND - rows.length + 1 - lift;
  const mask = new Set<number>();
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = art.pal[row[i]!];
      if (!c) continue;
      const y = y0 + j;
      const x = x0 + i;
      if (x < 0 || x >= GW || y < 0 || y >= GH) continue;
      px[y * GW + x] = c;
      mask.add(y * GW + x);
    }
  });
  for (const i of mask) {
    const x = i % GW;
    for (const n of [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, i - GW, i + GW]) {
      if (n >= 0 && n < px.length && !mask.has(n)) px[n] = INK;
    }
  }
  if (dir === 'right') {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW / 2; x++) {
        const a = y * GW + x;
        const b = y * GW + GW - 1 - x;
        const t = px[a]!;
        px[a] = px[b]!;
        px[b] = t;
      }
  }
  return px;
}

const cache = new Map<string, HTMLCanvasElement>();

/** The pet's picture (null for "no pet"). frame 0/1 alternate for a little hop. */
export function petSprite(pet: number, dir: Dir, frame: number): HTMLCanvasElement | null {
  const art = PETS[pet];
  if (!art) return null;
  const f = frame % 2;
  const key = `${pet}.${dir}.${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const px = paint(art, dir, f);
  const cv = document.createElement('canvas');
  cv.width = PET_W;
  cv.height = PET_H;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < px.length; i++) {
    const c = px[i];
    if (!c) continue;
    const x = i % GW;
    ctx.fillStyle = c;
    ctx.fillRect(x * SCALE, ((i - x) / GW) * SCALE, SCALE, SCALE);
  }
  cache.set(key, cv);
  return cv;
}
