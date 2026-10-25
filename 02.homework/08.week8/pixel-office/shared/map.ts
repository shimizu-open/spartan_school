// The town map, shared by the server (to check moves) and the browser (to draw it).
// The map is a grid of tiles. Each tile is one character; see TILE_INFO.
//
// Layout (80 x 48 tiles): a little "campus town". Buildings along the top
// (library, office, two meeting rooms), a brick boulevard with a fountain,
// and below it a park with a stream, an open-air amphitheater with a stage,
// a cafe with a terrace, the entrance plaza, a game corner and meeting room C.

import { TILE } from './constants.ts';
import type { Dir } from './types.ts';

export const MAP_W = 80;
export const MAP_H = 48;

export interface TileInfo {
  name: string;
  solid: boolean; // true = you cannot walk on it
}

export const TILE_INFO: Record<string, TileInfo> = {
  // floors
  '.': { name: 'grass', solid: false },
  f: { name: 'flowers', solid: false },
  p: { name: 'brick', solid: false },
  s: { name: 'gravel', solid: false },
  o: { name: 'steppingStone', solid: false },
  k: { name: 'wood', solid: false },
  c: { name: 'libraryCarpet', solid: false },
  m: { name: 'roomCarpet', solid: false },
  q: { name: 'cafeTiles', solid: false },
  d: { name: 'deck', solid: false },
  g: { name: 'stageBoards', solid: false },
  e: { name: 'stageSteps', solid: false },
  a: { name: 'amphitheater', solid: false },
  l: { name: 'lobbyTiles', solid: false },
  v: { name: 'arcadeCarpet', solid: false },
  u: { name: 'rug', solid: false },
  x: { name: 'doormat', solid: false },
  y: { name: 'bridge', solid: false },
  // seats (walkable: a sitting avatar stands on them)
  h: { name: 'chair', solid: false },
  z: { name: 'cushion', solid: false },
  n: { name: 'bench', solid: false },
  j: { name: 'sofa', solid: false },
  i: { name: 'stool', solid: false },
  // solid things
  '#': { name: 'wall', solid: true },
  H: { name: 'hedge', solid: true },
  w: { name: 'water', solid: true },
  T: { name: 'tree', solid: true },
  P: { name: 'plant', solid: true },
  b: { name: 'planter', solid: true },
  D: { name: 'desk', solid: true },
  M: { name: 'meetingTable', solid: true },
  R: { name: 'readingTable', solid: true },
  C: { name: 'cafeTable', solid: true },
  K: { name: 'counter', solid: true },
  L: { name: 'bookshelf', solid: true },
  t: { name: 'lowTable', solid: true },
  W: { name: 'whiteboard', solid: true },
  V: { name: 'vending', solid: true },
  F: { name: 'photoSpot', solid: true },
  U: { name: 'lampPost', solid: true },
  Y: { name: 'fountain', solid: true },
  J: { name: 'speaker', solid: true },
  E: { name: 'backdrop', solid: true },
  '^': { name: 'stageFront', solid: true },
  O: { name: 'arcade', solid: true },
  G: { name: 'pingPong', solid: true },
  X: { name: 'rock', solid: true },
  N: { name: 'noticeBoard', solid: true },
  '&': { name: 'fireplace', solid: true },
  I: { name: 'piano', solid: true },
  S: { name: 'parasolTable', solid: true },
  Q: { name: 'gate', solid: true },
};

/** Tiles you can sit on. */
export const SEAT_TILES = new Set(['h', 'z', 'n', 'j', 'i']);
/** Tiles a seat turns toward when it is next to one. */
const TABLE_TILES = new Set(['D', 'M', 'R', 'C', 'K', 't', 'G', 'S', 'I']);

/**
 * A named part of the map. In a private area you only talk with people in the same area.
 * quiet = chat only (no voice). stage = whoever stands here is heard by everyone in `audience`.
 */
export interface Area {
  id: string;
  name: string;
  x: number; // in tiles
  y: number;
  w: number;
  h: number;
  private: boolean;
  quiet?: boolean;
  stage?: boolean;
  audience?: string;
}

// Order matters: areaAt returns the first match.
export const AREAS: Area[] = [
  { id: 'library', name: '図書室', x: 2, y: 2, w: 17, h: 10, private: false, quiet: true },
  { id: 'office', name: 'オフィス', x: 23, y: 2, w: 24, h: 10, private: false },
  { id: 'roomA', name: 'ミーティングルームA', x: 51, y: 2, w: 11, h: 10, private: true },
  { id: 'roomB', name: 'ミーティングルームB', x: 63, y: 2, w: 11, h: 10, private: true },
  { id: 'stage', name: 'ステージ', x: 30, y: 18, w: 13, h: 4, private: false, stage: true, audience: 'hall' },
  { id: 'hall', name: '広場', x: 25, y: 22, w: 23, h: 11, private: false },
  { id: 'cafe', name: 'カフェ', x: 53, y: 19, w: 26, h: 13, private: false },
  { id: 'garden', name: '中庭', x: 1, y: 17, w: 23, h: 30, private: false },
  { id: 'lobby', name: 'エントランス', x: 25, y: 33, w: 27, h: 14, private: false },
  { id: 'game', name: 'ゲームコーナー', x: 53, y: 37, w: 12, h: 9, private: false },
  { id: 'roomC', name: 'ミーティングルームC', x: 66, y: 37, w: 12, h: 9, private: true },
];

export type ObjectKind = 'whiteboard' | 'vending' | 'photo';

/** Something you can use when you stand next to it (tile rectangle). */
export interface MapObject {
  id: string;
  kind: ObjectKind;
  name: string;
  tx: number;
  ty: number;
  w: number;
  h: number;
}

export const OBJECTS: MapObject[] = [
  { id: 'wb-office', kind: 'whiteboard', name: 'オフィスのホワイトボード', tx: 33, ty: 1, w: 3, h: 1 },
  { id: 'wb-roomA', kind: 'whiteboard', name: 'ルームAのホワイトボード', tx: 55, ty: 1, w: 3, h: 1 },
  { id: 'wb-roomB', kind: 'whiteboard', name: 'ルームBのホワイトボード', tx: 67, ty: 1, w: 3, h: 1 },
  { id: 'wb-roomC', kind: 'whiteboard', name: 'ルームCのホワイトボード', tx: 73, ty: 36, w: 3, h: 1 },
  { id: 'vend-1', kind: 'vending', name: 'ドリンク自販機', tx: 54, ty: 19, w: 1, h: 1 },
  { id: 'vend-2', kind: 'vending', name: 'おやつ自販機', tx: 55, ty: 19, w: 1, h: 1 },
  { id: 'photo-1', kind: 'photo', name: 'フォトスポット', tx: 13, ty: 22, w: 3, h: 1 },
];

const OBJECT_CHAR: Record<ObjectKind, string> = { whiteboard: 'W', vending: 'V', photo: 'F' };

/** Facing direction of each seat tile, keyed by "tx,ty". */
const seatDirs = new Map<string, Dir>();

function build(): string[] {
  const g: string[][] = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill('.'));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y]![x] = c;
  };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? g[y]![x]! : 'H');
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
  };
  const pts = (list: readonly (readonly [number, number])[], c: string) => {
    for (const [x, y] of list) set(x, y, c);
  };
  const seat = (x: number, y: number, c: string, dir?: Dir) => {
    set(x, y, c);
    if (dir) seatDirs.set(`${x},${y}`, dir);
  };
  /** Building: 2-row top wall (roof edge + wall face), 1-row side and bottom walls. */
  const building = (x0: number, y0: number, x1: number, y1: number, fill: string) => {
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, '#');
    rect(x0 + 1, y0 + 2, x1 - x0 - 1, y1 - y0 - 2, fill);
  };

  // ---- Border hedge ----
  rect(0, 0, MAP_W, 1, 'H');
  rect(0, MAP_H - 1, MAP_W, 1, 'H');
  rect(0, 0, 1, MAP_H, 'H');
  rect(MAP_W - 1, 0, 1, MAP_H, 'H');

  // ---- Library (top left) ----
  building(1, 0, 19, 12, 'c');
  rect(9, 12, 3, 1, 'x'); // door
  rect(9, 1, 3, 1, '&'); // fireplace in the wall
  rect(2, 2, 6, 1, 'L');
  rect(13, 2, 6, 1, 'L');
  rect(8, 2, 5, 3, 'u'); // rug in front of the fire
  seat(9, 4, 'j', 'up');
  seat(11, 4, 'j', 'up');
  set(10, 3, 't');
  // reading nook with cushions around a round table
  rect(2, 6, 5, 5, 'u');
  set(4, 8, 't');
  pts([[3, 8], [5, 8], [4, 7], [4, 9]], 'z');
  // reading table
  rect(8, 7, 3, 2, 'R');
  pts([[8, 6], [10, 6], [8, 9], [10, 9], [7, 7], [11, 8]], 'h');
  // shelf islands
  rect(14, 5, 4, 1, 'L');
  rect(14, 8, 4, 1, 'L');
  pts([[13, 11], [18, 11]], 'P');
  set(2, 11, 'P');
  set(18, 4, 'P');

  // ---- Office (top middle) ----
  building(22, 0, 47, 12, 'k');
  rect(28, 12, 2, 1, 'x');
  rect(40, 12, 2, 1, 'x');
  for (const ix of [24, 30, 36]) {
    for (const iy of [4, 8]) {
      rect(ix, iy, 3, 2, 'D');
      pts([[ix, iy - 1], [ix + 2, iy - 1], [ix, iy + 2], [ix + 2, iy + 2]], 'h');
    }
  }
  // lounge corner
  rect(41, 3, 5, 5, 'u');
  rect(42, 4, 3, 1, 't');
  for (const x of [42, 43, 44]) seat(x, 3, 'j', 'down');
  pts([[42, 5], [44, 5]], 'z');
  pts([[23, 2], [46, 2], [46, 11], [23, 11], [41, 9], [45, 9]], 'P');
  rect(42, 10, 3, 1, 'L');

  // ---- Meeting rooms A and B (top right) ----
  building(50, 0, 62, 12, 'm');
  building(62, 0, 74, 12, 'm');
  rect(51, 2, 11, 10, 'm'); // the shared wall above was overwritten by B, keep A's floor
  rect(55, 12, 2, 1, 'x');
  rect(67, 12, 2, 1, 'x');
  // room A: long table
  rect(53, 5, 7, 3, 'M');
  pts([[54, 4], [56, 4], [58, 4], [54, 8], [56, 8], [58, 8], [52, 6], [60, 6]], 'h');
  pts([[51, 2], [61, 2], [51, 11], [61, 11]], 'P');
  // room B: table + beanbag corner
  rect(65, 5, 6, 2, 'M');
  pts([[65, 4], [67, 4], [69, 4], [66, 7], [68, 7], [70, 7], [64, 5], [71, 6]], 'h');
  rect(70, 9, 4, 3, 'u');
  pts([[70, 10], [72, 10]], 'z');
  set(71, 10, 't');
  pts([[63, 2], [73, 2], [63, 11]], 'P');

  // ---- Boulevard with a fountain plaza ----
  rect(1, 13, 78, 3, 'p');
  for (let y = 12; y <= 20; y++)
    for (let x = 44; x <= 55; x++) {
      const dx = (x - 49.5) / 5.6;
      const dy = (y - 15.5) / 3.9;
      if (dx * dx + dy * dy <= 1 && get(x, y) === '.') set(x, y, 'p');
    }
  rect(49, 15, 2, 2, 'Y');
  // grass strips between the top buildings
  pts([[20, 3], [48, 3], [76, 3], [77, 8]], 'T');
  pts([[21, 7], [20, 10], [49, 7], [49, 10], [75, 6], [76, 10], [78, 4]], 'f');
  // lamp posts and flower beds along the boulevard
  pts([[5, 16], [13, 16], [21, 16], [29, 16], [44, 16], [56, 16], [66, 16], [76, 12]], 'U');
  rect(26, 16, 3, 1, 'b');
  rect(37, 16, 4, 1, 'b');
  for (const x of [32, 33]) seat(x, 16, 'n', 'up');
  for (const x of [8, 9]) seat(x, 16, 'n', 'up');

  // ---- Garden / park (bottom left) ----
  rect(24, 17, 1, 30, 'H'); // hedge towards the hall and lobby
  rect(24, 19, 1, 3, '.'); // gap to the stage side
  rect(24, 27, 1, 3, '.'); // gap to the amphitheater
  rect(24, 38, 1, 3, 's'); // gap to the lobby
  // gravel trails
  const trail = (x: number, y: number) => {
    set(x, y, 's');
  };
  for (let y = 17; y <= 30; y++) {
    const x = Math.round(6 + Math.sin(y / 3) * 1.2);
    trail(x, y);
    trail(x + 1, y);
  }
  for (let x = 7; x <= 23; x++) {
    const y = x <= 11 ? Math.round(30 + Math.sin(x / 2.5) * 0.8) : x <= 16 ? 29 : 30;
    trail(x, y);
    trail(x, y + 1);
  }
  for (let y = 31; y <= 38; y++) {
    trail(17, y);
    trail(18, y);
  }
  for (let x = 17; x <= 23; x++) {
    trail(x, 38);
    trail(x, 39);
  }
  // stream from a spring (top right of the park) to a pond; a bridge where a trail crosses it
  const water = (x: number, y: number) => set(x, y, get(x, y) === 's' || get(x, y) === 'y' ? 'y' : 'w');
  const streamX = [19, 19, 18, 18, 17, 17, 16, 16, 15, 14, 14, 14, 13, 12, 12, 11, 11, 10];
  streamX.forEach((cx, i) => {
    water(cx, 19 + i);
    water(cx + 1, 19 + i);
  });
  for (let y = 34; y <= 45; y++)
    for (let x = 1; x <= 23; x++) {
      const dx = (x - 9.5) / 6.6;
      const dy = (y - 39.5) / 4.2;
      if (dx * dx + dy * dy < 1) water(x, y);
    }
  pts([[19, 18], [20, 18], [21, 19], [18, 18]], 'X');
  // photo spot with a flower bed around
  rect(12, 21, 5, 1, 'f');
  rect(12, 23, 5, 2, 'f');
  set(12, 22, 'f');
  set(16, 22, 'f');
  rect(13, 23, 3, 1, 'o');
  // trees, rocks, flowers, benches
  pts([[2, 18], [11, 18], [3, 23], [10, 24], [2, 29], [21, 24], [14, 32], [22, 34], [2, 35], [22, 44], [16, 45], [4, 45]], 'T');
  pts([[4, 34], [15, 37], [3, 43], [21, 33]], 'X');
  pts([[10, 21], [3, 32], [13, 28], [20, 46 - 1]], 'T');
  pts([[8, 20], [9, 21], [3, 26], [4, 26], [12, 27], [20, 28], [21, 21], [9, 26], [1, 32], [19, 42], [20, 36], [13, 45], [7, 45], [2, 39], [10, 34], [22, 41],
    [2, 20], [3, 20], [2, 21], [9, 19], [10, 19], [4, 30], [5, 31], [1, 27], [10, 27], [11, 27], [20, 32], [21, 32], [15, 43], [6, 46], [9, 46], [18, 26], [19, 27]], 'f');
  for (const y of [21, 22]) seat(4, y, 'n', 'right');
  for (const x of [8, 9, 10]) seat(x, 34, 'n', 'down');
  for (const y of [25, 26]) seat(8, y, 'n', 'right');
  // picnic blanket
  rect(19, 41, 4, 3, 'u');
  rect(20, 42, 2, 1, 't');
  seat(19, 42, 'z');
  seat(22, 42, 'z');
  seat(20, 41, 'z');

  // ---- Hall (amphitheater) and stage ----
  rect(25, 17, 23, 16, '.');
  rect(30, 17, 13, 1, 'E');
  rect(30, 18, 13, 3, 'g');
  rect(30, 21, 13, 1, '^');
  rect(30, 21, 2, 1, 'e');
  rect(41, 21, 2, 1, 'e');
  pts([[29, 18], [43, 18]], 'J');
  for (let y = 22; y <= 31; y++) {
    const half = Math.min(11, 5 + (y - 22));
    for (let x = 36 - half; x <= 36 + half; x++) if (x >= 25 && x <= 47) set(x, y, 'a');
  }
  for (const [y, half] of [[24, 5], [26, 7], [28, 8], [30, 9]] as const) {
    for (let x = 36 - half; x <= 36 + half; x++) if (x !== 36) seat(x, y, 'n', 'up');
  }
  pts([[26, 18], [46, 20], [26, 31], [46, 31]], 'T');
  pts([[27, 23], [45, 23], [25, 26], [47, 27]], 'f');
  // planters between the hall and the lobby
  rect(26, 33, 4, 1, 'b');
  rect(43, 33, 4, 1, 'b');

  // ---- Avenue from the fountain down to the lobby ----
  rect(48, 17, 4, 17, 'p');

  // ---- Cafe with a terrace (right) ----
  building(52, 17, 72, 32, 'q');
  rect(61, 17, 2, 2, 'q'); // north door
  rect(52, 24, 1, 2, 'q'); // west door
  rect(72, 24, 1, 3, 'q'); // east door to the terrace
  rect(61, 19, 2, 1, 'x');
  rect(63, 19, 8, 1, 'K');
  for (const x of [64, 66, 68, 70]) set(x, 20, 'i');
  set(56, 19, 'P');
  set(71, 31, 'P');
  set(53, 26, 'P');
  for (const [cx, cy] of [[57, 23], [61, 23], [66, 24], [57, 27], [62, 27], [67, 28]] as const) {
    set(cx, cy, 'C');
    seat(cx - 1, cy, 'i');
    seat(cx + 1, cy, 'i');
  }
  // sofa booth along the south wall
  rect(57, 30, 5, 1, 'C');
  for (let x = 57; x <= 61; x++) seat(x, 31, 'j');
  for (const x of [57, 59, 61]) seat(x, 29, 'h');
  // piano corner
  rect(53, 30, 2, 1, 'I');
  seat(54, 31, 'i', 'up');
  // terrace
  rect(73, 17, 6, 16, 'd');
  for (const y of [20, 24, 28]) {
    set(75, y, 'S');
    seat(74, y, 'i');
    seat(76, y, 'i');
  }
  pts([[78, 18], [78, 31], [73, 31]], 'P');

  // ---- Lane behind the cafe ----
  rect(51, 33, 28, 2, 'p');

  // ---- Lobby / entrance plaza (bottom middle) ----
  rect(25, 34, 27, 13, 'l');
  rect(48, 33, 4, 1, 'p');
  rect(30, 33, 13, 1, 'l');
  rect(36, 36, 5, 1, 'K'); // reception
  rect(26, 37, 5, 5, 'u');
  for (const x of [27, 28, 29]) seat(x, 38, 'j', 'down');
  rect(27, 39, 3, 1, 't');
  for (const x of [27, 28, 29]) seat(x, 40, 'j', 'up');
  rect(46, 35, 2, 1, 'N');
  pts([[25, 34], [51, 36], [25, 46], [51, 46], [33, 46], [45, 46], [44, 37], [32, 37]], 'P');
  rect(36, 47, 7, 1, 'Q'); // the gate in the hedge
  pts([[36, 46], [42, 46]], 'Q');
  rect(37, 43, 5, 4, 'x'); // red carpet from the gate
  // meeting spot with cushions
  rect(44, 38, 5, 5, 'u');
  set(46, 40, 't');
  pts([[45, 40], [47, 40], [46, 39], [46, 41]], 'z');

  // ---- Game corner (bottom right) ----
  building(52, 35, 65, 46, 'v');
  rect(52, 40, 1, 2, 'v'); // west door
  rect(57, 35, 2, 2, 'v'); // north door
  for (const x of [54, 55, 60, 61, 62]) set(x, 37, 'O');
  rect(55, 42, 4, 2, 'G');
  rect(61, 40, 3, 1, 't');
  for (const x of [61, 62, 63]) seat(x, 41, 'z');
  pts([[53, 45], [64, 45], [64, 37], [53, 37]], 'P');
  rect(55, 39, 2, 1, 't'); // board game table
  pts([[54, 39], [57, 39], [55, 38], [56, 40]], 'z');

  // ---- Meeting room C (bottom right) ----
  building(65, 35, 78, 46, 'm');
  rect(69, 35, 2, 2, 'm'); // north door
  rect(68, 40, 7, 2, 'M');
  pts([[68, 39], [70, 39], [72, 39], [74, 39], [69, 42], [71, 42], [73, 42], [67, 40], [75, 41]], 'h');
  pts([[66, 37], [77, 37], [66, 45], [77, 45]], 'P');
  rect(74, 43, 3, 2, 'u');

  // objects
  for (const o of OBJECTS) rect(o.tx, o.ty, o.w, o.h, OBJECT_CHAR[o.kind]);

  return g.map((row) => row.join(''));
}

export const MAP: string[] = build();

export function tileAt(tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return '#';
  return MAP[ty]![tx]!;
}

export function isSolidTile(tx: number, ty: number): boolean {
  return TILE_INFO[tileAt(tx, ty)]?.solid ?? true;
}

/** Half size of the box under an avatar's feet used for collisions. */
export const FEET_W = 9;
export const FEET_H = 6;

/** True if an avatar standing with its feet at (x, y) overlaps a solid tile. */
export function collides(x: number, y: number): boolean {
  const left = Math.floor((x - FEET_W) / TILE);
  const right = Math.floor((x + FEET_W - 0.01) / TILE);
  const top = Math.floor((y - FEET_H * 2) / TILE);
  const bottom = Math.floor((y - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) for (let tx = left; tx <= right; tx++) if (isSolidTile(tx, ty)) return true;
  return false;
}

export function areaAt(x: number, y: number): Area | null {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor((y - 1) / TILE);
  return AREAS.find((a) => tx >= a.x && ty >= a.y && tx < a.x + a.w && ty < a.y + a.h) ?? null;
}

export function privateAreaAt(x: number, y: number): Area | null {
  const a = areaAt(x, y);
  return a && a.private ? a : null;
}

/** Feet position at the middle of a tile. */
export function tileCenter(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 4 };
}

/** Where new people appear: in the entrance plaza, in front of the reception. */
export const SPAWN = tileCenter(38, 40);

/**
 * Finds the nearest walkable spot to (x, y), searching outward in rings of tiles.
 * `taken` lets callers skip spots where someone is already standing.
 */
export function nearestFree(x: number, y: number, taken: (x: number, y: number) => boolean = () => false): { x: number; y: number } {
  if (!collides(x, y) && !taken(x, y)) return { x, y };
  const tx0 = Math.floor(x / TILE);
  const ty0 = Math.floor((y - 1) / TILE);
  for (let r = 0; r < 14; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = tileCenter(tx0 + dx, ty0 + dy);
        if (!collides(p.x, p.y) && !taken(p.x, p.y)) return p;
      }
  }
  return SPAWN;
}

/** A "taken" test for nearestFree: true if someone stands closer than `gap` pixels. */
export function occupiedBy(people: Iterable<{ x: number; y: number }>, gap = 24): (x: number, y: number) => boolean {
  const list = [...people];
  return (x, y) => list.some((p) => Math.abs(p.x - x) < gap && Math.abs(p.y - y) < gap);
}

/** Walkable spot inside an area, used by "enter room" buttons. */
export function areaEntry(area: Area, taken?: (x: number, y: number) => boolean): { x: number; y: number } {
  return nearestFree((area.x + 1) * TILE + TILE / 2, (area.y + Math.floor(area.h / 2)) * TILE + TILE - 4, taken);
}

/** Nearest usable object whose tile rectangle is within maxDist pixels of the feet. */
export function objectNear(x: number, y: number, maxDist = TILE * 1.6): MapObject | null {
  let best: MapObject | null = null;
  let bestD = Infinity;
  for (const o of OBJECTS) {
    const x0 = o.tx * TILE;
    const y0 = o.ty * TILE;
    const dx = Math.max(x0 - x, 0, x - (x0 + o.w * TILE));
    const dy = Math.max(y0 - y, 0, y - (y0 + o.h * TILE));
    const d = Math.hypot(dx, dy);
    if (d <= maxDist && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** Which way someone sitting on seat tile (tx, ty) faces, or null if it is not a seat. */
export function seatDirAt(tx: number, ty: number): Dir | null {
  if (!SEAT_TILES.has(tileAt(tx, ty))) return null;
  const fixed = seatDirs.get(`${tx},${ty}`);
  if (fixed) return fixed;
  const near: [number, number, Dir][] = [
    [0, -1, 'up'],
    [0, 1, 'down'],
    [-1, 0, 'left'],
    [1, 0, 'right'],
  ];
  for (const [dx, dy, d] of near) if (TABLE_TILES.has(tileAt(tx + dx, ty + dy))) return d;
  return 'down';
}

/** The nearest seat within ~1.2 tiles of the feet: where to stand to sit, and which way to face. */
export function seatAt(x: number, y: number): { x: number; y: number; dir: Dir } | null {
  const tx0 = Math.floor(x / TILE);
  const ty0 = Math.floor((y - 1) / TILE);
  let best: { x: number; y: number; dir: Dir } | null = null;
  let bestD = TILE * 1.2;
  for (let ty = ty0 - 2; ty <= ty0 + 2; ty++)
    for (let tx = tx0 - 2; tx <= tx0 + 2; tx++) {
      const dir = seatDirAt(tx, ty);
      if (!dir) continue;
      const c = tileCenter(tx, ty);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= bestD) {
        best = { x: c.x, y: c.y, dir };
        bestD = d;
      }
    }
  return best;
}

/**
 * The meeting room a thing belongs to (it is inside the room or on one of its walls),
 * or null. Used so a meeting-room whiteboard can only be used from inside that room.
 */
export function roomOfObject(o: MapObject): Area | null {
  const cx = o.tx + o.w / 2;
  const cy = o.ty + o.h / 2;
  return AREAS.find((a) => a.private && cx >= a.x - 1 && cx <= a.x + a.w + 1 && cy >= a.y - 1 && cy <= a.y + a.h + 1) ?? null;
}
