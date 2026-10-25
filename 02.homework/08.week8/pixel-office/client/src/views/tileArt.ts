// View: draws the whole map once into off-screen canvases.
// renderMap() = floors + furniture + name plates, renderMapTop() = the parts
// that must be drawn over avatars (tree tops, lamp heads, door lintels...).
// Everything is drawn from rectangles in code (no image files), on a 2px "art pixel" grid.

import { TILE } from '../../../shared/constants.ts';
import { AREAS, MAP_H, MAP_W, areaAt, seatDirAt, tileAt } from '../../../shared/map.ts';
import type { Dir } from '../../../shared/types.ts';

type Ctx = CanvasRenderingContext2D;
const T = TILE;

// Palette (shared with the UI)
const INK = '#2b2433';
const CREAM = '#fff6e5';
const PAPER = '#fffdf7';
const CORAL = '#ff6f59';
const CORAL_D = '#d9503d';
const MINT = '#2ec4a6';
const MINT_D = '#1f9c84';
const MUSTARD = '#ffc145';
const MUSTARD_D = '#e09a1f';
const SKY = '#4d8ff0';
const SKY_D = '#3769c4';
const PLUM = '#7b5cd6';
const PLUM_D = '#5a3fae';
const WOOD = '#c98d5a';
const WOOD_D = '#9a6338';
const WOOD_L = '#e3ad78';
const SHADOW = 'rgba(43,36,51,0.22)';

const FLOORS = new Set(['.', 'f', 'p', 's', 'o', 'k', 'c', 'm', 'q', 'd', 'g', 'e', 'a', 'l', 'v', 'u', 'x', 'y']);
const OUTDOOR_FLOORS = new Set(['.', 'f', 'p', 's', 'o', 'd', 'a', 'l', 'y', 'g', 'e']);
const WALLISH = new Set(['#', '&', 'W']);
const INDOOR_AREAS = new Set(['library', 'office', 'roomA', 'roomB', 'roomC', 'cafe', 'game']);

/** Small deterministic random number per tile, so the map looks the same for everyone. */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 668265263);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Smooth value noise, for large soft patches that ignore tile edges. */
function noise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, salt);
  const b = hash(ix + 1, iy, salt);
  const c = hash(ix, iy + 1, salt);
  const d = hash(ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

/** Pixel-art ellipse made of 2px rows. */
function ell(c: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color;
  for (let dy = -ry; dy < ry; dy += 2) {
    const yy = dy + 1;
    const hw = Math.round((rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry)))) / 2) * 2;
    if (hw > 0) c.fillRect(cx - hw, cy + dy, hw * 2, 2);
  }
}

/** Ellipse with a 2px ink outline. */
function ellO(c: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ell(c, cx, cy, rx + 2, ry + 2, INK);
  ell(c, cx, cy, rx, ry, color);
}

/** Box with a 2px ink outline. */
function box(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  rect(c, x, y, w, h, INK);
  rect(c, x + 2, y + 2, w - 4, h - 4, color);
}

const areaIdAt = (tx: number, ty: number): string => areaAt(tx * T + 16, ty * T + 30)?.id ?? '';
const isWall = (tx: number, ty: number) => WALLISH.has(tileAt(tx, ty));
const pick = <V>(list: readonly V[], r: number): V => list[Math.floor(r * list.length) % list.length]!;

// ---------------------------------------------------------------------------
// Zone colors

interface WallStyle {
  cap: string;
  capL: string;
  paper: string;
  paperL: string;
  stripe: string;
  trim: string;
}

const WALLS: Record<string, WallStyle> = {
  library: { cap: '#4f3a5c', capL: '#6a5079', paper: '#3f7f6a', paperL: '#4c9179', stripe: '#357060', trim: '#8a5a3c' },
  office: { cap: '#6b4637', capL: '#8a5d48', paper: '#fff1d6', paperL: '#fff8ea', stripe: '#ffe0a3', trim: '#b9784a' },
  roomA: { cap: '#5d3f5a', capL: '#7a5876', paper: '#ffe7de', paperL: '#fff3ee', stripe: '#ffc7b8', trim: '#c9644f' },
  roomB: { cap: '#5d3f5a', capL: '#7a5876', paper: '#e2f7ef', paperL: '#f1fcf7', stripe: '#b5ead9', trim: '#3f9c86' },
  roomC: { cap: '#4a4170', capL: '#62588f', paper: '#e4edff', paperL: '#f2f6ff', stripe: '#bcd2fb', trim: '#4f74c4' },
  cafe: { cap: '#9c4a3a', capL: '#bd604b', paper: '#fff3df', paperL: '#fffaf0', stripe: '#f6d2b8', trim: '#a8603f' },
  game: { cap: '#3a2d63', capL: '#52428a', paper: '#4a3878', paperL: '#5a4790', stripe: '#3f2f69', trim: '#2b2148' },
};

const CARPETS: Record<string, [string, string, string]> = {
  roomA: ['#f39a83', '#ea8a73', '#ffb9a6'],
  roomB: ['#6fd3bc', '#5fc4ad', '#9be6d4'],
  roomC: ['#86aef5', '#769fec', '#aac7fb'],
};

/** Which building a wall tile belongs to: the indoor area next to it. */
function wallZone(tx: number, ty: number): string {
  // nearest indoor tile, looking south first (that is the side of the wall we see)
  for (let d = 1; d <= 4; d++)
    for (const dy of [d, -d, ...Array.from({ length: 2 * d - 1 }, (_, i) => d - 1 - i)])
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const ch = tileAt(tx + dx, ty + dy);
        if (WALLISH.has(ch) || ch === 'd' || ch === 'H') continue;
        const id = areaIdAt(tx + dx, ty + dy);
        if (INDOOR_AREAS.has(id)) return id;
      }
  return 'office';
}

// ---------------------------------------------------------------------------
// Floors

/** The floor under a furniture tile. */
function baseFloor(ch: string, tx: number, ty: number): string {
  if (ch === 'Y') return 'p';
  if (ch === 'E' || ch === 'J') return '.';
  if (ch === '^') return 'g';
  if (ch === 'Q') return 'l';
  if (ch === 'F') return 'f';
  const order: [number, number][] = [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [-1, 1]];
  for (const [dx, dy] of order) {
    const n = tileAt(tx + dx, ty + dy);
    if (FLOORS.has(n) && n !== 'x' && n !== 'o' && n !== 'e' && n !== 'y') {
      if (n === 'u' && !'zjtn'.includes(ch)) continue;
      return n;
    }
  }
  return '.';
}

function grass(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  for (let by = 0; by < 4; by++)
    for (let bx = 0; bx < 4; bx++) {
      const n = noise((tx * 4 + bx) / 7, (ty * 4 + by) / 7, 3) + (hash(tx * 4 + bx, ty * 4 + by, 5) - 0.5) * 0.12;
      rect(c, x + bx * 8, y + by * 8, 8, 8, n < 0.36 ? '#6cbd4a' : n > 0.66 ? '#88d35e' : '#79c853');
    }
  for (let i = 0; i < 3; i++) {
    const gx = x + 2 + Math.floor(hash(tx, ty, i) * 13) * 2;
    const gy = y + 4 + Math.floor(hash(tx, ty, i + 9) * 12) * 2;
    rect(c, gx, gy, 2, 4, '#58a83f');
    rect(c, gx + 2, gy + 2, 2, 2, '#58a83f');
    rect(c, gx - 2, gy + 2, 2, 2, '#58a83f');
  }
  const r = hash(tx, ty, 17);
  if (r > 0.6) rect(c, x + Math.floor(hash(tx, ty, 18) * 14) * 2, y + Math.floor(hash(tx, ty, 19) * 14) * 2, 2, 2, '#a6e57c');
  if (r > 0.93) {
    const fx = x + 6 + Math.floor(hash(tx, ty, 20) * 10) * 2;
    const fy = y + 6 + Math.floor(hash(tx, ty, 21) * 10) * 2;
    rect(c, fx - 2, fy, 6, 2, PAPER);
    rect(c, fx, fy - 2, 2, 6, PAPER);
    rect(c, fx, fy, 2, 2, MUSTARD);
  }
}

function flowers(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  grass(c, x, y, tx, ty);
  const colors = [CORAL, MUSTARD, PAPER, '#ff9fc4', PLUM, SKY];
  for (let i = 0; i < 5; i++) {
    const fx = x + 4 + Math.floor(hash(tx, ty, i + 20) * 12) * 2;
    const fy = y + 4 + Math.floor(hash(tx, ty, i + 30) * 12) * 2;
    const col = colors[Math.floor(hash(tx, ty, i + 40) * colors.length)]!;
    rect(c, fx, fy + 4, 2, 4, '#3f8f3a');
    rect(c, fx - 2, fy, 6, 2, col);
    rect(c, fx, fy - 2, 2, 6, col);
    rect(c, fx, fy, 2, 2, col === MUSTARD ? CORAL : MUSTARD);
  }
}

/** Grass tufts spilling over the edge of a path toward grass neighbors. */
function grassEdges(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const g = (dx: number, dy: number) => {
    const n = tileAt(tx + dx, ty + dy);
    return n === '.' || n === 'f' || n === 'T' || n === 'U' || n === 'X' || n === 'b';
  };
  c.fillStyle = '#79c853';
  for (let i = 0; i < 32; i += 4) {
    const k = hash(tx * 8 + i, ty, 61) * 3;
    if (g(0, -1)) c.fillRect(x + i, y, 4, 2 + Math.floor(k) * 2);
    if (g(0, 1)) c.fillRect(x + i, y + 30 - Math.floor(k) * 2, 4, 2 + Math.floor(k) * 2);
    if (g(-1, 0)) c.fillRect(x, y + i, 2 + Math.floor(k) * 2, 4);
    if (g(1, 0)) c.fillRect(x + 30 - Math.floor(k) * 2, y + i, 2 + Math.floor(k) * 2, 4);
  }
}

function brick(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  rect(c, x, y, T, T, '#c79770');
  const cols = ['#e7b98b', '#ebc49a', '#dfae80', '#f0cfa6', '#e4b385'];
  for (let r = 0; r < 4; r++) {
    const row = ty * 4 + r;
    const off = row % 2 ? 8 : 0;
    const wy = y + r * 8;
    for (let wx = x - ((x + off) % 16); wx < x + T; wx += 16) {
      const bi = Math.floor((wx + off) / 16);
      const col = cols[Math.floor(hash(bi, row, 11) * cols.length)]!;
      const x0 = Math.max(wx, x);
      const x1 = Math.min(wx + 14, x + T);
      if (x1 > x0) {
        rect(c, x0, wy, x1 - x0, 6, col);
        rect(c, x0, wy, x1 - x0, 2, '#f6dcb8');
      }
    }
  }
  grassEdges(c, x, y, tx, ty);
}

function gravel(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  rect(c, x, y, T, T, '#ead2a2');
  for (let i = 0; i < 9; i++) {
    const px = x + Math.floor(hash(tx, ty, i + 50) * 15) * 2;
    const py = y + Math.floor(hash(tx, ty, i + 60) * 15) * 2;
    rect(c, px, py, 2 + (i % 2) * 2, 2, i % 3 ? '#d4b582' : '#f7e7c6');
  }
  grassEdges(c, x, y, tx, ty);
}

function wood(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const cols = ['#e4b47a', '#dcaa6f', '#e9bd86', '#dfb075'];
  for (let r = 0; r < 4; r++) {
    const row = ty * 4 + r;
    const off = Math.floor(hash(row, 0, 13) * 48);
    const wy = y + r * 8;
    for (let wx = x - ((x + off) % 48); wx < x + T; wx += 48) {
      const pi = Math.floor((wx + off) / 48);
      const x0 = Math.max(wx, x);
      const x1 = Math.min(wx + 48, x + T);
      rect(c, x0, wy, x1 - x0, 8, cols[Math.floor(hash(pi, row, 14) * cols.length)]!);
      if (wx >= x) rect(c, wx, wy, 2, 8, '#b98450');
      const gx = wx + 8 + Math.floor(hash(pi, row, 15) * 14) * 2;
      if (gx >= x && gx < x + T - 6) rect(c, gx, wy + 4, 6, 2, '#d39d62');
    }
    rect(c, x, wy + 6, T, 2, '#c38e57');
  }
}

function libraryCarpet(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  rect(c, x, y, T, T, '#3d8a74');
  for (const [ox, oy] of [[0, 0], [16, 16]] as const) {
    rect(c, x + ox + 6, y + oy + 4, 4, 2, '#4f9e86');
    rect(c, x + ox + 4, y + oy + 6, 8, 4, '#4f9e86');
    rect(c, x + ox + 6, y + oy + 10, 4, 2, '#4f9e86');
    rect(c, x + ox + 7, y + oy + 7, 2, 2, '#e3bf62');
  }
  if (hash(tx, ty, 3) > 0.7) rect(c, x + 22, y + 6, 2, 2, '#e3bf62');
}

function roomCarpet(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  let zone = '';
  for (const dy of [0, 1, 2, 3, -1]) if (!zone && CARPETS[areaIdAt(tx, ty + dy)]) zone = areaIdAt(tx, ty + dy);
  const [base, dark, light] = CARPETS[zone] ?? CARPETS.roomA!;
  rect(c, x, y, T, T, base);
  for (let i = 0; i < 32; i += 8) for (let j = 0; j < 32; j += 8) rect(c, x + i + ((j / 8) % 2) * 4, y + j + 2, 2, 2, dark);
  for (const [ox, oy] of [[4, 4], [20, 20]] as const) {
    rect(c, x + ox + 2, y + oy, 4, 8, light);
    rect(c, x + ox, y + oy + 2, 8, 4, light);
  }
}

function cafeTiles(c: Ctx, x: number, y: number): void {
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const dark = ((x / 16 + i + y / 16 + j) & 1) === 1;
      rect(c, x + i * 16, y + j * 16, 16, 16, dark ? '#f2b08f' : '#fff2e0');
      rect(c, x + i * 16, y + j * 16, 16, 1, dark ? '#f7c4a8' : PAPER);
    }
}

function deck(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const cols = ['#c48a57', '#cf9661', '#bb804e'];
  for (let i = 0; i < 4; i++) {
    const col = tx * 4 + i;
    rect(c, x + i * 8, y, 8, T, cols[Math.floor(hash(col, 0, 7) * 3)]!);
    rect(c, x + i * 8 + 6, y, 2, T, '#9a6639');
    const end = Math.floor(hash(col, ty, 8) * 16) * 2;
    if (hash(col, ty, 9) > 0.5) rect(c, x + i * 8, y + end, 6, 2, '#9a6639');
    rect(c, x + i * 8 + 2, y + 4, 2, 2, '#8a5a32');
  }
}

function stageBoards(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  for (let r = 0; r < 4; r++) {
    rect(c, x, y + r * 8, T, 8, (ty * 4 + r) % 2 ? '#a86b3c' : '#b5763f');
    rect(c, x, y + r * 8, T, 2, '#c4874e');
    const s = Math.floor(hash(tx, ty * 4 + r, 4) * 16) * 2;
    rect(c, x + s, y + r * 8, 2, 8, '#8a552e');
  }
}

function amphitheater(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const even = ty % 2 === 0;
  rect(c, x, y, T, T, even ? '#ebcda3' : '#e2c094');
  rect(c, x, y, T, 4, '#f6e0bd');
  rect(c, x, y + 28, T, 4, '#c9a074');
  const off = ty % 2 ? 8 : 0;
  rect(c, x + ((off + 14) % 32), y + 4, 2, 24, '#d3ad80');
  if (hash(tx, ty, 2) > 0.7) rect(c, x + 6, y + 14, 4, 2, '#d3ad80');
}

function lobbyTiles(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  // cream tiles, with a big compass-star mosaic around the spawn point
  const cx = 38.5 * 4;
  const cy = 40.5 * 4;
  const near = Math.hypot(tx * 4 + 2 - cx, ty * 4 + 2 - cy) < 18;
  if (!near) {
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        rect(c, x + i * 16, y + j * 16, 16, 16, (tx * 2 + i + ty * 2 + j) % 2 ? '#fff1d8' : '#fbe8c8');
        rect(c, x + i * 16, y + j * 16, 16, 1, '#ecd7b2');
        rect(c, x + i * 16, y + j * 16, 1, 16, '#ecd7b2');
      }
    return;
  }
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      const dx = tx * 4 + i + 0.5 - cx;
      const dy = ty * 4 + j + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const c2 = Math.abs(Math.cos(2 * a));
      const s2 = Math.abs(Math.sin(2 * a));
      const star = 4.5 + 7 * Math.pow(c2, 10) + 3.5 * Math.pow(s2, 10);
      let col = ((tx * 2 + (i >> 1) + ty * 2 + (j >> 1)) % 2) ? '#fff1d8' : '#fbe8c8';
      if (d < 2.2) col = CORAL;
      else if (d < 3.2) col = PAPER;
      else if (d < 4.6) col = '#ffd98a';
      else if (d < star) col = c2 > s2 ? MUSTARD : '#ffd98a';
      else if (d > 12.2 && d < 13.2) col = MINT;
      rect(c, x + i * 8, y + j * 8, 8, 8, col);
    }
  for (let k = 0; k < 2; k++) {
    rect(c, x + k * 16, y, 1, T, 'rgba(201,170,120,0.35)');
    rect(c, x, y + k * 16, T, 1, 'rgba(201,170,120,0.35)');
  }
}

function arcadeCarpet(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  rect(c, x, y, T, T, '#3b2d5c');
  const cols = ['#3fb59a', '#e0705e', '#e3b04a', '#5b86d6', '#d98ab4'];
  for (let i = 0; i < 2; i++) {
    const px = x + 2 + Math.floor(hash(tx, ty, i + 70) * 12) * 2;
    const py = y + 2 + Math.floor(hash(tx, ty, i + 80) * 12) * 2;
    const col = cols[Math.floor(hash(tx, ty, i + 90) * cols.length)]!;
    const kind = Math.floor(hash(tx, ty, i + 95) * 3);
    if (kind === 0) {
      rect(c, px, py, 6, 2, col);
      rect(c, px + 2, py - 2, 2, 6, col);
    } else if (kind === 1) {
      rect(c, px, py, 2, 2, col);
      rect(c, px + 2, py + 2, 2, 2, col);
      rect(c, px + 4, py, 2, 2, col);
      rect(c, px + 6, py + 2, 2, 2, col);
    } else {
      rect(c, px, py, 4, 4, col);
      rect(c, px + 1, py + 1, 2, 2, '#3b2d5c');
    }
  }
}

function rug(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const zone = areaIdAt(tx, ty);
  const n = (dx: number, dy: number) => {
    const ch = tileAt(tx + dx, ty + dy);
    return ch === 'u' || ((ch === 'z' || ch === 'j' || ch === 't') && FLOORS.has(baseFloor(ch, tx + dx, ty + dy)) && baseFloor(ch, tx + dx, ty + dy) === 'u');
  };
  const up = n(0, -1);
  const dn = n(0, 1);
  const lf = n(-1, 0);
  const rt = n(1, 0);
  if (zone === 'garden') {
    // gingham picnic blanket
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) rect(c, x + i * 8, y + j * 8, 8, 8, (i + j) % 2 ? PAPER : (i % 2 ? '#ff9a88' : CORAL));
  } else {
    const [base, band, dot] =
      zone === 'library' ? [MUSTARD, CORAL_D, '#ffe08a'] : zone === 'lobby' ? [CORAL, MUSTARD, '#ff9a88'] : zone === 'office' ? [MINT, MUSTARD, '#7fe0c9'] : [PLUM, MUSTARD, '#9d84e8'];
    rect(c, x, y, T, T, base);
    rect(c, x + 14, y + 12, 4, 8, dot);
    rect(c, x + 12, y + 14, 8, 4, dot);
    c.fillStyle = band;
    if (!up) c.fillRect(x, y + 4, T, 3);
    if (!dn) c.fillRect(x, y + T - 7, T, 3);
    if (!lf) c.fillRect(x + 4, y, 3, T);
    if (!rt) c.fillRect(x + T - 7, y, 3, T);
  }
  // shadow and fringe so the rug sits on the floor
  if (!up) rect(c, x, y, T, 2, 'rgba(43,36,51,0.18)');
  if (!lf) rect(c, x, y, 2, T, 'rgba(43,36,51,0.12)');
  if (!dn) for (let i = 2; i < 32; i += 4) rect(c, x + i, y + 30, 2, 2, PAPER);
}

function doormat(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const zone = areaIdAt(tx, ty);
  if (zone === 'lobby') {
    // red carpet from the gate to the plaza
    lobbyTiles(c, x, y, tx, ty);
    const l = tileAt(tx - 1, ty) === 'x';
    const r = tileAt(tx + 1, ty) === 'x';
    rect(c, x, y, T, T, CORAL);
    if (!l) rect(c, x, y, 4, T, MUSTARD);
    if (!r) rect(c, x + 28, y, 4, T, MUSTARD);
    for (let i = 4; i < 32; i += 8) rect(c, x + 14, y + i, 4, 2, '#ff9a88');
    return;
  }
  const below = tileAt(tx, ty + 1);
  floor(c, FLOORS.has(below) && below !== 'x' ? below : 'p', x, y, tx, ty);
  rect(c, x + 2, y + 6, T - 4, 20, '#a8703f');
  rect(c, x + 4, y + 8, T - 8, 16, '#d19a5c');
  for (let i = 6; i < 26; i += 4) rect(c, x + 4, y + i + 2, T - 8, 1, '#bd8650');
}

const isWaterAt = (tx: number, ty: number) => {
  const ch = tileAt(tx, ty);
  return ch === 'w' || ch === 'y';
};

/** Union of rounded tiles: smooth shores for the stream and the pond. */
function waterShape(k: Ctx, r: number, color: string, dy = 0): void {
  k.fillStyle = color;
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      if (!isWaterAt(tx, ty)) continue;
      const cx = tx * T + 16;
      const cy = ty * T + 16 + dy;
      ell(k, cx, cy, r, r, color);
      k.fillStyle = color;
      const rt = isWaterAt(tx + 1, ty);
      const dn = isWaterAt(tx, ty + 1);
      if (rt) k.fillRect(cx, cy - r, T, 2 * r);
      if (dn) k.fillRect(cx - r, cy, 2 * r, T);
      if (rt && dn && isWaterAt(tx + 1, ty + 1)) k.fillRect(cx, cy, T, T);
      // diagonal neighbors: fill the inside corner so a diagonal stream runs smoothly
      if (isWaterAt(tx + 1, ty + 1) && !(rt && dn)) ell(k, cx + 16, cy + 16, r, r, color);
      if (isWaterAt(tx - 1, ty + 1) && !(isWaterAt(tx - 1, ty) && dn)) ell(k, cx - 16, cy + 16, r, r, color);
    }
}

function waterPass(c: Ctx): void {
  waterShape(c, 19, '#d8f1ff');
  const wc = document.createElement('canvas');
  wc.width = MAP_W * T;
  wc.height = MAP_H * T;
  const wk = wc.getContext('2d')!;
  waterShape(wk, 16, '#2f74c2');
  wk.globalCompositeOperation = 'source-atop';
  waterShape(wk, 16, '#4ea3ef', 6);
  waterShape(wk, 9, '#4598ea', 8);
  c.drawImage(wc, 0, 0);
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) if (tileAt(tx, ty) === 'w') ripples(c, tx * T, ty * T, tx, ty);
}

function ripples(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const isW = isWaterAt;
  const deep = isW(tx, ty - 1) && isW(tx, ty + 1) && isW(tx - 1, ty) && isW(tx + 1, ty);
  if (hash(tx, ty, 2) > 0.4) {
    const wx = x + 6 + Math.floor(hash(tx, ty, 0) * 8) * 2;
    const wy = y + 10 + Math.floor(hash(tx, ty, 4) * 7) * 2;
    rect(c, wx, wy, 8, 2, '#8cc8fa');
    rect(c, wx + 2, wy - 2, 4, 2, '#8cc8fa');
  }
  // lily pads and koi in the pond
  const r = hash(tx, ty, 33);
  if (deep && isW(tx, ty - 2) && r > 0.8) {
    ell(c, x + 14, y + 16, 7, 5, '#3faa5a');
    rect(c, x + 14, y + 14, 6, 2, '#4ea3ef');
    if (r > 0.9) {
      rect(c, x + 8, y + 12, 4, 4, '#ff9fc4');
      rect(c, x + 9, y + 13, 2, 2, PAPER);
    }
  } else if (deep && isW(tx, ty - 2) && r < 0.08) {
    rect(c, x + 8, y + 14, 12, 4, '#ff8a3d');
    rect(c, x + 20, y + 12, 4, 8, '#ff8a3d');
    rect(c, x + 10, y + 14, 4, 2, PAPER);
    rect(c, x + 8, y + 14, 2, 2, INK);
  }
}

function bridge(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const up = tileAt(tx, ty - 1) === 'y';
  const dn = tileAt(tx, ty + 1) === 'y';
  rect(c, x, y + (up ? 0 : 4), T, T - (up ? 0 : 4) - (dn ? 0 : 4), '#8a5a32');
  for (let i = 0; i < 32; i += 8) {
    rect(c, x + i, y + (up ? 0 : 4), 6, T - (up ? 0 : 4) - (dn ? 0 : 4), i % 16 ? '#d39d62' : '#c98d5a');
    rect(c, x + i, y + (up ? 0 : 4), 6, 2, '#e8b780');
  }
  if (!up) {
    rect(c, x, y, T, 4, INK);
    rect(c, x, y, T, 2, '#b9784a');
    rect(c, x + 2, y - 6, 4, 8, INK);
    rect(c, x + 3, y - 5, 2, 6, '#b9784a');
  }
  if (!dn) {
    rect(c, x, y + T - 6, T, 6, INK);
    rect(c, x, y + T - 6, T, 3, '#b9784a');
    rect(c, x + 2, y + T - 12, 4, 8, INK);
    rect(c, x + 3, y + T - 11, 2, 6, '#b9784a');
  }
}

function floor(c: Ctx, ch: string, x: number, y: number, tx: number, ty: number): void {
  switch (ch) {
    case '.':
      return grass(c, x, y, tx, ty);
    case 'f':
      return flowers(c, x, y, tx, ty);
    case 'p':
      return brick(c, x, y, tx, ty);
    case 's':
      return gravel(c, x, y, tx, ty);
    case 'o':
      grass(c, x, y, tx, ty);
      ellO(c, x + 16, y + 18, 11, 8, '#d9cfc0');
      ell(c, x + 14, y + 16, 7, 4, '#ece5d9');
      return;
    case 'k':
      return wood(c, x, y, tx, ty);
    case 'c':
      return libraryCarpet(c, x, y, tx, ty);
    case 'm':
      return roomCarpet(c, x, y, tx, ty);
    case 'q':
      return cafeTiles(c, x, y);
    case 'd':
      return deck(c, x, y, tx, ty);
    case 'g':
      return stageBoards(c, x, y, tx, ty);
    case 'e':
      grass(c, x, y, tx, ty);
      for (let i = 0; i < 3; i++) {
        rect(c, x, y + i * 10, T, 10, INK);
        rect(c, x + 2, y + i * 10, T - 4, 6, i === 0 ? '#c4874e' : '#b5763f');
        rect(c, x + 2, y + i * 10 + 6, T - 4, 2, '#8a552e');
      }
      return;
    case 'a':
      return amphitheater(c, x, y, tx, ty);
    case 'l':
      return lobbyTiles(c, x, y, tx, ty);
    case 'v':
      return arcadeCarpet(c, x, y, tx, ty);
    case 'u':
      return rug(c, x, y, tx, ty);
    case 'x':
      return doormat(c, x, y, tx, ty);
    case 'y':
    case 'w':
      return grass(c, x, y, tx, ty);
  }
}

// ---------------------------------------------------------------------------
// Walls and hedges

function wall(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const zone = wallZone(tx, ty);
  const st = WALLS[zone] ?? WALLS.office!;
  const face = !isWall(tx, ty + 1);
  const northWall = isWall(tx, ty - 1) || ty === 0;
  if (!face) {
    rect(c, x, y, T, T, st.cap);
    rect(c, x, y, T, 2, st.capL);
    if (hash(tx, ty, 5) > 0.5) rect(c, x + 8 + Math.floor(hash(tx, ty, 6) * 8) * 2, y + 10, 6, 2, st.capL);
    c.fillStyle = INK;
    if (!isWall(tx - 1, ty)) c.fillRect(x, y, 2, T);
    if (!isWall(tx + 1, ty)) c.fillRect(x + T - 2, y, 2, T);
    if (!northWall) c.fillRect(x, y, T, 2);
    return;
  }
  // a wall face, seen from the south
  const south = tileAt(tx, ty + 1);
  const outdoor = OUTDOOR_FLOORS.has(FLOORS.has(south) ? south : baseFloor(south, tx, ty + 1)) && !INDOOR_AREAS.has(areaIdAt(tx, ty + 1));
  let fy = y;
  if (!northWall) {
    // single-row wall: the top of the wall is a band at the top of the tile
    rect(c, x, y, T, 8, st.cap);
    rect(c, x, y, T, 2, INK);
    rect(c, x, y + 2, T, 2, st.capL);
    fy = y + 8;
  }
  const fh = y + T - fy;
  if (outdoor) {
    // outside of a building: warm plaster with a timber band and windows
    rect(c, x, fy, T, fh, '#f7e3c4');
    rect(c, x, fy, T, 2, '#e8cfa8');
    // stone plinth
    rect(c, x, y + T - 6, T, 4, '#d9c7ad');
    rect(c, x + ((tx % 2) * 16) + 6, y + T - 6, 2, 4, '#bfae95');
    rect(c, x, y + T - 2, T, 2, INK);
    const doorNear = !isWall(tx - 1, ty) || !isWall(tx + 1, ty);
    const k = (tx + (ty % 2)) % 3;
    if (!doorNear && k !== 2) {
      // window with shutters and a flower box
      rect(c, x + 3, fy + 2, 5, 14, st.trim);
      rect(c, x + 24, fy + 2, 5, 14, st.trim);
      rect(c, x + 4, fy + 4, 3, 1, st.capL);
      rect(c, x + 25, fy + 4, 3, 1, st.capL);
      box(c, x + 8, fy + 1, 16, 15, '#9fd0ff');
      rect(c, x + 10, fy + 3, 12, 4, '#ffe9a8');
      rect(c, x + 15, fy + 3, 2, 11, INK);
      rect(c, x + 6, fy + 15, 20, 4, INK);
      rect(c, x + 7, fy + 16, 18, 2, WOOD);
      for (let i = 0; i < 5; i++) rect(c, x + 8 + i * 4, fy + 13, 2, 2, [CORAL, MUSTARD, '#ff9fc4', CORAL, PAPER][(i + tx) % 5]!);
    } else if (!doorNear) {
      // wall lantern
      rect(c, x + 15, fy + 1, 2, 3, INK);
      rect(c, x + 11, fy + 4, 10, 10, INK);
      rect(c, x + 13, fy + 6, 6, 6, MUSTARD);
      rect(c, x + 14, fy + 7, 2, 3, '#fff2b8');
      ell(c, x + 16, fy + 10, 12, 8, 'rgba(255,214,120,0.18)');
    }
  } else {
    // inside: wallpaper with stripes, chair rail and baseboard
    rect(c, x, fy, T, fh, st.paper);
    for (let i = 0; i < 32; i += 8) rect(c, x + i + 2, fy, 2, fh, st.stripe);
    if (northWall) {
      rect(c, x, fy, T, 4, st.cap);
      rect(c, x, fy + 4, T, 2, INK);
    }
    rect(c, x, y + T - 7, T, 5, st.trim);
    rect(c, x, y + T - 7, T, 1, st.paperL);
    rect(c, x, y + T - 2, T, 2, INK);
    if (tileAt(tx, ty) === '#') wallDecor(c, x, y, tx, ty, zone, st, fy);
  }
  // door jambs / outside corners
  if (!isWall(tx - 1, ty)) {
    rect(c, x, fy, 4, y + T - fy, st.trim);
    rect(c, x, fy, 2, y + T - fy, INK);
  }
  if (!isWall(tx + 1, ty)) {
    rect(c, x + T - 4, fy, 4, y + T - fy, st.trim);
    rect(c, x + T - 2, fy, 2, y + T - fy, INK);
  }
  // soft shadow on the floor below the wall
  rect(c, x, y + T, T, 4, 'rgba(43,36,51,0.16)');
}

/** Posters, frames, clocks and windows on inside walls. */
function wallDecor(c: Ctx, x: number, y: number, tx: number, ty: number, zone: string, st: WallStyle, fy: number): void {
  const r = hash(tx, ty, 21);
  const below = tileAt(tx, ty + 1);
  if (below === 'L' || below === 'V' || below === 'O' || below === 'K') {
    if (below === 'K' && zone === 'cafe') {
      // menu board above the counter
      box(c, x + 2, fy + 2, 28, 16, '#3a3148');
      for (let i = 0; i < 3; i++) rect(c, x + 6, fy + 6 + i * 4, 10 + ((tx + i) % 3) * 4, 2, i === 0 ? MUSTARD : PAPER);
    }
    return;
  }
  if (!isWall(tx - 1, ty) || !isWall(tx + 1, ty)) return;
  const top = fy + (fy === y ? 6 : 2);
  if (zone === 'game') {
    if (r > 0.5) {
      // neon sign
      rect(c, x + 6, top + 4, 20, 2, r > 0.75 ? MINT : '#ff9fc4');
      rect(c, x + 6, top + 4, 2, 10, r > 0.75 ? MINT : '#ff9fc4');
      rect(c, x + 6, top + 12, 20, 2, r > 0.75 ? MINT : '#ff9fc4');
      rect(c, x + 14, top + 7, 4, 4, MUSTARD);
    } else if (r > 0.25) {
      for (let i = 0; i < 3; i++) rect(c, x + 6 + i * 8, top + 6 + (i % 2) * 4, 4, 4, [MUSTARD, CORAL, SKY][i]!);
    }
    return;
  }
  if (zone === 'library') {
    if (r > 0.45) {
      box(c, x + 7, top + 2, 18, 14, MUSTARD_D);
      rect(c, x + 9, top + 4, 14, 10, r > 0.7 ? '#9fd0ff' : '#f7d9a8');
      rect(c, x + 9, top + 10, 14, 4, '#5fb35a');
    }
    return;
  }
  if (r > 0.72) {
    // window
    box(c, x + 5, top, 22, 16, '#a8d8ff');
    rect(c, x + 7, top + 2, 18, 4, PAPER);
    rect(c, x + 15, top + 2, 2, 12, INK);
    rect(c, x + 3, top + 14, 26, 2, st.trim);
  } else if (r > 0.5) {
    // poster
    const col = pick([CORAL, MINT, MUSTARD, SKY, PLUM], hash(tx, ty, 22));
    box(c, x + 8, top, 16, 18, PAPER);
    rect(c, x + 10, top + 2, 12, 8, col);
    rect(c, x + 10, top + 12, 10, 2, INK);
    rect(c, x + 10, top + 15, 6, 1, INK);
  } else if (r > 0.38) {
    // clock
    ellO(c, x + 16, top + 8, 7, 7, PAPER);
    rect(c, x + 15, top + 3, 2, 6, INK);
    rect(c, x + 15, top + 8, 5, 2, INK);
  } else if (r > 0.28 && zone === 'cafe') {
    for (let i = 0; i < 3; i++) {
      rect(c, x + 6 + i * 8, top + 4, 6, 2, WOOD_D);
      rect(c, x + 7 + i * 8, top + 6, 4, 4, pick([CORAL, MINT, PAPER], hash(tx, i, 3)));
    }
  }
}

function fireplace(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const l = tileAt(tx - 1, ty) === '&';
  const r = tileAt(tx + 1, ty) === '&';
  rect(c, x, y, T, T, '#d9c7ad');
  for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) rect(c, x + i * 16 + (j % 2) * 8, y + j * 8, 14, 6, '#e8d9c2');
  rect(c, x, y, T, 4, '#8a5a3c');
  rect(c, x, y + 4, T, 2, INK);
  if (!l) rect(c, x, y, 2, T, INK);
  if (!r) rect(c, x + T - 2, y, 2, T, INK);
  if (l && r) {
    // fire box
    rect(c, x - 4, y + 10, T + 8, 22, INK);
    rect(c, x - 2, y + 12, T + 4, 20, '#3a2530');
    ell(c, x + 16, y + 26, 12, 6, CORAL);
    ell(c, x + 14, y + 24, 6, 8, MUSTARD);
    ell(c, x + 20, y + 26, 4, 5, '#ffe08a');
    rect(c, x + 4, y + 28, 24, 4, '#6b4637');
  } else {
    // candles on the mantel
    rect(c, x + (l ? 8 : 18), y - 4, 4, 8, PAPER);
    rect(c, x + (l ? 9 : 19), y - 7, 2, 3, MUSTARD);
  }
}

function hedge(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const isH = (dx: number, dy: number) => {
    const ch = tileAt(tx + dx, ty + dy);
    return ch === 'H' || ch === '#' || ch === 'Q';
  };
  const face = !isH(0, 1) && ty < MAP_H - 1;
  rect(c, x, y, T, T, '#3f8f45');
  for (let i = 0; i < 4; i++) {
    const bx = x + 2 + Math.floor(hash(tx, ty, i + 1) * 11) * 2;
    const by = y + 2 + Math.floor(hash(tx, ty, i + 5) * (face ? 6 : 11)) * 2;
    ell(c, bx + 4, by + 4, 6, 5, '#56a957');
    rect(c, bx + 2, by + 1, 4, 2, '#7cc76b');
  }
  if (hash(tx, ty, 40) > 0.85) {
    rect(c, x + 12, y + 8, 4, 4, '#ff9fc4');
    rect(c, x + 13, y + 9, 2, 2, PAPER);
  }
  if (face) {
    rect(c, x, y + 20, T, 12, '#2f7038');
    for (let i = 0; i < 32; i += 6) rect(c, x + i, y + 18, 4, 4, '#3f8f45');
    rect(c, x, y + 30, T, 2, '#1f4a29');
    rect(c, x, y + T, T, 4, 'rgba(43,36,51,0.18)');
  }
  c.fillStyle = '#1f4a29';
  if (!isH(-1, 0)) c.fillRect(x, y, 2, T);
  if (!isH(1, 0)) c.fillRect(x + T - 2, y, 2, T);
  if (!isH(0, -1)) c.fillRect(x, y, T, 2);
}

// ---------------------------------------------------------------------------
// Furniture

/** Multi-tile furniture (desk island, table, counter): outline only on the outside edges. */
function slab(c: Ctx, ch: string, x: number, y: number, tx: number, ty: number, topCol: string, frontCol: string, inset = 2): { top: boolean; bottom: boolean; left: boolean; right: boolean } {
  const same = (dx: number, dy: number) => tileAt(tx + dx, ty + dy) === ch;
  const left = !same(-1, 0);
  const right = !same(1, 0);
  const top = !same(0, -1);
  const bottom = !same(0, 1);
  const x0 = x + (left ? inset : 0);
  const x1 = x + T - (right ? inset : 0);
  const y0 = y + (top ? 2 : 0);
  const y1 = y + T - (bottom ? 2 : 0);
  if (bottom) rect(c, x0 + 2, y + T, x1 - x0, 4, SHADOW);
  rect(c, x0, y0, x1 - x0, y1 - y0, INK);
  const ix0 = x0 + (left ? 2 : 0);
  const ix1 = x1 - (right ? 2 : 0);
  const iy0 = y0 + (top ? 2 : 0);
  const frontH = bottom ? 8 : 0;
  rect(c, ix0, iy0, ix1 - ix0, y1 - iy0 - (bottom ? 2 : 0) - frontH, topCol);
  if (top) rect(c, ix0, iy0, ix1 - ix0, 2, 'rgba(255,255,255,0.35)');
  if (bottom) rect(c, ix0, y1 - 2 - frontH, ix1 - ix0, frontH, frontCol);
  if (bottom) rect(c, ix0, y1 - 2 - frontH, ix1 - ix0, 2, INK);
  return { top, bottom, left, right };
}

function desk(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  let px = tx;
  let py = ty;
  while (tileAt(px - 1, ty) === 'D') px--;
  while (tileAt(tx, py - 1) === 'D') py--;
  const podTop = pick(['#ffe0a3', '#ffd0c4', '#c9f0e4', '#dcd2ff'], hash(px, py, 31));
  const e = slab(c, 'D', x, y, tx, ty, podTop, WOOD);
  const r = hash(tx, ty, 7);
  const screen = pick(['#86d9f5', '#9be3c2', '#ffd38a', '#c9b8ff'], hash(tx, ty, 9));
  if (e.top) {
    // monitor seen from behind (it faces the chair above), keyboard below it
    rect(c, x + 6, y + 6, 20, 12, INK);
    rect(c, x + 8, y + 8, 16, 8, '#4a4060');
    rect(c, x + 14, y + 18, 4, 3, INK);
    if (r > 0.6) rect(c, x + 2, y + 20, 6, 6, pick([CORAL, MINT, SKY], r));
  } else {
    rect(c, x + 6, y - 2, 20, 2, MINT);
    rect(c, x + 6, y + 2, 20, 12, INK);
    rect(c, x + 8, y + 4, 16, 8, screen);
    rect(c, x + 10, y + 6, 8, 2, PAPER);
    rect(c, x + 14, y + 14, 4, 2, INK);
    rect(c, x + 8, y + 17, 16, 3, '#e9e3f0');
    if (r > 0.7) {
      rect(c, x + 26, y + 6, 4, 6, PAPER);
      rect(c, x + 26, y + 6, 4, 2, CORAL);
    } else if (r < 0.25) {
      rect(c, x + 2, y + 4, 4, 8, '#5fb35a');
      rect(c, x + 2, y + 10, 4, 4, CORAL_D);
    }
  }
}

function meetingTable(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  slab(c, 'M', x, y, tx, ty, '#f6dcae', '#c98d5a');
  const r = hash(tx, ty, 7);
  if (r > 0.72) {
    rect(c, x + 8, y + 6, 16, 10, INK);
    rect(c, x + 10, y + 8, 12, 6, '#9fd0ff');
    rect(c, x + 6, y + 16, 20, 3, '#c9c3d6');
  } else if (r > 0.45) {
    rect(c, x + 10, y + 8, 10, 12, PAPER);
    rect(c, x + 12, y + 11, 6, 1, INK);
    rect(c, x + 12, y + 14, 4, 1, INK);
  } else if (r > 0.25) {
    rect(c, x + 12, y + 10, 6, 6, PAPER);
    rect(c, x + 13, y + 11, 4, 2, '#7a4a2a');
  }
}

function readingTable(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const e = slab(c, 'R', x, y, tx, ty, '#b97a4c', '#8a5a3c');
  const r = hash(tx, ty, 7);
  if (r > 0.5) {
    // open book
    rect(c, x + 6, y + 8, 20, 12, INK);
    rect(c, x + 7, y + 9, 8, 10, PAPER);
    rect(c, x + 17, y + 9, 8, 10, PAPER);
    for (let i = 0; i < 3; i++) {
      rect(c, x + 8, y + 11 + i * 3, 6, 1, '#b5aac2');
      rect(c, x + 18, y + 11 + i * 3, 6, 1, '#b5aac2');
    }
  } else if (e.top) {
    // green banker's lamp
    rect(c, x + 14, y + 10, 4, 8, INK);
    rect(c, x + 8, y + 4, 16, 8, INK);
    rect(c, x + 10, y + 6, 12, 4, MINT_D);
    ell(c, x + 16, y + 18, 10, 4, 'rgba(255,230,150,0.35)');
  } else {
    for (let i = 0; i < 3; i++) rect(c, x + 8, y + 6 + i * 4, 16, 4, [CORAL, SKY, MUSTARD][i]!);
  }
}

function counter(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const zone = areaIdAt(tx, ty);
  const cafe = zone === 'cafe';
  const e = slab(c, 'K', x, y, tx, ty, cafe ? '#fff6e5' : PAPER, cafe ? '#a8603f' : MINT);
  if (e.bottom) for (let i = 4; i < 32; i += 10) rect(c, x + i, y + 22, 2, 6, cafe ? '#8a4a30' : MINT_D);
  const i = tx - (cafe ? 63 : 36);
  if (cafe) {
    if (i === 1) {
      // espresso machine
      box(c, x + 4, y - 6, 24, 20, '#c9c3d6');
      rect(c, x + 8, y - 2, 16, 4, INK);
      rect(c, x + 10, y + 8, 4, 4, PAPER);
      rect(c, x + 18, y + 8, 4, 4, PAPER);
    } else if (i === 3) {
      // cake dome
      ellO(c, x + 16, y + 8, 11, 8, 'rgba(220,240,255,0.9)');
      rect(c, x + 10, y + 8, 12, 6, '#ffcfd9');
      rect(c, x + 10, y + 8, 12, 2, CORAL);
    } else if (i === 5) {
      rect(c, x + 6, y + 4, 8, 10, '#b5e6ff');
      rect(c, x + 18, y + 6, 8, 8, PAPER);
      rect(c, x + 20, y + 8, 4, 4, '#7a4a2a');
    } else if (i === 6) {
      // register
      box(c, x + 6, y + 2, 20, 14, '#3a3148');
      rect(c, x + 10, y + 4, 12, 4, MINT);
    } else if (i === 0 || i === 7) {
      rect(c, x + 10, y + 4, 12, 10, MUSTARD);
      rect(c, x + 12, y + 2, 8, 4, '#f6d2b8');
    }
  } else {
    if (i === 0) {
      rect(c, x + 10, y + 6, 10, 8, '#5fb35a');
      rect(c, x + 8, y + 2, 4, 4, CORAL);
      rect(c, x + 16, y + 2, 4, 4, MUSTARD);
      rect(c, x + 12, y + 0, 4, 4, '#ff9fc4');
    } else if (i === 2) {
      // the welcome cat
      ellO(c, x + 16, y + 6, 8, 7, '#f39a4a');
      rect(c, x + 8, y - 6, 4, 6, INK);
      rect(c, x + 20, y - 6, 4, 6, INK);
      rect(c, x + 10, y - 4, 2, 4, '#f39a4a');
      rect(c, x + 22, y - 4, 2, 4, '#f39a4a');
      ell(c, x + 16, y - 2, 8, 6, INK);
      ell(c, x + 16, y - 2, 6, 5, '#f39a4a');
      rect(c, x + 12, y - 3, 2, 2, INK);
      rect(c, x + 18, y - 3, 2, 2, INK);
      rect(c, x + 15, y, 2, 1, CORAL);
      rect(c, x + 24, y + 6, 6, 2, '#f39a4a');
    } else if (i === 4) {
      // bell
      rect(c, x + 10, y + 12, 12, 2, INK);
      ell(c, x + 16, y + 9, 5, 4, MUSTARD);
      rect(c, x + 15, y + 3, 2, 2, INK);
    } else if (i === 3) {
      rect(c, x + 6, y + 6, 18, 10, INK);
      rect(c, x + 8, y + 8, 14, 6, '#9fd0ff');
    }
  }
}

function cafeTable(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const long = tileAt(tx - 1, ty) === 'C' || tileAt(tx + 1, ty) === 'C';
  if (long) {
    slab(c, 'C', x, y + 4, tx, ty, '#fff1dc', WOOD);
    if (hash(tx, ty, 3) > 0.4) {
      rect(c, x + 10, y + 10, 8, 6, PAPER);
      rect(c, x + 12, y + 11, 4, 3, '#7a4a2a');
    } else rect(c, x + 8, y + 10, 14, 6, MUSTARD);
    return;
  }
  ell(c, x + 18, y + 28, 12, 4, SHADOW);
  rect(c, x + 14, y + 16, 4, 12, INK);
  rect(c, x + 10, y + 26, 12, 3, INK);
  ellO(c, x + 16, y + 13, 12, 8, PAPER);
  ell(c, x + 16, y + 17, 12, 4, '#e9dcc4');
  ell(c, x + 16, y + 12, 12, 7, PAPER);
  const r = hash(tx, ty, 4);
  rect(c, x + 8, y + 10, 6, 5, r > 0.5 ? CORAL : MINT);
  rect(c, x + 9, y + 11, 4, 2, PAPER);
  ell(c, x + 21, y + 13, 4, 3, '#e9dcc4');
  rect(c, x + 19, y + 10, 4, 3, r > 0.5 ? '#ffcfd9' : MUSTARD);
}

function lowTable(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const zone = areaIdAt(tx, ty);
  if (zone === 'garden') {
    // picnic basket and snacks
    if (tileAt(tx - 1, ty) !== 't') {
      box(c, x + 6, y + 8, 22, 16, '#d19a5c');
      rect(c, x + 8, y + 12, 18, 2, '#a8703f');
      rect(c, x + 8, y + 18, 18, 2, '#a8703f');
      rect(c, x + 12, y + 2, 10, 2, INK);
      rect(c, x + 10, y + 4, 2, 6, INK);
      rect(c, x + 22, y + 4, 2, 6, INK);
    } else {
      ellO(c, x + 12, y + 16, 8, 5, PAPER);
      rect(c, x + 8, y + 13, 4, 4, CORAL);
      rect(c, x + 13, y + 14, 4, 3, MUSTARD);
      box(c, x + 22, y + 8, 6, 12, '#ffcfd9');
    }
    return;
  }
  const e = slab(c, 't', x, y + 4, tx, ty, zone === 'game' ? '#4a4060' : '#b9784a', zone === 'game' ? INK : '#8a5a3c', 4);
  const r = hash(tx, ty, 5);
  if (zone === 'game') {
    let run = 1;
    while (tileAt(tx - run, ty) === 't') run++;
    let runR = 1;
    while (tileAt(tx + runR, ty) === 't') runR++;
    if (run + runR - 1 === 2) {
      // board game, drawn once from the right half so it spans both tiles
      if (e.right) {
        const bx = x - 18;
        rect(c, bx - 2, y + 6, 36, 20, INK);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) rect(c, bx + i * 4, y + 8 + j * 4, 4, 4, (i + j) % 2 ? PAPER : '#c9b8ff');
        ellO(c, bx + 6, y + 14, 2, 2, CORAL);
        ellO(c, bx + 22, y + 18, 2, 2, SKY);
      }
      return;
    }
    // retro TV and console
    if (!e.left && !e.right) {
      box(c, x + 2, y - 10, 28, 22, '#3a3148');
      rect(c, x + 5, y - 7, 22, 15, '#5fe0c0');
      rect(c, x + 8, y - 4, 4, 4, MUSTARD);
      rect(c, x + 16, y, 6, 2, CORAL);
      rect(c, x + 12, y + 14, 8, 4, PAPER);
    } else {
      rect(c, x + 10, y + 12, 12, 6, e.left ? CORAL : SKY);
      rect(c, x + 12, y + 14, 2, 2, INK);
    }
    return;
  }
  if (r > 0.5) {
    rect(c, x + 8, y + 10, 6, 6, PAPER);
    rect(c, x + 9, y + 11, 4, 2, CORAL);
    rect(c, x + 18, y + 12, 8, 4, MUSTARD);
  } else {
    rect(c, x + 10, y + 10, 12, 6, pick([SKY, CORAL, MINT], r * 2));
    rect(c, x + 12, y + 12, 8, 2, PAPER);
  }
}

function bookshelf(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  const l = tileAt(tx - 1, ty) !== 'L';
  const r = tileAt(tx + 1, ty) !== 'L';
  const draw = (k: Ctx) => {
    rect(k, x, y - 14, T, T + 12, INK);
    rect(k, x + (l ? 2 : 0), y - 12, T - (l ? 2 : 0) - (r ? 2 : 0), T + 8, '#7a4a2a');
    rect(k, x + (l ? 2 : 0), y - 12, T - (l ? 2 : 0) - (r ? 2 : 0), 2, '#a86b3c');
    const books = [CORAL, SKY, MUSTARD, MINT, PLUM, PAPER, '#ff9fc4', CORAL_D];
    for (let row = 0; row < 3; row++) {
      const by = y - 10 + row * 12;
      rect(k, x + (l ? 2 : 0), by + 10, T - (l ? 2 : 0) - (r ? 2 : 0), 2, '#5a321a');
      let bx = x + (l ? 4 : 2);
      let i = 0;
      while (bx < x + T - (r ? 6 : 2)) {
        const w = 2 + Math.floor(hash(tx * 9 + i, ty * 3 + row, 3) * 2) * 2;
        const hgt = 7 + Math.floor(hash(tx * 9 + i, ty * 3 + row, 4) * 2) * 2;
        if (hash(tx * 9 + i, ty * 3 + row, 5) > 0.12) rect(k, bx, by + 10 - hgt, w, hgt, books[Math.floor(hash(tx * 9 + i, row, 6) * books.length)]!);
        bx += w + 1;
        i++;
      }
    }
  };
  rect(c, x + 2, y + T - 2, T, 4, SHADOW);
  draw(c);
  if (tileAt(tx, ty - 1) !== '#') draw(top);
}

function plant(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  const kind = Math.floor(hash(tx, ty, 12) * 4);
  ell(c, x + 17, y + 29, 10, 3, SHADOW);
  const leaves = (k: Ctx) => {
    if (kind === 0) {
      // monstera
      ellO(k, x + 10, y + 6, 8, 7, '#3f9b4f');
      ellO(k, x + 22, y + 4, 8, 8, '#4fb35e');
      ellO(k, x + 16, y - 4, 7, 8, '#5cc46a');
      rect(k, x + 20, y + 2, 2, 6, '#2f7a3f');
      rect(k, x + 8, y + 4, 2, 6, '#2f7a3f');
    } else if (kind === 1) {
      // tall snake plant
      for (const [lx, h, col] of [[9, 22, '#3f9b4f'], [14, 30, '#5cc46a'], [19, 26, '#4fb35e'], [23, 18, '#3f9b4f']] as const) {
        rect(k, x + lx - 1, y + 18 - h, 6, h + 2, INK);
        rect(k, x + lx, y + 19 - h, 4, h, col);
        rect(k, x + lx + 1, y + 21 - h, 2, h - 6, '#a6e57c');
      }
    } else if (kind === 2) {
      // flowering bush
      ellO(k, x + 16, y + 6, 12, 10, '#3f9b4f');
      ell(k, x + 13, y + 3, 6, 4, '#5cc46a');
      for (const [fx, fy] of [[9, 4], [18, 0], [22, 8], [13, 10], [17, 6]] as const) {
        rect(k, x + fx, y + fy, 4, 4, CORAL);
        rect(k, x + fx + 1, y + fy + 1, 2, 2, MUSTARD);
      }
    } else {
      // round topiary
      rect(k, x + 15, y + 6, 2, 12, '#7a4a2a');
      ellO(k, x + 16, y + 2, 11, 11, '#4fb35e');
      ell(k, x + 13, y - 2, 5, 4, '#7cd27a');
    }
  };
  leaves(c);
  // pot
  rect(c, x + 8, y + 16, 16, 14, INK);
  rect(c, x + 10, y + 18, 12, 10, kind === 1 ? PAPER : '#d0704a');
  rect(c, x + 6, y + 14, 20, 6, INK);
  rect(c, x + 8, y + 16, 16, 2, kind === 1 ? '#e9dcc4' : '#e8895e');
  rect(c, x + 12, y + 22, 4, 2, kind === 1 ? MINT : '#e8895e');
  leaves(top);
}

function tree(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  const kind = hash(tx, ty, 14);
  const [dark, mid, light] = kind < 0.25 ? ['#e9799a', '#ff9fb8', '#ffd0dc'] : kind < 0.45 ? ['#3a8a45', '#4fa95a', '#7cd27a'] : ['#358040', '#47a051', '#6fc76a'];
  ell(c, x + 18, y + 28, 22, 6, SHADOW);
  rect(c, x + 11, y + 6, 10, 24, INK);
  rect(c, x + 13, y + 6, 6, 22, '#8a5a3c');
  rect(c, x + 13, y + 6, 2, 22, '#a8703f');
  rect(c, x + 9, y + 26, 14, 4, INK);
  const crown = (k: Ctx) => {
    const cx = x + 16;
    const cy = y - 10;
    ell(k, cx, cy + 4, 24, 18, INK);
    ell(k, cx - 10, cy + 10, 14, 12, INK);
    ell(k, cx + 11, cy + 10, 14, 12, INK);
    ell(k, cx, cy + 4, 22, 16, dark);
    ell(k, cx - 10, cy + 10, 12, 10, dark);
    ell(k, cx + 11, cy + 10, 12, 10, dark);
    ell(k, cx - 2, cy, 18, 12, mid);
    ell(k, cx - 10, cy + 6, 9, 7, mid);
    ell(k, cx + 8, cy + 4, 10, 8, mid);
    ell(k, cx - 6, cy - 4, 7, 5, light);
    rect(k, cx + 6, cy - 2, 4, 2, light);
    if (kind > 0.75) for (const [fx, fy] of [[-12, 6], [6, -4], [12, 10], [-4, 12], [-2, -8]] as const) {
      rect(k, cx + fx, cy + fy, 4, 4, '#ff8a3d');
      rect(k, cx + fx, cy + fy, 2, 2, '#ffc27a');
    }
  };
  crown(c);
  crown(top);
}

function lampPost(c: Ctx, top: Ctx, x: number, y: number): void {
  ell(c, x + 16, y + 24, 22, 10, 'rgba(255,193,69,0.16)');
  ell(c, x + 17, y + 28, 7, 3, SHADOW);
  const draw = (k: Ctx, upper: boolean) => {
    if (!upper) {
      rect(k, x + 11, y + 22, 10, 8, INK);
      rect(k, x + 13, y + 22, 6, 6, '#4a4060');
    }
    rect(k, x + 14, y - 22, 4, upper ? 22 : 46, INK);
    rect(k, x + 15, y - 22, 1, upper ? 22 : 46, '#6a6080');
    rect(k, x + 8, y - 36, 16, 16, INK);
    rect(k, x + 10, y - 34, 12, 12, MUSTARD);
    rect(k, x + 12, y - 32, 4, 6, '#fff2b8');
    rect(k, x + 6, y - 38, 20, 4, INK);
    rect(k, x + 14, y - 42, 4, 4, INK);
  };
  draw(c, false);
  draw(top, true);
}

function planter(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const l = tileAt(tx - 1, ty) !== 'b';
  const r = tileAt(tx + 1, ty) !== 'b';
  rect(c, x + (l ? 2 : 0), y + T - 2, T - (l ? 2 : 0) - (r ? 0 : 0), 4, SHADOW);
  rect(c, x + (l ? 2 : 0), y + 10, T - (l ? 2 : 0) - (r ? 2 : 0), 20, INK);
  rect(c, x + (l ? 4 : 0), y + 18, T - (l ? 4 : 0) - (r ? 4 : 0), 10, '#b9784a');
  rect(c, x + (l ? 4 : 0), y + 18, T - (l ? 4 : 0) - (r ? 4 : 0), 2, '#d39d62');
  rect(c, x + (l ? 4 : 0), y + 12, T - (l ? 4 : 0) - (r ? 4 : 0), 6, '#6b4637');
  for (let i = 0; i < 4; i++) {
    const fx = x + 2 + i * 8;
    ell(c, fx + 3, y + 10, 5, 4, '#3f9b4f');
    rect(c, fx + 1, y + 6, 4, 4, [CORAL, MUSTARD, '#ff9fc4', PAPER][(i + tx) % 4]!);
    rect(c, fx + 2, y + 7, 2, 2, (i + tx) % 4 === 1 ? CORAL : MUSTARD);
  }
}

function rock(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  ell(c, x + 18, y + 26, 14, 5, SHADOW);
  ellO(c, x + 16, y + 18, 12, 10, '#bfb3a3');
  ell(c, x + 14, y + 16, 9, 6, '#d6ccbd');
  rect(c, x + 10, y + 12, 6, 2, '#ece5d9');
  if (hash(tx, ty, 2) > 0.5) ell(c, x + 20, y + 22, 5, 3, '#6fbf4a');
}

function fountain(c: Ctx, top: Ctx, x: number, y: number): void {
  const cx = x + 32;
  const cy = y + 36;
  ell(c, cx + 2, cy + 6, 32, 16, SHADOW);
  ellO(c, cx, cy, 30, 18, '#e8d9c0');
  ell(c, cx, cy + 6, 30, 12, '#cdbb9d');
  ell(c, cx, cy - 2, 24, 13, '#4ea3ef');
  ell(c, cx, cy - 4, 20, 9, '#69b4f5');
  rect(c, cx - 14, cy - 6, 6, 2, '#d8f1ff');
  rect(c, cx + 8, cy, 6, 2, '#d8f1ff');
  const jet = (k: Ctx) => {
    ellO(k, cx, cy - 6, 8, 5, '#e8d9c0');
    rect(k, cx - 3, cy - 26, 6, 20, INK);
    rect(k, cx - 1, cy - 26, 2, 20, '#e8d9c0');
    ellO(k, cx, cy - 28, 9, 4, '#e8d9c0');
    rect(k, cx - 2, cy - 44, 4, 14, '#b5e6ff');
    rect(k, cx - 1, cy - 44, 2, 12, PAPER);
    for (const s of [-1, 1]) {
      rect(k, cx + s * 6 - 1, cy - 42, 2, 6, '#b5e6ff');
      rect(k, cx + s * 10 - 1, cy - 36, 2, 6, '#b5e6ff');
      rect(k, cx + s * 12 - 1, cy - 28, 2, 4, '#b5e6ff');
    }
  };
  jet(c);
  jet(top);
}

function whiteboard(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  wall(c, x, y, tx, ty);
  const l = tileAt(tx - 1, ty) !== 'W';
  const r = tileAt(tx + 1, ty) !== 'W';
  const y0 = y + 6;
  rect(c, x + (l ? 2 : 0), y0, T - (l ? 2 : 0) - (r ? 2 : 0), 22, INK);
  rect(c, x + (l ? 4 : 0), y0 + 2, T - (l ? 4 : 0) - (r ? 4 : 0), 16, PAPER);
  rect(c, x + (l ? 4 : 0), y0 + 18, T - (l ? 4 : 0) - (r ? 4 : 0), 2, '#c9c3d6');
  const k = hash(tx, ty, 3);
  if (l) {
    rect(c, x + 8, y0 + 5, 14, 2, SKY);
    rect(c, x + 8, y0 + 9, 10, 2, SKY);
    rect(c, x + 8, y0 + 13, 16, 2, INK);
  } else if (r) {
    rect(c, x + 4, y0 + 4, 8, 8, MUSTARD);
    rect(c, x + 14, y0 + 6, 8, 8, '#ff9fc4');
    rect(c, x + 6, y0 + 15, 10, 1, CORAL);
  } else {
    rect(c, x + 4, y0 + 10, 4, 2, CORAL);
    rect(c, x + 8, y0 + 8, 4, 2, CORAL);
    rect(c, x + 12, y0 + 6, 4, 2, CORAL);
    rect(c, x + 16, y0 + 9, 4, 2, CORAL);
    rect(c, x + 20, y0 + 5, 6, 2, CORAL);
    if (k > 0.5) rect(c, x + 6, y0 + 13, 12, 2, MINT);
  }
  // marker tray
  rect(c, x + (l ? 2 : 0), y0 + 20, T - (l ? 2 : 0) - (r ? 2 : 0), 3, '#9a92ab');
  if (r) {
    rect(c, x + 10, y0 + 19, 6, 2, CORAL);
    rect(c, x + 18, y0 + 19, 6, 2, SKY);
  }
}

function vending(c: Ctx, x: number, y: number, tx: number): void {
  const drinks = tx % 2 === 0;
  const body = drinks ? CORAL : MINT;
  const dark = drinks ? CORAL_D : MINT_D;
  rect(c, x + 3, y + T - 2, 28, 4, SHADOW);
  rect(c, x + 1, y - 18, 30, 48, INK);
  rect(c, x + 3, y - 16, 26, 44, body);
  rect(c, x + 3, y - 16, 26, 4, dark);
  rect(c, x + 5, y - 10, 16, 24, INK);
  rect(c, x + 6, y - 9, 14, 22, '#dff3ff');
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 3; i++) {
      const col = drinks ? [SKY, MUSTARD, '#ff9fc4'][(i + row) % 3]! : [MUSTARD, CORAL, PLUM][(i + row) % 3]!;
      if (drinks) {
        rect(c, x + 7 + i * 4, y - 7 + row * 7, 3, 5, col);
        rect(c, x + 8 + i * 4, y - 8 + row * 7, 1, 1, col);
      } else rect(c, x + 7 + i * 4, y - 6 + row * 7, 4, 4, col);
    }
  rect(c, x + 23, y - 8, 4, 2, PAPER);
  rect(c, x + 23, y - 4, 4, 2, MUSTARD);
  rect(c, x + 23, y, 4, 2, PAPER);
  rect(c, x + 6, y + 18, 16, 6, INK);
  rect(c, x + 3, y + 26, 26, 2, dark);
}

function photoSpot(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  if (tileAt(tx - 1, ty) === 'F') return;
  let w = 0;
  while (tileAt(tx + w, ty) === 'F') w++;
  const W = w * T;
  rect(c, x + 4, y + T - 2, W - 4, 4, SHADOW);
  const draw = (k: Ctx) => {
    // posts
    rect(k, x + 2, y - 30, 8, 60, INK);
    rect(k, x + 4, y - 28, 4, 56, WOOD);
    rect(k, x + W - 10, y - 30, 8, 60, INK);
    rect(k, x + W - 8, y - 28, 4, 56, WOOD);
    // backdrop panel
    rect(k, x + 8, y - 22, W - 16, 46, INK);
    rect(k, x + 10, y - 20, W - 20, 42, '#ffd9c9');
    for (let i = 0; i < W - 20; i += 12) rect(k, x + 10 + i, y - 20, 6, 42, '#ffe8de');
    // frame in the middle
    rect(k, x + W / 2 - 22, y - 14, 44, 30, INK);
    rect(k, x + W / 2 - 20, y - 12, 40, 26, MUSTARD);
    rect(k, x + W / 2 - 16, y - 8, 32, 18, '#9fd0ff');
    ell(k, x + W / 2 + 8, y - 2, 4, 4, PAPER);
    rect(k, x + W / 2 - 16, y + 4, 32, 6, '#7cd27a');
    // camera icon
    rect(k, x + W / 2 - 6, y + 16, 12, 6, INK);
    rect(k, x + W / 2 - 2, y + 17, 4, 4, PAPER);
    // balloon arch
    const cols = [CORAL, MUSTARD, MINT, SKY, '#ff9fc4', PLUM];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (i / (n - 1));
      const bx = Math.round(x + W / 2 - Math.cos(a) * (W / 2 - 6));
      const by = Math.round(y - 18 - Math.sin(a) * 22);
      ellO(k, bx, by, 6, 7, cols[i % cols.length]!);
      rect(k, bx - 3, by - 4, 2, 2, PAPER);
    }
  };
  draw(c);
  draw(top);
}

function noticeBoard(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  if (tileAt(tx - 1, ty) === 'N') return;
  rect(c, x + 4, y + T - 2, 2 * T - 6, 4, SHADOW);
  const draw = (k: Ctx) => {
    rect(k, x + 6, y + 10, 4, 20, INK);
    rect(k, x + 54, y + 10, 4, 20, INK);
    rect(k, x + 2, y - 18, 60, 32, INK);
    rect(k, x + 4, y - 16, 56, 28, '#d9a066');
    rect(k, x + 8, y - 12, 14, 12, PAPER);
    rect(k, x + 10, y - 9, 10, 1, INK);
    rect(k, x + 10, y - 6, 8, 1, INK);
    rect(k, x + 26, y - 14, 12, 10, MUSTARD);
    rect(k, x + 42, y - 12, 14, 14, '#9fd0ff');
    rect(k, x + 26, y - 2, 12, 10, '#ff9fc4');
    for (const [px, py] of [[14, -13], [31, -15], [48, -13], [31, -3]] as const) rect(k, x + px, y + py, 2, 2, CORAL_D);
  };
  draw(c);
  draw(top);
}

function piano(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  if (tileAt(tx - 1, ty) === 'I') return;
  rect(c, x + 4, y + T - 2, 60, 4, SHADOW);
  const draw = (k: Ctx) => {
    rect(k, x + 2, y - 16, 60, 46, INK);
    rect(k, x + 4, y - 14, 56, 26, '#4a3448');
    rect(k, x + 4, y - 14, 56, 2, '#6a5068');
    rect(k, x + 22, y - 10, 20, 10, PAPER);
    rect(k, x + 24, y - 8, 16, 1, INK);
    rect(k, x + 24, y - 5, 12, 1, INK);
    rect(k, x + 4, y + 12, 56, 8, PAPER);
    for (let i = 0; i < 13; i++) if (i % 7 !== 2 && i % 7 !== 6) rect(k, x + 7 + i * 4, y + 12, 2, 5, INK);
    rect(k, x + 4, y + 20, 56, 8, '#3a2838');
  };
  draw(c);
  draw(top);
}

function arcade(c: Ctx, x: number, y: number, tx: number): void {
  const body = [PLUM, CORAL, SKY, MINT, MUSTARD_D][tx % 5]!;
  rect(c, x + 3, y + T - 2, 28, 4, SHADOW);
  rect(c, x + 2, y - 18, 28, 48, INK);
  rect(c, x + 4, y - 16, 24, 44, body);
  rect(c, x + 4, y - 16, 24, 8, MUSTARD);
  rect(c, x + 8, y - 14, 16, 4, CORAL);
  rect(c, x + 6, y - 6, 20, 16, INK);
  rect(c, x + 8, y - 4, 16, 12, '#1a1630');
  rect(c, x + 10, y, 2, 2, MINT);
  rect(c, x + 16, y - 2, 2, 2, MUSTARD);
  rect(c, x + 20, y + 4, 2, 2, CORAL);
  rect(c, x + 12, y + 4, 6, 2, SKY);
  rect(c, x + 4, y + 12, 24, 6, '#3a3148');
  rect(c, x + 9, y + 9, 2, 5, INK);
  rect(c, x + 8, y + 8, 4, 3, CORAL);
  rect(c, x + 17, y + 13, 3, 3, MUSTARD);
  rect(c, x + 22, y + 13, 3, 3, MINT);
}

function pingPong(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  if (tileAt(tx - 1, ty) === 'G' || tileAt(tx, ty - 1) === 'G') return;
  let w = 0;
  while (tileAt(tx + w, ty) === 'G') w++;
  let h = 0;
  while (tileAt(tx, ty + h) === 'G') h++;
  const W = w * T;
  const H = h * T;
  rect(c, x + 6, y + H - 2, W - 8, 4, SHADOW);
  rect(c, x + 2, y + 4, W - 4, H - 8, INK);
  rect(c, x + 4, y + 6, W - 8, H - 20, '#1f9c84');
  rect(c, x + 4, y + H - 14, W - 8, 6, '#147060');
  rect(c, x + 6, y + 8, W - 12, 2, PAPER);
  rect(c, x + 6, y + H - 18, W - 12, 2, PAPER);
  rect(c, x + 6, y + 8, 2, H - 24, PAPER);
  rect(c, x + W - 8, y + 8, 2, H - 24, PAPER);
  rect(c, x + 6, y + (H - 12) / 2 + 2, W - 12, 1, 'rgba(255,255,255,0.6)');
  // net
  rect(c, x + W / 2 - 1, y, 3, H - 10, INK);
  rect(c, x + W / 2, y + 2, 1, H - 14, PAPER);
  // paddles and ball
  ellO(c, x + 22, y + 20, 5, 5, CORAL);
  rect(c, x + 20, y + 26, 4, 6, '#8a5a3c');
  ellO(c, x + W - 22, y + H - 26, 5, 5, SKY);
  rect(c, x + W / 2 + 12, y + 16, 4, 4, PAPER);
  rect(c, x + 8, y + H - 8, 4, 8, INK);
  rect(c, x + W - 12, y + H - 8, 4, 8, INK);
}

function parasolTable(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  cafeTable(c, x, y, tx, ty);
  const canopy = (k: Ctx) => {
    rect(k, x + 15, y - 8, 2, 20, INK);
    ell(k, x + 16, y - 10, 22, 10, INK);
    ell(k, x + 16, y - 10, 20, 8, PAPER);
    for (let i = -18; i < 18; i += 8) rect(k, x + 16 + i, y - 16, 4, 12, CORAL);
    ell(k, x + 16, y - 14, 4, 3, MUSTARD);
    rect(k, x - 4, y - 4, 40, 2, INK);
    for (let i = -4; i < 36; i += 6) rect(k, x + i, y - 2, 3, 2, (i / 6) % 2 ? CORAL : PAPER);
  };
  canopy(c);
  canopy(top);
}

function speaker(c: Ctx, top: Ctx, x: number, y: number): void {
  rect(c, x + 5, y + T - 2, 26, 4, SHADOW);
  const draw = (k: Ctx) => {
    rect(k, x + 4, y - 16, 24, 46, INK);
    rect(k, x + 6, y - 14, 20, 42, '#3a3148');
    ellO(k, x + 16, y - 4, 6, 6, '#5a5070');
    ell(k, x + 16, y - 4, 2, 2, INK);
    ellO(k, x + 16, y + 16, 8, 8, '#5a5070');
    ell(k, x + 16, y + 16, 3, 3, INK);
  };
  draw(c);
  draw(top);
}

function backdrop(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  if (tileAt(tx - 1, ty) === 'E') return;
  let w = 0;
  while (tileAt(tx + w, ty) === 'E') w++;
  const W = w * T;
  const draw = (k: Ctx) => {
    rect(k, x - 2, y - 26, W + 4, 58, INK);
    for (let i = 0; i < W; i += 8) {
      rect(k, x + i, y - 14, 8, 46, (i / 8) % 2 ? PLUM : PLUM_D);
      rect(k, x + i + 2, y - 14, 2, 46, '#9d84e8');
    }
    // valance with marquee lights
    rect(k, x, y - 24, W, 12, MUSTARD);
    rect(k, x, y - 14, W, 2, MUSTARD_D);
    for (let i = 0; i < W; i += 16) ell(k, x + i + 8, y - 12, 8, 4, MUSTARD);
    for (let i = 6; i < W; i += 12) rect(k, x + i, y - 20, 4, 4, PAPER);
    // star in the middle
    const cx = x + W / 2;
    const cy = y + 6;
    rect(k, cx - 2, cy - 12, 4, 24, MUSTARD);
    rect(k, cx - 12, cy - 2, 24, 4, MUSTARD);
    rect(k, cx - 6, cy - 6, 12, 12, MUSTARD);
    rect(k, cx - 2, cy - 2, 4, 4, PAPER);
  };
  draw(c);
  draw(top);
}

function stageFront(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  stageBoards(c, x, y - 0, tx, ty);
  rect(c, x, y + 6, T, 2, INK);
  rect(c, x, y + 8, T, 4, MUSTARD);
  rect(c, x, y + 12, T, 18, PLUM_D);
  for (let i = 2; i < 32; i += 8) rect(c, x + i, y + 12, 2, 18, PLUM);
  rect(c, x, y + 30, T, 2, INK);
  if (tx % 2 === 0) {
    rect(c, x + 12, y + 8, 8, 4, INK);
    rect(c, x + 14, y + 8, 4, 2, '#fff2b8');
  }
  if (tileAt(tx - 1, ty) !== '^') rect(c, x, y + 6, 2, 26, INK);
  if (tileAt(tx + 1, ty) !== '^') rect(c, x + T - 2, y + 6, 2, 26, INK);
}

function gate(c: Ctx, top: Ctx, x: number, y: number, tx: number, ty: number): void {
  // the gate is drawn once, from its top-left post
  if (tileAt(tx - 1, ty) === 'Q' || tileAt(tx, ty - 1) === 'Q') {
    if (ty === MAP_H - 1 && tileAt(tx - 1, ty) === 'Q' && tileAt(tx + 1, ty) === 'Q') {
      // open gate: the brick path leads out
      brick(c, x, y, tx, ty);
    }
    return;
  }
  let w = 1;
  while (w < 12 && tileAt(tx + w, ty) !== 'Q') w++;
  if (w >= 12) return;
  const W = w * T;
  const post = (k: Ctx, px: number, upper: boolean) => {
    rect(k, px + 4, y - 40, 24, upper ? 40 : 104, INK);
    rect(k, px + 6, y - 38, 20, upper ? 38 : 100, '#e8d9c0');
    for (let j = -38; j < (upper ? 0 : 62); j += 10) rect(k, px + 6, y + j + 8, 20, 2, '#cdbb9d');
    rect(k, px + 2, y - 44, 28, 6, INK);
    rect(k, px + 4, y - 42, 24, 2, PAPER);
    ellO(k, px + 16, y - 50, 6, 6, MUSTARD);
  };
  post(c, x, false);
  post(c, x + W, false);
  const arch = (k: Ctx) => {
    post(k, x, true);
    post(k, x + W, true);
    rect(k, x + 24, y - 36, W - 16, 22, INK);
    rect(k, x + 26, y - 34, W - 20, 18, CORAL);
    rect(k, x + 26, y - 34, W - 20, 2, '#ff9a88');
    for (let i = 30; i < W - 4; i += 12) rect(k, x + i, y - 14, 4, 4, MUSTARD);
    k.font = 'bold 13px system-ui, sans-serif';
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillStyle = PAPER;
    k.fillText('WELCOME', x + 16 + W / 2, y - 24);
    k.textAlign = 'start';
  };
  arch(c);
  arch(top);
}

// ---------------------------------------------------------------------------
// Seats

function seatColor(zone: string, tx: number, ty: number): [string, string] {
  switch (zone) {
    case 'office':
      return pick<[string, string]>([[MUSTARD, MUSTARD_D], [CORAL, CORAL_D], [MINT, MINT_D], [SKY, SKY_D]], hash(tx >> 1, ty, 3));
    case 'roomA':
      return [PAPER, '#e0c9bd'];
    case 'roomB':
      return [MUSTARD, MUSTARD_D];
    case 'roomC':
      return [CORAL, CORAL_D];
    case 'library':
      return ['#5fb08f', '#3d8a74'];
    case 'cafe':
      return [CORAL, CORAL_D];
    case 'lobby':
      return [SKY, SKY_D];
    case 'game':
      return [MINT, MINT_D];
    default:
      return [PLUM, PLUM_D];
  }
}

function chair(c: Ctx, x: number, y: number, tx: number, ty: number, dir: Dir): void {
  const [col, dark] = seatColor(areaIdAt(tx, ty), tx, ty);
  ell(c, x + 17, y + 27, 10, 3, SHADOW);
  rect(c, x + 14, y + 22, 4, 6, INK);
  box(c, x + 8, y + 12, 16, 12, col);
  rect(c, x + 10, y + 20, 12, 2, dark);
  if (dir === 'down') box(c, x + 8, y + 2, 16, 12, dark);
  else if (dir === 'up') box(c, x + 8, y + 18, 16, 10, dark);
  else if (dir === 'left') box(c, x + 20, y + 4, 6, 20, dark);
  else box(c, x + 6, y + 4, 6, 20, dark);
}

function stool(c: Ctx, x: number, y: number): void {
  ell(c, x + 17, y + 28, 8, 3, SHADOW);
  rect(c, x + 14, y + 18, 4, 10, INK);
  rect(c, x + 10, y + 26, 12, 2, INK);
  ellO(c, x + 16, y + 16, 8, 5, MUSTARD);
  ell(c, x + 16, y + 15, 6, 3, '#ffd97a');
}

function cushion(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const col = pick([CORAL, MINT, MUSTARD, PLUM, SKY], hash(tx, ty, 8));
  ell(c, x + 17, y + 26, 12, 4, SHADOW);
  ellO(c, x + 16, y + 18, 11, 8, col);
  ell(c, x + 14, y + 15, 7, 4, 'rgba(255,255,255,0.35)');
  rect(c, x + 15, y + 17, 2, 2, 'rgba(43,36,51,0.4)');
}

/** Benches and sofas: one piece across neighboring seats of the same kind. */
function longSeat(c: Ctx, ch: string, x: number, y: number, tx: number, ty: number, dir: Dir): void {
  const horiz = dir === 'up' || dir === 'down';
  const same = (dx: number, dy: number) => tileAt(tx + dx, ty + dy) === ch && seatDirAt(tx + dx, ty + dy) === dir;
  const start = horiz ? !same(-1, 0) : !same(0, -1);
  const end = horiz ? !same(1, 0) : !same(0, 1);
  const zone = areaIdAt(tx, ty);
  const sofa = ch === 'j';
  const [col, dark] = sofa ? seatColor(zone, tx, ty) : [WOOD_L, WOOD_D];
  const hallBench = !sofa && zone === 'hall';
  if (horiz) {
    const x0 = x + (start ? 2 : 0);
    const x1 = x + T - (end ? 2 : 0);
    rect(c, x0, y + 26, x1 - x0, 4, SHADOW);
    if (hallBench) {
      rect(c, x0, y + 10, x1 - x0, 14, INK);
      rect(c, x0 + (start ? 2 : 0), y + 12, x1 - x0 - (start ? 2 : 0) - (end ? 2 : 0), 6, col);
      rect(c, x0 + (start ? 2 : 0), y + 18, x1 - x0 - (start ? 2 : 0) - (end ? 2 : 0), 4, dark);
      if (start || end) rect(c, x + (start ? 6 : 22), y + 22, 4, 6, INK);
      // a seat cushion on every place
      const cc = [CORAL, MUSTARD, MINT, SKY, PLUM][(tx + ty) % 5]!;
      rect(c, x + 7, y + 9, 18, 9, INK);
      rect(c, x + 9, y + 11, 14, 5, cc);
      rect(c, x + 9, y + 11, 14, 2, 'rgba(255,255,255,0.4)');
      return;
    }
    const seatY = dir === 'down' ? y + 14 : y + 6;
    const backY = dir === 'down' ? y + 2 : y + 18;
    rect(c, x0, Math.min(seatY, backY), x1 - x0, (dir === 'down' ? 24 : 24), INK);
    rect(c, x0 + (start ? 2 : 0), seatY + 2, x1 - x0 - (start ? 2 : 0) - (end ? 2 : 0), 8, col);
    rect(c, x0 + (start ? 2 : 0), backY + 2, x1 - x0 - (start ? 2 : 0) - (end ? 2 : 0), 8, dark);
    if (!sofa) for (let i = 4; i < 32; i += 8) rect(c, x + i, seatY + 4, 4, 1, WOOD);
    if (sofa) {
      rect(c, x + 15, seatY + 2, 2, 8, dark);
      if (start) box(c, x0, y + 2, 6, 24, dark);
      if (end) box(c, x1 - 6, y + 2, 6, 24, dark);
    } else {
      if (start) rect(c, x + 4, y + 24, 4, 6, INK);
      if (end) rect(c, x + 24, y + 24, 4, 6, INK);
    }
  } else {
    const y0 = y + (start ? 2 : 0);
    const y1 = y + T - (end ? 2 : 0);
    const seatX = dir === 'right' ? x + 12 : x + 6;
    const backX = dir === 'right' ? x + 4 : x + 20;
    rect(c, x + 6, y1, 22, 2, SHADOW);
    rect(c, x + 4, y0, 24, y1 - y0, INK);
    rect(c, seatX, y0 + (start ? 2 : 0), 14, y1 - y0 - (start ? 2 : 0) - (end ? 2 : 0), col);
    rect(c, backX + 2, y0 + (start ? 2 : 0), 6, y1 - y0 - (start ? 2 : 0) - (end ? 2 : 0), dark);
    if (!sofa) for (let i = 4; i < 32; i += 8) rect(c, seatX + 2, y + i, 10, 1, WOOD);
    if (end) rect(c, x + 8, y + T - 4, 16, 4, dark);
  }
}

function seatTile(c: Ctx, ch: string, x: number, y: number, tx: number, ty: number): void {
  const dir = seatDirAt(tx, ty) ?? 'down';
  if (ch === 'h') chair(c, x, y, tx, ty, dir);
  else if (ch === 'i') stool(c, x, y);
  else if (ch === 'z') cushion(c, x, y, tx, ty);
  else longSeat(c, ch, x, y, tx, ty, dir);
}

// ---------------------------------------------------------------------------

/** Rows of the object below this tile (for multi-row objects), so the overlay clip ends at its last row. */
function objectRows(ch: string, tx: number, ty: number): number {
  let n = 1;
  while (n < 4 && tileAt(tx, ty + n) === ch) n++;
  return n;
}

/**
 * Draws one tile's object. The overlay ("top") only keeps what is above the
 * object's last row + 14px, so an avatar standing in front of it is never covered.
 */
function object(c: Ctx, topRaw: Ctx, ch: string, x: number, y: number, tx: number, ty: number): void {
  const top = topRaw;
  top.save();
  top.beginPath();
  let run = 1;
  while (run < MAP_W && tileAt(tx + run, ty) === ch) run++;
  if (ch === 'Q') run = 8; // gate: posts are apart, the arch spans between them
  top.rect(x - 3 * T, y - 3 * T, (run + 6) * T, 3 * T + (objectRows(ch, tx, ty) - 1) * T + 14);
  top.clip();
  try {
    drawObject(c, top, ch, x, y, tx, ty);
  } finally {
    top.restore();
  }
}

function drawObject(c: Ctx, top: Ctx, ch: string, x: number, y: number, tx: number, ty: number): void {
  switch (ch) {
    case '#':
      return wall(c, x, y, tx, ty);
    case '&':
      wall(c, x, y, tx, ty);
      return fireplace(c, x, y, tx, ty);
    case 'W':
      return whiteboard(c, x, y, tx, ty);
    case 'H':
      return hedge(c, x, y, tx, ty);
    case 'T':
      return tree(c, top, x, y, tx, ty);
    case 'P':
      return plant(c, top, x, y, tx, ty);
    case 'b':
      return planter(c, x, y, tx, ty);
    case 'D':
      return desk(c, x, y, tx, ty);
    case 'M':
      return meetingTable(c, x, y, tx, ty);
    case 'R':
      return readingTable(c, x, y, tx, ty);
    case 'C':
      return cafeTable(c, x, y, tx, ty);
    case 'K':
      return counter(c, x, y, tx, ty);
    case 'L':
      return bookshelf(c, top, x, y, tx, ty);
    case 't':
      return lowTable(c, x, y, tx, ty);
    case 'V':
      return vending(c, x, y, tx);
    case 'F':
      return photoSpot(c, top, x, y, tx, ty);
    case 'U':
      return lampPost(c, top, x, y);
    case 'Y':
      if (tileAt(tx - 1, ty) !== 'Y' && tileAt(tx, ty - 1) !== 'Y') fountain(c, top, x, y);
      return;
    case 'J':
      return speaker(c, top, x, y);
    case 'E':
      return backdrop(c, top, x, y, tx, ty);
    case '^':
      return stageFront(c, x, y, tx, ty);
    case 'O':
      return arcade(c, x, y, tx);
    case 'G':
      return pingPong(c, x, y, tx, ty);
    case 'X':
      return rock(c, x, y, tx, ty);
    case 'N':
      return noticeBoard(c, top, x, y, tx, ty);
    case 'I':
      return piano(c, top, x, y, tx, ty);
    case 'S':
      return parasolTable(c, top, x, y, tx, ty);
    case 'Q':
      return gate(c, top, x, y, tx, ty);
    case 'h':
    case 'i':
    case 'z':
    case 'n':
    case 'j':
      return seatTile(c, ch, x, y, tx, ty);
  }
}

/** True for a walkable tile that is an opening in a horizontal wall (walls left and right in the same row). */
function isDoorGap(tx: number, ty: number): boolean {
  if (isWall(tx, ty) || !FLOORS.has(tileAt(tx, ty))) return false;
  if (isWall(tx, ty - 1) || isWall(tx, ty + 1)) return false;
  let l = 0;
  let r = 0;
  for (let i = 1; i <= 3; i++) if (!l && isWall(tx - i, ty)) l = i;
  for (let i = 1; i <= 3; i++) if (!r && isWall(tx + i, ty)) r = i;
  if (!l || !r) return false;
  // the wall must run on horizontally on both sides (not two vertical walls facing each other)
  if (!isWall(tx - l - 1, ty) || !isWall(tx + r + 1, ty)) return false;
  const walk = (ch: string) => FLOORS.has(ch) || ch === 'K';
  if (!walk(tileAt(tx, ty - 1)) || !walk(tileAt(tx, ty + 1))) return false;
  for (let i = 1; i < l; i++) if (!FLOORS.has(tileAt(tx - i, ty))) return false;
  for (let i = 1; i < r; i++) if (!FLOORS.has(tileAt(tx + i, ty))) return false;
  return true;
}

/** Wooden lintels over door openings in horizontal walls. */
function doorLintels(c: Ctx): void {
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      if (!isDoorGap(tx, ty) || isDoorGap(tx, ty - 1)) continue;
      const st = WALLS[wallZone(tx, ty)] ?? WALLS.office!;
      rect(c, tx * T, ty * T, T, 6, INK);
      rect(c, tx * T, ty * T, T, 4, st.trim);
      rect(c, tx * T, ty * T, T, 2, st.capL);
    }
}

/** Striped awnings over the doors that go through a 2-row wall. */
function awnings(c: Ctx, top: Ctx): void {
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      if (!isDoorGap(tx, ty) || !isDoorGap(tx, ty + 1) || isDoorGap(tx, ty - 1) || isDoorGap(tx - 1, ty)) continue;
      let w = 1;
      while (isDoorGap(tx + w, ty)) w++;
      const zone = wallZone(tx, ty + 2);
      const [a, b] = zone === 'cafe' ? [CORAL, PAPER] : zone === 'game' ? [PLUM, MINT] : [SKY, PAPER];
      const x0 = tx * T - 8;
      const x1 = (tx + w) * T + 8;
      const y0 = ty * T - 8;
      for (const k of [c, top]) {
        rect(k, x0, y0, x1 - x0, 18, INK);
        for (let i = x0 + 2; i < x1 - 2; i += 8) rect(k, i, y0 + 2, Math.min(8, x1 - 2 - i), 14, ((i - x0) / 8) % 2 ? b : a);
        for (let i = x0; i < x1; i += 8) {
          ell(k, i + 4, y0 + 17, 5, 4, INK);
          ell(k, i + 4, y0 + 16, 3, 3, ((i - x0) / 8) % 2 ? b : a);
        }
        rect(k, x0 + 2, y0 + 2, x1 - x0 - 4, 2, 'rgba(255,255,255,0.35)');
      }
    }
}

/** A bunch of balloons tied to something at (x, y). */
function balloons(c: Ctx, top: Ctx, x: number, y: number, salt: number): void {
  const cols = [CORAL, MUSTARD, MINT, SKY, '#ff9fc4'];
  const pos: [number, number][] = [[-8, -40], [6, -46], [0, -32], [12, -34], [-12, -28]];
  for (const k of [c, top]) {
    pos.forEach(([dx, dy]) => rect(k, x + dx / 2, y + dy + 8, 1, -dy - 8, 'rgba(43,36,51,0.6)'));
    pos.forEach(([dx, dy], i) => {
      ellO(k, x + dx, y + dy, 6, 7, cols[(i + salt) % cols.length]!);
      rect(k, x + dx - 3, y + dy - 4, 2, 3, 'rgba(255,255,255,0.7)');
    });
  }
}

/** Strings of little flags between neighboring lamp posts. */
function bunting(c: Ctx, top: Ctx): void {
  const cols = [CORAL, MUSTARD, MINT, SKY, PLUM, '#ff9fc4'];
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      if (tileAt(tx, ty) !== 'U') continue;
      let nx = tx + 1;
      while (nx < MAP_W && nx - tx <= 10 && tileAt(nx, ty) !== 'U') nx++;
      if (nx - tx > 10 || tileAt(nx, ty) !== 'U') continue;
      const x0 = tx * T + 20;
      const x1 = nx * T + 12;
      const y0 = ty * T - 36;
      const sag = 12;
      for (const k of [c, top]) {
        for (let px = x0; px < x1; px += 2) {
          const f = (px - x0) / (x1 - x0);
          const py = Math.round((y0 + 4 * sag * f * (1 - f)) / 2) * 2;
          rect(k, px, py, 2, 2, INK);
        }
        let i = 0;
        for (let px = x0 + 8; px < x1 - 10; px += 14) {
          const f = (px + 4 - x0) / (x1 - x0);
          const py = Math.round((y0 + 4 * sag * f * (1 - f)) / 2) * 2 + 2;
          const col = cols[(i + tx) % cols.length]!;
          rect(k, px, py, 8, 2, col);
          rect(k, px + 1, py + 2, 6, 2, col);
          rect(k, px + 2, py + 4, 4, 2, col);
          rect(k, px + 3, py + 6, 2, 2, col);
          i++;
        }
      }
    }
}

/** Warm light pools on tables and pendant lamps above them. */
function pendantLamps(c: Ctx, top: Ctx): void {
  const seen = new Set<number>();
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const ch = tileAt(tx, ty);
      if ((ch !== 'M' && ch !== 'R') || seen.has(ty * MAP_W + tx)) continue;
      // flood the table to find its middle
      const stack = [[tx, ty]];
      let sx = 0;
      let sy = 0;
      let n = 0;
      seen.add(ty * MAP_W + tx);
      while (stack.length) {
        const [px, py] = stack.pop()!;
        sx += px!;
        sy += py!;
        n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const qx = px! + dx;
          const qy = py! + dy;
          if (tileAt(qx, qy) === ch && !seen.has(qy * MAP_W + qx)) {
            seen.add(qy * MAP_W + qx);
            stack.push([qx, qy]);
          }
        }
      }
      const cx = Math.round(((sx / n) * T + 16) / 2) * 2;
      const cy = Math.round(((sy / n) * T + 12) / 2) * 2;
      ell(c, cx, cy + 8, 26, 12, 'rgba(255,236,170,0.22)');
      for (const k of [c, top]) {
        rect(k, cx - 1, cy - 34, 2, 14, INK);
        ell(k, cx, cy - 14, 11, 8, INK);
        ell(k, cx, cy - 14, 9, 6, ch === 'R' ? MINT : MUSTARD);
        rect(k, cx - 8, cy - 14, 16, 4, INK);
        rect(k, cx - 6, cy - 12, 12, 2, '#fff2b8');
        rect(k, cx - 4, cy - 18, 3, 2, 'rgba(255,255,255,0.6)');
      }
    }
}

/** Where each area's name plate goes (pixel center). Defaults to the top-left inside the area. */
const PLATES: Record<string, [number, number]> = {
  library: [5.5 * T, 12 * T + 18],
  office: [34.5 * T, 12 * T + 18],
  roomA: [59.5 * T, 12 * T + 18],
  roomB: [71.5 * T, 12 * T + 18],
  stage: [36.5 * T, 21 * T + 21],
  hall: [36.5 * T, 32 * T + 16],
  cafe: [67 * T, 17 * T + 16],
  garden: [15.5 * T, 17 * T + 16],
  lobby: [38.5 * T, 34 * T + 16],
  game: [61.5 * T, 35 * T + 16],
  roomC: [74 * T, 35 * T + 16],
};

const ZONE_DOT: Record<string, string> = {
  library: MINT,
  office: MUSTARD,
  roomA: CORAL,
  roomB: MINT,
  roomC: SKY,
  stage: PLUM,
  hall: PLUM,
  cafe: CORAL,
  garden: '#5cc46a',
  lobby: MUSTARD,
  game: PLUM,
};

function namePlates(c: Ctx): void {
  c.font = 'bold 12px system-ui, sans-serif';
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  for (const a of AREAS) {
    const [cx, cy] = PLATES[a.id] ?? [a.x * T + 60, a.y * T + 14];
    const label = a.name;
    const tw = Math.ceil(c.measureText(label).width);
    const w = Math.round((tw + 30) / 2) * 2;
    const h = 20;
    const x = Math.round((cx - w / 2) / 2) * 2;
    const y = Math.round((cy - h / 2) / 2) * 2;
    rect(c, x + 2, y + 2, w, h, 'rgba(43,36,51,0.3)');
    rect(c, x, y, w, h, INK);
    rect(c, x + 2, y + 2, w - 4, h - 4, CREAM);
    rect(c, x + 2, y + h - 4, w - 4, 2, '#f0dcc0');
    rect(c, x + 6, y + 6, 8, 8, INK);
    rect(c, x + 7, y + 7, 6, 6, ZONE_DOT[a.id] ?? CORAL);
    c.fillStyle = INK;
    c.fillText(label, x + 20, y + h / 2 + 1);
  }
}

let cache: { base: HTMLCanvasElement; top: HTMLCanvasElement } | null = null;

function renderBoth(): { base: HTMLCanvasElement; top: HTMLCanvasElement } {
  if (cache) return cache;
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = MAP_W * T;
    cv.height = MAP_H * T;
    const k = cv.getContext('2d')!;
    k.imageSmoothingEnabled = false;
    return { cv, k };
  };
  const base = mk();
  const top = mk();
  const c = base.k;
  // Pass 1: floors (also under furniture)
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const ch = tileAt(tx, ty);
      if (WALLISH.has(ch) || ch === 'H') continue;
      floor(c, FLOORS.has(ch) ? ch : baseFloor(ch, tx, ty), tx * T, ty * T, tx, ty);
    }
  // Pass 1b: water with smooth shores, then bridges
  waterPass(c);
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) if (tileAt(tx, ty) === 'y') bridge(c, tx * T, ty * T, tx, ty);
  // Pass 2: walls and furniture, top to bottom so tall things overlap the row above
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const ch = tileAt(tx, ty);
      if (!FLOORS.has(ch)) object(c, top.k, ch, tx * T, ty * T, tx, ty);
    }
  doorLintels(c);
  awnings(c, top.k);
  bunting(c, top.k);
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++)
      if (tileAt(tx, ty) === 'K' && areaIdAt(tx, ty) === 'lobby' && (tileAt(tx - 1, ty) !== 'K' || tileAt(tx + 1, ty) !== 'K'))
        balloons(c, top.k, tx * T + (tileAt(tx - 1, ty) !== 'K' ? 2 : 30), ty * T + 8, tx);
  pendantLamps(c, top.k);
  namePlates(c);
  cache = { base: base.cv, top: top.cv };
  return cache;
}

/** The whole map: floors, walls, furniture and room name plates. */
export function renderMap(): HTMLCanvasElement {
  return renderBoth().base;
}

/** Same size, transparent: things drawn above avatars (tree tops, lamps, lintels, tall furniture tops). */
export function renderMapTop(): HTMLCanvasElement {
  return renderBoth().top;
}
