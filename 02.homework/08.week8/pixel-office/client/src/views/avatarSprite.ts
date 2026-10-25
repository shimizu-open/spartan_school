// Draws chibi pixel-art avatars procedurally. No image files are needed,
// so there are no third-party assets (and no licenses) to worry about.
//
// How it works: every body part is painted into a small pixel grid (GW x GH
// cells). Each part gets its own dark outline (any empty or underlying cell
// next to the part becomes ink), so parts drawn later sit on top like
// stickers. The side view is painted facing left and mirrored for 'right'.
// Finished grids are scaled up by SCALE onto a cached canvas.

import { HAIR, OUTFIT_COLORS, SKIN, type AvatarLook } from '../../../shared/avatar.ts';
import type { Dir } from '../../../shared/types.ts';

/** One cell of the sprite grid is drawn as SCALE x SCALE canvas pixels. */
export const SCALE = 2;
const GW = 24;
const GH = 32;
/** Extra rows above the design grid, so tall hats and ears fit. Design row y is grid row y + BASE. */
const BASE = 2;
const FEET_ROW = 29 + BASE; // first grid row below the shoes

/** Sprite canvas size and where the feet touch the ground inside it (px). */
export const SPRITE_W = GW * SCALE;
export const SPRITE_H = GH * SCALE;
export const FEET_X = (GW / 2) * SCALE;
export const FEET_Y = FEET_ROW * SCALE;
/** How far the body moves down in the sitting pose (px). */
export const SIT_DROP = 2 * SCALE;

const INK = '#2b2433';
const WHITE = '#fffdf7';
const MOUTH = '#a3434b';
const CORAL = '#ff6f59';

// ---------------------------------------------------------------------------
// colour helpers

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0')}`;
}
/** Lighter (amount > 0) or darker (amount < 0) version of a colour. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex);
  return amount >= 0
    ? toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
    : toHex(r * (1 + amount), g * (1 + amount), b * (1 + amount));
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function lum(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ---------------------------------------------------------------------------
// the pixel grid

type Pal = Record<string, string>;
/** A small picture: rows of characters, each char looked up in a palette ('.' = empty). */
interface Pat {
  y: number;
  x?: number;
  rows: string[];
}

class Painter {
  readonly px: (string | null)[] = new Array<string | null>(GW * GH).fill(null);
  /** Vertical offset added to every design row (BASE, plus the sitting drop). */
  oy = BASE;
  /** Rows above this design row are skipped (used to flatten tall hair under a hat). */
  clipTop = -99;
  private cur: Map<number, string> | null = null;

  set(x: number, y: number, c: string): void {
    if (y < this.clipTop) return;
    const yy = y + this.oy;
    if (x < 0 || x >= GW || yy < 0 || yy >= GH) return;
    const i = yy * GW + x;
    if (this.cur) this.cur.set(i, c);
    else this.px[i] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** rect plus its mirror image across the vertical centre line. */
  sym(x: number, y: number, w: number, h: number, c: string): void {
    this.rect(x, y, w, h, c);
    this.rect(GW - x - w, y, w, h, c);
  }

  /** Removes cells from the part being built. */
  cut(x: number, y: number, w = 1, h = 1): void {
    if (!this.cur) return;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const yy = y + j + this.oy;
        const xx = x + i;
        if (xx >= 0 && xx < GW && yy >= 0 && yy < GH) this.cur.delete(yy * GW + xx);
      }
  }

  pat(p: Pat, pal: Pal, mirror = false): void {
    const x0 = p.x ?? 0;
    p.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!;
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (!c) continue;
        const x = mirror ? GW - 1 - (x0 + i) : x0 + i;
        this.set(x, p.y + j, c);
      }
    });
  }

  pats(list: Pat[] | undefined, pal: Pal, mirror = false): void {
    if (list) for (const p of list) this.pat(p, pal, mirror);
  }

  /** Paints everything drawn inside fn as one part with its own outline. */
  part(fn: () => void, outline: string | null = INK): void {
    const m = new Map<number, string>();
    this.cur = m;
    fn();
    this.cur = null;
    if (outline) {
      for (const i of m.keys()) {
        const x = i % GW;
        const y = (i - x) / GW;
        if (x > 0 && !m.has(i - 1)) this.px[i - 1] = outline;
        if (x < GW - 1 && !m.has(i + 1)) this.px[i + 1] = outline;
        if (y > 0 && !m.has(i - GW)) this.px[i - GW] = outline;
        if (y < GH - 1 && !m.has(i + GW)) this.px[i + GW] = outline;
      }
    }
    for (const [i, c] of m) this.px[i] = c;
  }

  mirror(): void {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW / 2; x++) {
        const a = y * GW + x;
        const b = y * GW + (GW - 1 - x);
        const t = this.px[a]!;
        this.px[a] = this.px[b]!;
        this.px[b] = t;
      }
  }
}

const P = (y: number, rows: string[], x?: number): Pat => (x === undefined ? { y, rows } : { y, x, rows });

// ---------------------------------------------------------------------------
// hair

type View = 'down' | 'left' | 'up';
interface HairView {
  back?: Pat[]; // drawn behind the body
  front: Pat[]; // drawn over the head
  ties?: Pat[]; // hair ties, drawn last with their own outline
}
interface HairArt {
  top: number; // highest hair row (design y), front view
  tall?: boolean; // the part above row 7 is squashed flat by hats
  ear?: boolean; // side view shows the ear
  outline?: boolean;
  down: HairView;
  left: HairView;
  up: HairView;
}

const CAP_D = P(7, [
  '.......hhhhhhhhhh.......',
  '.....hhhllhhhhhhhhh.....',
  '....hhhlhhhhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
]);
const CAP_WIDE_D = P(7, [
  '.......hhhhhhhhhh.......',
  '.....hhhllhhhhhhhhh.....',
  '....hhhlhhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhhhhhh...',
  '...hhhhhhhhhhhhhhhhhh...',
]);
const CAP_U = P(7, [
  '.......hhhhhhhhhh.......',
  '.....hhhhhhllhhhhh......',
  '....hhhhhhlhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '....hdhhhhhhhhhhhhdh....',
  '....hhdhhhhhhhhhhdhh....',
  '.....hhhhhhhhhhhhhh.....',
  '......hhhhhhhhhhhh......',
]);
const SHORT_L = [
  CAP_D,
  P(12, [
    '....hhh....hhhhhhhhh....',
    '....h......hhhhhhhhh....',
    '...........hhhhhhhhh....',
    '...........hhhhhhhdh....',
    '............hhhhhhhh....',
    '.............hhhhhh.....',
  ]),
];
const SHORT_D_BANGS = P(12, [
  '....hh.hhhh..hhhh.hh....',
  '....h..............h....',
  '....h..............h....',
]);

const HAIR_ART: HairArt[] = [
  // 0 ショート
  {
    top: 7,
    ear: true,
    down: { front: [CAP_D, SHORT_D_BANGS] },
    left: { front: SHORT_L },
    up: { front: [CAP_U] },
  },
  // 1 ボブ
  {
    top: 7,
    down: {
      front: [
        CAP_WIDE_D,
        P(12, [
          '...hhhhhhhhhhhhhhhhhh...',
          '...hh..............hh...',
          '...hh..............hh...',
          '...hh..............hh...',
          '...hd..............dh...',
          '...hd..............dh...',
          '...hhh............hhh...',
          '....hh............hh....',
        ]),
      ],
    },
    left: {
      front: [
        CAP_WIDE_D,
        P(12, [
          '...hhhhh..hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhdh...',
          '..........hhhhhhhhhdh...',
          '.........hhhhhhhhhhhh...',
          '.........hhhhhhhhhhh....',
        ]),
      ],
    },
    up: {
      front: [
        P(7, [
          '.......hhhhhhhhhh.......',
          '.....hhhhhhllhhhhh......',
          '....hhhhhhlhhhhhhhhh....',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhdhhhhhhhhhhhhdhh...',
          '...hhdhhhhhhhhhhhhdhh...',
          '...hhhhhhhhhhhhhhhhhh...',
        ]),
      ],
    },
  },
  // 2 ロング
  {
    top: 7,
    down: {
      back: [
        P(12, [
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hdhhhhhhhhhhhhhhhhdh..',
          '..hdhhhhhhhhhhhhhhhhdh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '..hhhh............hhhh..',
          '...hh..............hh...',
        ]),
      ],
      front: [
        CAP_WIDE_D,
        P(12, [
          '...hhh.hhhh..hhhh.hhh...',
          '...hh..............hh...',
          '...hh..............hh...',
          '...hh..............hh...',
          '...hd..............dh...',
          '...hd..............dh...',
          '...hh..............hh...',
          '...hh..............hh...',
          '...hh..............hh...',
        ]),
      ],
    },
    left: {
      back: [
        P(12, [
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhdh...',
          '...........hhhhhhhhdh...',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhhh...',
          '............hhhhhhhh....',
          '.............hh..hh.....',
        ]),
      ],
      front: [
        CAP_WIDE_D,
        P(12, [
          '...hhhh...hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhdh...',
          '..........hhhhhhhhhdh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
        ]),
      ],
    },
    up: {
      front: [
        P(7, [
          '.......hhhhhhhhhh.......',
          '.....hhhhhhllhhhhh......',
          '....hhhhhhlhhhhhhhhh....',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhdhhhhhhhhdhhhh...',
          '...hhhhdhhhhhhhhdhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhdhhhhdhhhhhh...',
          '...hhhhhhdhhhhdhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '....hhhhhhhhhhhhhhhh....',
          '.....hhh.hhhhhh.hhh.....',
        ]),
      ],
    },
  },
  // 3 ポニーテール
  {
    top: 7,
    ear: true,
    down: {
      back: [
        P(9, [
          '...................hhh..',
          '...................hhhh.',
          '...................hhhh.',
          '...................hhhh.',
          '...................hhdh.',
          '...................hhdh.',
          '...................hhhh.',
          '....................hhh.',
          '....................hhh.',
          '....................hh..',
          '.....................h..',
        ]),
      ],
      front: [
        CAP_D,
        P(12, [
          '....hhhhhhh..hh....hh...',
          '....h..............h....',
        ]),
      ],
    },
    left: {
      front: [
        ...SHORT_L,
        P(9, [
          '....................hh..',
          '...................hhhh.',
          '...................hhhh.',
          '....................hhh.',
          '....................hhh.',
          '....................hdh.',
          '....................hdh.',
          '....................hhh.',
          '...................hhh..',
          '...................hh...',
          '..................hh....',
        ]),
      ],
      ties: [P(9, ['rr', 'rr'], 18)],
    },
    up: {
      front: [
        CAP_U,
        P(12, [
          '..........hhhh..........',
          '..........hhhh..........',
          '..........hhhh..........',
          '..........hhhh..........',
          '..........hhhh..........',
          '..........hhhh..........',
          '.........hhhhhh.........',
          '.........hhdhhh.........',
          '.........hhdhhh.........',
          '..........hhhh..........',
          '..........hhhh..........',
          '...........hh...........',
        ]),
      ],
      ties: [P(11, ['rrrr'], 10)],
    },
  },
  // 4 おだんご
  {
    top: 2,
    tall: true,
    ear: true,
    down: {
      front: [
        P(2, [
          '..........hhhh..........',
          '.........hhllhh.........',
          '.........hhhhhh.........',
          '.........hhhhdh.........',
          '..........rrrr..........',
        ]),
        CAP_D,
        SHORT_D_BANGS,
      ],
    },
    left: {
      front: [
        P(3, [
          '............hhhh........',
          '...........hhlhhh.......',
          '...........hhhhhh.......',
          '............rrrr........',
        ]),
        ...SHORT_L,
      ],
    },
    up: {
      front: [
        P(2, [
          '..........hhhh..........',
          '.........hhhhhh.........',
          '.........hhlhhh.........',
          '.........hhhhhh.........',
          '..........rrrr..........',
        ]),
        CAP_U,
      ],
    },
  },
  // 5 ツインテール
  {
    top: 7,
    ear: true,
    down: {
      back: [
        P(10, [
          '..hhh..............hhh..',
          '.hhhh..............hhhh.',
          '.hhh................hhh.',
          '.hhh................hhh.',
          '.hhh................hhh.',
          '.hdh................hdh.',
          '.hdh................hdh.',
          '.hhh................hhh.',
          '.hhh................hhh.',
          '..hhh..............hhh..',
          '..hhh..............hhh..',
          '..hh................hh..',
          '...h................h...',
        ]),
      ],
      front: [CAP_D, SHORT_D_BANGS],
      ties: [P(8, ['rr..................rr', 'rr..................rr'], 1)],
    },
    left: {
      back: [
        P(10, [
          '..................hhh...',
          '..................hhhh..',
          '...................hhh..',
          '...................hhh..',
          '...................hhh..',
          '...................hdh..',
          '...................hdh..',
          '...................hhh..',
          '...................hhh..',
          '..................hhh...',
          '..................hhh...',
          '..................hh....',
          '..................h.....',
        ]),
      ],
      front: SHORT_L,
      ties: [P(8, ['rr', 'rr'], 18)],
    },
    up: {
      front: [
        CAP_U,
        P(10, [
          '..hhh..............hhh..',
          '.hhhh..............hhhh.',
          '.hhh................hhh.',
          '.hhh................hhh.',
          '.hhh................hhh.',
          '.hdh................hdh.',
          '.hdh................hdh.',
          '.hhh................hhh.',
          '.hhh................hhh.',
          '..hhh..............hhh..',
          '..hhh..............hhh..',
          '..hh................hh..',
          '...h................h...',
        ]),
      ],
      ties: [P(8, ['rr..................rr', 'rr..................rr'], 1)],
    },
  },
  // 6 ツンツン
  {
    top: 3,
    tall: true,
    ear: true,
    down: {
      front: [
        P(3, [
          '......h....hh....h......',
          '.....hh...hhhh...hh.....',
          '.....hhh.hhhhhh.hhh.....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhllhhhhhhhhhh....',
          '...hhhhlhhhhhhhhhhhhh...',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '...hhhhhhhhhhhhhhhhhh...',
          '....hh.hh.hhhh.hh.hh....',
          '....h..............h....',
        ]),
      ],
    },
    left: {
      front: [
        P(3, [
          '..........h......h......',
          '.........hh.....hh......',
          '.......hhhh...hhhh..h...',
          '....hhhhhhhhhhhhhhhhh...',
          '....hhhhhhhhhhhhhhhhhh..',
          '....hhhllhhhhhhhhhhhhhh.',
          '....hhhlhhhhhhhhhhhhh...',
          '....hhhhhhhhhhhhhhhhhh..',
          '....hhhhhhhhhhhhhhhh....',
          '....hh.h...hhhhhhhhhh...',
          '....h......hhhhhhhhh....',
          '...........hhhhhhhhhh...',
          '...........hhhhhhhhh....',
          '............hhhhhhhhh...',
          '.............hhhhhh.....',
        ]),
      ],
    },
    up: {
      front: [
        P(3, [
          '......h....hh....h......',
          '.....hh...hhhh...hh.....',
          '.....hhh.hhhhhh.hhh.....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhlhhhhhhhhh....',
          '...hhhhhhlhhhhhhhhhhh...',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '...hhhhhhhhhhhhhhhhhh...',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '.....hhhhhhhhhhhhhh.....',
          '.....hh.hhh.hhhh.hh.....',
        ]),
      ],
    },
  },
  // 7 マッシュ
  {
    top: 6,
    down: {
      front: [
        P(6, [
          '........hhhhhhhh........',
          '......hhhhhhhhhhhh......',
          '....hhhhhllhhhhhhhhh....',
          '...hhhhhlhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hdddddddddddddddhh...',
          '...hhh............hhh...',
          '...hh..............hh...',
          '...hh..............hh...',
        ]),
      ],
    },
    left: {
      front: [
        P(6, [
          '........hhhhhhhh........',
          '......hhhhhhhhhhhh......',
          '....hhhhllhhhhhhhhhh....',
          '...hhhhlhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...dddddddhhhhhhhhhhh...',
          '...hhh....hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '...........hhhhhhhhh....',
        ]),
      ],
    },
    up: {
      front: [
        P(6, [
          '........hhhhhhhh........',
          '......hhhhhhhhhhhh......',
          '....hhhhhhhllhhhhhhh....',
          '...hhhhhhhhhlhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...dddddddddddddddddd...',
          '....hhhhhhhhhhhhhhhh....',
          '.....hhhhhhhhhhhhhh.....',
        ]),
      ],
    },
  },
  // 8 ぼうず (painted inside the head outline, with a stubble texture)
  {
    top: 9,
    ear: true,
    outline: false,
    down: {
      front: [
        P(9, [
          '......hdhhdhhdhhdh......',
          '.....hhhdhhhhdhhhdh.....',
          '.....hdhhhdhhhdhhhh.....',
          '.....h............h.....',
        ]),
      ],
    },
    left: {
      front: [
        P(9, [
          '......hdhhdhhdhhdh......',
          '.....hhhdhhhhdhhhdh.....',
          '.....hdhhhdhhhdhhhh.....',
          '..........hhdhhdhhh.....',
          '..........hdhhdhhhh.....',
          '...........hhdhhhhh.....',
          '...........hdhhhhhh.....',
          '............hhdhhh......',
          '.............hhhh.......',
        ]),
      ],
    },
    up: {
      front: [
        P(9, [
          '......hdhhdhhdhhdh......',
          '.....hhhdhhhhdhhhdh.....',
          '.....hdhhhdhhhdhhhh.....',
          '.....hhhdhhhhdhhhdh.....',
          '.....hdhhhdhhhdhhhh.....',
          '.....hhhdhhhhdhhhdh.....',
          '.....hdhhhdhhhdhhhh.....',
          '.....hhhdhhhhdhhhdh.....',
          '......hhhhdhhhdhhh......',
        ]),
      ],
    },
  },
  // 9 アフロ
  {
    top: 1,
    down: {
      front: [
        P(1, [
          '.........hhhhhh.........',
          '......hhhhhdhhhhhh......',
          '....hhhdhhhhhhhdhhhh....',
          '...hhhhhhhlhhhhhhhdhh...',
          '..hhdhhhhllhhdhhhhhhhh..',
          '.hhhhhhdhhhhhhhhhhdhhhh.',
          'hhhhhhhhhhhhhdhhhhhhhhhh',
          '.hhhdhhhhhdhhhhhhdhhhhh.',
          '.hhhhhhhhhhhhhhhhhhhdhh.',
          'hhdhhhhdhhhhhdhhhhhhhhhh',
          '.hhhhhhhhhhhhhhhhhdhhhh.',
          '.hhhhh.hhhh..hhhh.hhhhh.',
          '.hhdh..............hdhh.',
          'hhhhh..............hhhhh',
          '.hhhh..............hhhh.',
          '..hhh..............hhh..',
          '...h................h...',
        ]),
      ],
    },
    left: {
      front: [
        P(1, [
          '..........hhhhhh........',
          '.......hhhhhhdhhhhh.....',
          '.....hhhdhhhhhhhdhhhh...',
          '....hhhhhllhhhhhhhhdhh..',
          '...hhhhhllhhhdhhhhhhhhh.',
          '..hhhhhhhhhhhhhhdhhhhhh.',
          '..hhhhdhhhhhhhhhhhhhdhhh',
          '..hhhhhhhhhdhhhhhhhhhhh.',
          '..hhhhhhhhhhhhhhhdhhhhh.',
          '..hhhdhhhhhhhhhhhhhhhhhh',
          '..hhhhhhhhhhhhhdhhhhdhh.',
          '..hhhh....hhhhhhhhhhhhh.',
          '..hh......hhhdhhhhhhhhh.',
          '..........hhhhhhhhdhhhhh',
          '..........hhhhhhhhhhhhh.',
          '...........hhhhhhhhhhh..',
          '.............hhhhhhh....',
        ]),
      ],
    },
    up: {
      front: [
        P(1, [
          '.........hhhhhh.........',
          '......hhhhhdhhhhhh......',
          '....hhhdhhhhhhhdhhhh....',
          '...hhhhhhhhhlhhhhhdhh...',
          '..hhdhhhhhhhllhhhhhhhh..',
          '.hhhhhhdhhhhhhhhhhdhhhh.',
          'hhhhhhhhhhhhhdhhhhhhhhhh',
          '.hhhdhhhhhdhhhhhhdhhhhh.',
          '.hhhhhhhhhhhhhhhhhhhdhh.',
          'hhdhhhhdhhhhhdhhhhhhhhhh',
          '.hhhhhhhhhhhhhhhhhdhhhh.',
          '.hhhhdhhhhhhdhhhhhhhhhh.',
          '.hhdhhhhhhhhhhhhhhhdhhh.',
          'hhhhhhhhhdhhhhhdhhhhhhhh',
          '.hhhhhhhhhhhhhhhhhhhhhh.',
          '..hhhhdhhhhhhhhhhdhhhh..',
          '...hhhhhhhhhhhhhhhhhh...',
          '.....hhhhhhhhhhhhhh.....',
        ]),
      ],
    },
  },
  // 10 七三
  {
    top: 7,
    ear: true,
    down: {
      front: [
        P(7, [
          '.......hhhhhhhdhh.......',
          '.....hhllhhhhhhdhhh.....',
          '....hhlhhhhhhhhdhhhh....',
          '....hhhhhhhhhhhhdhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhh....hh....',
          '....hhh............h....',
          '....h...................',
        ]),
      ],
    },
    left: {
      front: [
        P(7, [
          '.......hhhhhhhhhh.......',
          '.....hhllhhhhhhhhhh.....',
          '....hhlhhhdhhhhhhhhh....',
          '....hhhhhhhdhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhh..hhhhhhhhh....',
          '....hh.....hhhhhhhhh....',
          '...........hhhhhhhhh....',
          '...........hhhhhhhhh....',
          '............hhhhhhhh....',
          '.............hhhhhh.....',
        ]),
      ],
    },
    up: {
      front: [
        P(7, [
          '.......hhhhdhhhhh.......',
          '.....hhhhhhdhhhhhh......',
          '....hhhhhhhdhhhhhhhh....',
          '....hhhhhhhdhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '....hhhhhhhhhhhhhhhh....',
          '.....hhhhhhhhhhhhhh.....',
          '......hhhhhhhhhhhh......',
        ]),
      ],
    },
  },
  // 11 ウェーブ
  {
    top: 7,
    down: {
      front: [
        CAP_WIDE_D,
        P(12, [
          '...hhh.hhhh..hhhh.hhh...',
          '...hh..............hh...',
          '..hhd..............dhh..',
          '..hhh..............hhh..',
          '...hh..............hh...',
          '..hhd..............dhh..',
          '..hhh..............hhh..',
          '...hh..............hh...',
          '..hhd..............dhh..',
          '..hh................hh..',
          '..h..................h..',
        ]),
      ],
    },
    left: {
      front: [
        CAP_WIDE_D,
        P(12, [
          '...hhhh...hhhhhhhhhhh...',
          '..........hhhhhhhhhhh...',
          '.........hhhdhhhhhdhhh..',
          '..........hhhhhhhhhhhh..',
          '...........hhhhhhhhhh...',
          '..........hhhdhhhhhdhh..',
          '.........hhhhhhhhhhhhh..',
          '..........hhhhhhhhhhh...',
          '...........hhhdhhhhdh...',
          '...........hhhh..hhh....',
        ]),
      ],
    },
    up: {
      front: [
        P(7, [
          '.......hhhhhhhhhh.......',
          '.....hhhhhhllhhhhh......',
          '....hhhhhhlhhhhhhhhh....',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhhhhhhhhhhhhhhhh...',
          '...hhhdhhhhhhhhhhdhhh...',
          '..hhhhhdhhhhhhhhdhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '...hhhdhhhhhhhhhhdhhh...',
          '..hhhhhdhhhhhhhhdhhhhh..',
          '..hhhhhhhhhhhhhhhhhhhh..',
          '...hhhdhhhhhhhhhhdhhh...',
          '..hhhhhdhhhhhhhhdhhhhh..',
          '..hhh.hhhhh..hhhhh.hhh..',
          '..h....hhh....hhh....h..',
        ]),
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// eyes (left eye at x 7..9, rows 14..16; the right eye is the mirror image)

const EYE_ART: string[][] = [
  ['...', '.wk', '.kk'], // ふつう
  ['...', '.k.', 'k.k'], // にっこり
  ['kk.', '.kk', '.wk'], // キリッ
  ['wkk', 'kkk', 'kkk'], // まんまる
  ['...', '...', 'kkk'], // ねむい
  ['kkk', 'kwi', 'kii'], // キラキラ
];
const EYE_SMILE = 1;
const EYE_SLEEPY = 4;

// ---------------------------------------------------------------------------
// accessories

interface AccArt {
  /** 'hat' covers the top of the head (flattens tall hair); 'top' sits on top; 'face' ignores hair height. */
  kind: 'hat' | 'top' | 'face';
  /** Highest design row it reaches when not lifted; lifting stops before it leaves the canvas. */
  top?: number;
  draw: (p: Painter, v: View, lift: number, ctx: Ctx) => void;
}

const HAT_PAL = (c: string): Pal => ({ c, b: shade(c, -0.25), w: WHITE, l: shade(c, 0.35), y: '#ffc145', r: CORAL, k: INK });

function shifted(list: Pat[], lift: number): Pat[] {
  return list.map((p) => ({ ...p, y: p.y + lift }));
}

const ACC_ART: AccArt[] = [
  // 0 なし
  { kind: 'face', draw: () => undefined },
  // 1 メガネ
  {
    kind: 'face',
    draw: (p, v) => {
      const pal: Pal = { k: '#3b3446', g: '#cfe6ff' };
      if (v === 'down') {
        p.pat(P(13, ['.kkk...kkk.', 'k...kkk...k', 'k...k.k...k', 'k...k.k...k', '.kkk...kkk.'], 6), pal);
        p.pat(P(14, ['k............k'], 5), pal);
      } else if (v === 'left') {
        p.pat(P(13, ['.kkk.', 'k...k', 'k...kkkkk', 'k...k', '.kkk.'], 4), pal);
      } else {
        p.pat(P(15, ['k..............k'], 4), pal);
      }
    },
  },
  // 2 サングラス
  {
    kind: 'face',
    draw: (p, v) => {
      const pal: Pal = { k: '#1d1a24', s: '#3a3550', w: '#8fd3ff' };
      if (v === 'down') {
        p.pat(P(13, ['kkkkkkkkkkkkk', 'kwssskkkwsssk', 'ksssk...ksssk', '.kkk.....kkk.'], 5), pal);
        p.pat(P(14, ['k..............k'], 4), pal);
      } else if (v === 'left') {
        p.pat(P(13, ['kkkkkkkkk', 'kwssk', 'kssk', '.kk'], 4), pal);
      } else {
        p.pat(P(14, ['k..............k'], 4), pal);
      }
    },
  },
  // 3 キャップ
  {
    kind: 'hat',
    top: 3,
    draw: (p, v, lift) => {
      const pal = HAT_PAL('#4d8ff0');
      p.part(() => {
        if (v === 'down') {
          p.pats(
            shifted(
              [
                P(3, [
                  '...........w............',
                  '.........cccccc.........',
                  '.......cccwwwwccc.......',
                  '......cccwwwwwwccc......',
                  '.....cccccwwwwccccc.....',
                  '....cccccccccccccccc....',
                  '....cccccccccccccccc....',
                  '...bbbbbbbbbbbbbbbbbb...',
                  '....bbbbbbbbbbbbbbbb....',
                ]),
              ],
              lift,
            ),
            pal,
          );
        } else if (v === 'left') {
          p.pats(
            shifted(
              [
                P(3, [
                  '...........w............',
                  '.........cccccc.........',
                  '.......ccccccccc........',
                  '......cccccccccccc......',
                  '.....ccccccccccccccc....',
                  '....cccccccccccccccc....',
                  '....cccccccccccccccc....',
                  'bbbbbbbbccccccccccccc...',
                  '.bbbbbb.................',
                ]),
              ],
              lift,
            ),
            pal,
          );
        } else {
          p.pats(
            shifted(
              [
                P(3, [
                  '...........w............',
                  '.........cccccc.........',
                  '.......cccccccccc.......',
                  '......cccccccccccc......',
                  '.....cccccccccccccc.....',
                  '....cccccccccccccccc....',
                  '....cccccccccccccccc....',
                  '....ccccccc..ccccccc....',
                  '..........yyyy..........',
                ]),
              ],
              lift,
            ),
            pal,
          );
        }
      });
    },
  },
  // 4 ニット帽
  {
    kind: 'hat',
    top: 2,
    draw: (p, _v, lift) => {
      const pal: Pal = { m: '#2ec4a6', d: '#1f9c83', f: '#7fe0cb', w: WHITE, g: '#e6ddd0' };
      p.part(() => {
        p.pats(
          shifted(
            [
              P(1, [
                '..........wwww..........',
                '.........wwwwgw.........',
                '..........wwgw..........',
                '.......mmmmmmmmmm.......',
                '.....mmdmmdmmdmmdmm.....',
                '....mmdmmdmmdmmdmmdm....',
                '....mmmmmmmmmmmmmmmm....',
                '....ffdffdffdffdffdf....',
                '....ffffffffffffffff....',
              ]),
            ],
            lift + 1,
          ),
          pal,
        );
      });
    },
  },
  // 5 ヘッドホン
  {
    kind: 'top',
    top: 6,
    draw: (p, v, lift) => {
      const pal: Pal = { g: '#4a4458', c: CORAL, l: '#ffa898', d: '#c9493a' };
      const bandY = 6 + Math.min(0, lift);
      if (v === 'left') {
        p.part(() => {
          p.rect(12, bandY, 2, 13 - bandY, pal.g!);
          p.pat(P(12, ['.cccc', 'cclcc', 'cccdc', 'ccccc', '.ccc.'], 10), pal);
        });
        return;
      }
      p.part(() => {
        p.rect(7, bandY, 10, 1, pal.g!);
        p.sym(5, bandY + 1, 2, 1, pal.g!);
        p.sym(4, bandY + 2, 1, 11 - bandY - 2, pal.g!);
        p.pat(P(11, ['ccc', 'clc', 'ccc', 'cdc', 'ccc'], 2), pal);
        p.pat(P(11, ['ccc', 'clc', 'ccc', 'cdc', 'ccc'], 2), pal, true);
      });
    },
  },
  // 6 ネコ耳
  {
    kind: 'top',
    top: 3,
    draw: (p, v, lift, ctx) => {
      const pal: Pal = { h: ctx.hairColor, p: v === 'up' ? shade(ctx.hairColor, -0.2) : '#ff9fb4' };
      const ear = ['h...', 'hh..', 'hph.', 'hpph', 'hhhh'];
      p.part(() => {
        if (v === 'left') {
          p.pat(P(3 + lift, ear, 8), pal);
          p.pat(P(3 + lift, ['...h', '..hh', '.hhh', 'hhhh', 'hhhh'], 12), { h: shade(ctx.hairColor, -0.15) });
        } else {
          p.pat(P(3 + lift, ear, 5), pal);
          p.pat(P(3 + lift, ear, 5), pal, true);
        }
      });
    },
  },
  // 7 ウサ耳
  {
    kind: 'top',
    top: -1,
    draw: (p, v, lift) => {
      const pal: Pal = { w: WHITE, p: v === 'up' ? '#efe6ea' : '#ffb3c6' };
      const ear = ['.w.', 'www', 'wpw', 'wpw', 'wpw', 'wpw', 'www', '.w.'];
      p.part(() => {
        if (v === 'left') {
          p.pat(P(-1 + lift, ['..w.', '.www', '.wpw', 'wpw.', 'wpw.', 'wpw.', 'www.', '.w..'], 10), pal);
          p.pat(P(0 + lift, ['...w.', '..www', '.wwww', '.www.', 'www..', 'www..', 'ww...'], 13), { w: '#e9e2dc' });
        } else {
          p.pat(P(-1 + lift, ear, 7), pal);
          p.pat(P(-1 + lift, ear, 7), pal, true);
        }
      });
    },
  },
  // 8 リボン
  {
    kind: 'top',
    top: 4,
    draw: (p, v, lift) => {
      const pal: Pal = { r: '#ff5d8f', d: '#d63e70', l: '#ff9dbb' };
      const bow = ['rr...rr', 'rlr.rlr', 'rrrdrrr', 'rrr.rrr', 'rr...rr'];
      const y = 4 + lift;
      p.part(() => {
        if (v === 'down') p.pat(P(y, bow, 14), pal);
        else if (v === 'up') p.pat(P(y, bow, 14), pal, true);
        else p.pat(P(y, bow, 13), pal);
      });
    },
  },
  // 9 王冠
  {
    kind: 'top',
    top: 2,
    draw: (p, _v, lift) => {
      const pal: Pal = { y: '#ffc145', d: '#e09a1f', l: '#ffe48a', r: '#e8475a', b: '#4d8ff0' };
      p.part(() => {
        p.pat(P(2 + lift, ['l..ll..l', 'yy.yy.yy', 'yyyyyyyy', 'yryybyry', 'dddddddd'], 8), pal);
      });
    },
  },
  // 10 花かざり
  {
    kind: 'face',
    draw: (p, v) => {
      const pal: Pal = { p: '#ff8fb8', d: '#f06a9a', y: '#ffd23f', g: '#5cbf5a' };
      const flower = ['.p.p.', 'ppppp', '.pyp.', 'ppdpp', '.p.pg'];
      p.part(() => {
        if (v === 'down') p.pat(P(7, flower, 15), pal);
        else if (v === 'up') p.pat(P(7, flower, 15), pal, true);
        else p.pat(P(8, flower, 13), pal);
      });
    },
  },
  // 11 マスク
  {
    kind: 'face',
    draw: (p, v) => {
      const pal: Pal = { w: '#f4f7fb', g: '#c7d0dc' };
      if (v === 'down') {
        p.pat(P(16, ['g..........g', '.wwwwwwwwww.', 'wwggwwwwggww', '.wwwwwwwwww.'], 6), pal);
      } else if (v === 'left') {
        p.pat(P(16, ['.....ggg', 'wwwwg', 'wgwwg', 'wwww'], 5), pal);
      } else {
        p.pat(P(16, ['g..............g'], 4), pal);
      }
    },
  },
  // 12 天使の輪
  {
    kind: 'top',
    top: 1,
    draw: (p, _v, lift) => {
      const pal: Pal = { y: '#ffe066', l: '#fff6c2' };
      p.part(() => {
        p.pat(P(1 + lift, ['..llyyyy..', 'yy......yy', '..yyyyyy..'], 7), pal);
      }, '#c9962a');
    },
  },
  // 13 ツノ
  {
    kind: 'top',
    top: 4,
    draw: (p, v, lift) => {
      const pal: Pal = { r: '#e0483a', l: '#ff8a70', d: '#a82e2a' };
      const horn = ['l..', 'rr.', '.rr', '.dr'];
      p.part(() => {
        if (v === 'left') {
          p.pat(P(4 + lift, horn, 8), pal);
          p.pat(P(4 + lift, ['..l', '.rr', 'rr.', 'rd.'], 13), pal);
        } else {
          p.pat(P(4 + lift, horn, 6), pal);
          p.pat(P(4 + lift, horn, 6), pal, true);
        }
      });
    },
  },
  // 14 ベレー帽
  {
    kind: 'hat',
    top: 4,
    draw: (p, v, lift) => {
      const pal: Pal = { b: '#d64545', d: '#a93232', l: '#f07070' };
      p.part(() => {
        const rows =
          v === 'up'
            ? ['............b...........', '........bbbbbbbbb.......', '......bbbbbbbbbbbbb.....', '...bbbbbbbbbbbbbbbbb....', '..bbbbbbbbbbbbbbbbbb....', '.....dddddddddddddd.....']
            : ['...........b............', '.......bbbbbbbbb........', '.....bbblbbbbbbbbb......', '....bbblbbbbbbbbbbbbb...', '....bbbbbbbbbbbbbbbbbb..', '.....dddddddddddddd.....'];
        p.pats(shifted([P(4, rows)], lift), pal);
      });
    },
  },
  // 15 麦わら帽子
  {
    kind: 'hat',
    top: 3,
    draw: (p, _v, lift) => {
      const pal: Pal = { s: '#f2d27a', d: '#d9b45a', r: '#e0483a' };
      p.part(() => {
        p.pats(
          shifted(
            [
              P(3, [
                '........ssssssss........',
                '.......ssdssdssss.......',
                '.......ssssssssss.......',
                '.......rrrrrrrrrr.......',
                '.ssssssssssssssssssssss.',
                '..sdssdssdssdssdssdsss..',
              ]),
            ],
            lift,
          ),
          pal,
        );
      });
    },
  },
  // 16 魔女の帽子
  {
    kind: 'hat',
    top: -1,
    draw: (p, _v, lift) => {
      const pal: Pal = { v: '#7b5cd6', V: '#5a3fb0', l: '#9d84ea', y: '#ffc145' };
      p.part(() => {
        p.pats(
          shifted(
            [
              P(-1, [
                '..............vv........',
                '.............vvv........',
                '............vvv.........',
                '...........vvvv.........',
                '..........vvvvv.........',
                '.........vlvvvvv........',
                '........vlvvvvvvv.......',
                '.......yyyyyyyyyy.......',
                '..vvvvvvvvvvvvvvvvvvvv..',
                '.VVVVVVVVVVVVVVVVVVVVVV.',
              ]),
            ],
            lift,
          ),
          pal,
        );
      });
    },
  },
  // 17 ひげ
  {
    kind: 'face',
    draw: (p, v, _l, ctx) => {
      const m = shade(ctx.hairColor, -0.35);
      if (v === 'down') p.pat(P(17, ['..mmmmmm..', 'mmm....mmm'], 7), { m });
      else if (v === 'left') p.pat(P(17, ['mmmm', '.mm'], 4), { m });
    },
  },
  // 18 葉っぱ
  {
    kind: 'top',
    top: 2,
    draw: (p, _v, lift) => {
      const pal: Pal = { g: '#5cbf5a', d: '#3a8f3c', l: '#8fdc7a', s: '#8a5a32' };
      p.part(() => {
        p.pat(P(2 + lift, ['...ggg', '..glgg', '.ggdgg', '.gdgg.', 'gdgg..', 's.....'], 10), pal);
      });
    },
  },
  // 19 ハチマキ
  {
    kind: 'face',
    draw: (p, v) => {
      const pal: Pal = { w: WHITE, r: '#e0483a', g: '#e2dbd0' };
      p.part(() => {
        if (v === 'down') {
          p.pat(P(10, ['wwwwwwwrrwwwwwww', 'wwwwwwwrrwwwwwww'], 4), pal);
          p.pat(P(9, ['.ww', 'www', '.ww', '..w'], 20), pal);
        } else if (v === 'left') {
          p.pat(P(10, ['wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww'], 4), pal);
          p.pat(P(9, ['ww..', 'wwww', '.www', '..ww'], 19), pal);
        } else {
          p.pat(P(10, ['wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww'], 4), pal);
          p.pat(P(10, ['.ww.', 'wwww', '.ww.', 'w..w', 'w..w'], 10), pal);
        }
      });
    },
  },
];

// ---------------------------------------------------------------------------
// costumes (animal hoods + onesies)

interface CostumeArt {
  m: string; // main colour
  l: string; // light (belly, paws)
  d: string; // dark (feet, details)
  /** extra colours used by this costume's pictures */
  pal?: Pal;
  back?: (p: Painter, v: View) => void; // drawn behind the head
  ears?: (p: Painter, v: View) => void; // drawn behind the hood
  face?: (p: Painter, v: View) => void; // drawn on the hood
  tail?: (p: Painter, v: View) => void;
  body?: 'ghost' | 'robot';
  hoodRound?: boolean;
  noBelly?: boolean;
}

function hoodShape(p: Painter, v: View, c: string): void {
  if (v === 'down') {
    p.rect(7, 6, 10, 1, c);
    p.rect(5, 7, 14, 1, c);
    p.rect(4, 8, 16, 1, c);
    p.rect(3, 9, 18, 2, c);
    p.sym(3, 11, 2, 9, c);
    p.sym(4, 20, 2, 1, c);
  } else if (v === 'left') {
    p.rect(7, 6, 10, 1, c);
    p.rect(5, 7, 14, 1, c);
    p.rect(4, 8, 16, 1, c);
    p.rect(3, 9, 18, 2, c);
    p.rect(11, 11, 10, 8, c);
    p.rect(11, 19, 9, 1, c);
    p.rect(12, 20, 6, 1, c);
  } else {
    p.rect(7, 6, 10, 1, c);
    p.rect(5, 7, 14, 1, c);
    p.rect(4, 8, 16, 1, c);
    p.rect(3, 9, 18, 10, c);
    p.rect(4, 19, 16, 1, c);
    p.rect(5, 20, 14, 1, c);
  }
}

/** Two little animal eyes on the hood's forehead. */
function hoodEyes(p: Painter, v: View, y = 8, c = INK): void {
  if (v === 'down') {
    p.sym(8, y, 1, 2, c);
  } else if (v === 'left') {
    p.rect(6, y, 1, 2, c);
  }
}

function earPair(p: Painter, v: View, rows: string[], pal: Pal, x: number, y: number, sideX = [8, 12]): void {
  if (v === 'left') {
    p.pat(P(y, rows, sideX[1]), { ...pal, p: pal.m! }, true);
    p.pat(P(y, rows, sideX[0]), pal);
  } else {
    const back = v === 'up' ? { ...pal, p: pal.m! } : pal;
    p.pat(P(y, rows, x), back);
    p.pat(P(y, rows, x), back, true);
  }
}

const COSTUME_ART: (CostumeArt | null)[] = [
  null, // なし
  // 1 ネコ
  {
    m: '#f6b26b',
    l: '#fff1dc',
    d: '#d9893e',
    ears: (p, v) => earPair(p, v, ['m...', 'mm..', 'mpm.', 'mppm', 'mmmm'], { m: '#f6b26b', p: '#ff9fb4' }, 4, 2),
    face: (p, v) => {
      hoodEyes(p, v);
      if (v !== 'left') p.rect(10, 6, 4, 1, '#d9893e');
      if (v === 'down') p.rect(11, 7, 2, 1, '#d9893e');
      if (v === 'up') p.rect(10, 8, 4, 1, '#d9893e');
    },
    tail: (p, v) => {
      p.part(() => {
        if (v === 'up') p.pat(P(19, ['...mm', '...dm', '..mm.', '..mm', '.mm.', '.dm.'], 12), { m: '#f6b26b', d: '#d9893e' });
        else p.pat(P(18, ['.....mm', '....mdm', '...mm..', '..mm...', 'mmd....'], 14), { m: '#f6b26b', d: '#d9893e' });
      });
    },
  },
  // 2 イヌ
  {
    m: '#f3e2c7',
    l: '#fffaf0',
    d: '#a0673a',
    ears: (p, v) => {
      const pal = { e: '#a0673a', d: '#7d4c28' };
      if (v === 'left') p.pat(P(8, ['eeee', 'eeee', 'eeed', 'eeed', 'eee.', '.ee.'], 13), pal);
      else {
        const ear = ['.eee', 'eeee', 'eeee', 'deee', 'deee', 'eee.', 'ee..'];
        p.pat(P(8, ear, 0), pal);
        p.pat(P(8, ear, 0), pal, true);
      }
    },
    face: (p, v) => {
      hoodEyes(p, v);
      if (v === 'down') p.rect(11, 9, 2, 1, INK);
      if (v === 'left') p.rect(4, 9, 1, 1, INK);
      if (v !== 'left') p.rect(10, 6, 4, 2, '#a0673a');
    },
    tail: (p, v) => {
      p.part(() => {
        if (v === 'up') p.pat(P(21, ['.mm.', 'mmmm', '.mm.'], 10), { m: '#a0673a' });
        else p.pat(P(19, ['...mm', '..mmm', '.mm..', 'mm...'], 15), { m: '#a0673a' });
      });
    },
  },
  // 3 クマ
  {
    m: '#9a6a43',
    l: '#e6c49a',
    d: '#6e4628',
    ears: (p, v) => earPair(p, v, ['.mmm.', 'mpppm', 'mpppm', 'mmmm.'], { m: '#9a6a43', p: '#e6c49a' }, 3, 4, [6, 13]),
    face: (p, v) => {
      hoodEyes(p, v);
      if (v === 'down') p.pat(P(8, ['.ll.', 'lkkl'], 10), { l: '#e6c49a', k: INK });
      if (v === 'left') p.pat(P(8, ['ll', 'kl'], 3), { l: '#e6c49a', k: INK });
    },
    tail: (p, v) => {
      p.part(() => {
        if (v === 'up') p.pat(P(23, ['mm', 'mm'], 11), { m: '#6e4628' });
        else p.pat(P(23, ['mm', 'mm'], 16), { m: '#6e4628' });
      });
    },
  },
  // 4 パンダ
  {
    m: '#f7f5f0',
    l: '#ffffff',
    d: '#2b2433',
    pal: { k: '#2b2433' },
    ears: (p, v) => earPair(p, v, ['.kkk.', 'kkkkk', 'kkkkk', 'kkkk.'], { k: '#3b3446', m: '#3b3446', p: '#3b3446' }, 3, 4, [6, 13]),
    face: (p, v) => {
      if (v === 'down') {
        p.pat(P(7, ['.kk', 'kwk', 'kk.'], 6), { k: '#3b3446', w: WHITE });
        p.pat(P(7, ['.kk', 'kwk', 'kk.'], 6), { k: '#3b3446', w: WHITE }, true);
        p.rect(11, 9, 2, 1, INK);
      } else if (v === 'left') {
        p.pat(P(7, ['kk', 'wk', 'k.'], 4), { k: '#3b3446', w: WHITE });
      }
    },
    tail: (p, v) => {
      p.part(() => {
        if (v === 'up') p.pat(P(23, ['mm', 'mm'], 11), { m: '#3b3446' });
        else p.pat(P(23, ['mm', 'mm'], 16), { m: '#3b3446' });
      });
    },
  },
  // 5 ウサギ
  {
    m: '#fbf4f6',
    l: '#ffffff',
    d: '#f2c6d3',
    ears: (p, v) => {
      const pal = { m: '#fbf4f6', p: '#ffb3c6' };
      if (v === 'left') {
        p.pat(P(-2, ['...mm', '..mmm', '..mpm', '.mpm.', '.mpm.', 'mpm..', 'mmm..', 'mm...', 'mm...'], 13), { m: '#efe4e8', p: '#efe4e8' });
        p.pat(P(-2, ['..mm', '.mmm', '.mpm', '.mpm', 'mpm.', 'mpm.', 'mmm.', 'mm..', 'mm..'], 9), pal);
      } else {
        const ear = ['.mm.', 'mmmm', 'mppm', 'mppm', 'mppm', 'mppm', 'mppm', 'mmmm', '.mm.'];
        const pp = v === 'up' ? { m: '#fbf4f6', p: '#efe4e8' } : pal;
        p.pat(P(-2, ear, 6), pp);
        p.pat(P(-2, ear, 6), pp, true);
      }
    },
    face: (p, v) => {
      hoodEyes(p, v, 8, '#e05a7a');
    },
    tail: (p, v) => {
      p.part(() => {
        if (v === 'up') p.pat(P(22, ['.ww.', 'wwww', '.ww.'], 10), { w: WHITE });
        else p.pat(P(22, ['ww.', 'www', 'ww.'], 16), { w: WHITE });
      });
    },
  },
  // 6 カエル
  {
    m: '#6cc04a',
    l: '#d9f2b3',
    d: '#4a9a32',
    ears: (p, v) => {
      const eye = ['.mmmm.', 'mwwwwm', 'mwkkwm', 'mwkkwm', '.mmmm.'];
      const back = ['.mmmm.', 'mmmmmm', 'mmmmmm', 'mmmmmm', '.mmmm.'];
      const pal = { m: '#6cc04a', w: WHITE, k: INK };
      if (v === 'left') {
        p.pat(P(3, back, 11), pal);
        p.pat(P(3, ['.mmmm.', 'mwwwwm', 'mkkwwm', 'mkkwwm', '.mmmm.'], 5), pal);
      } else {
        const r = v === 'up' ? back : eye;
        p.pat(P(3, r, 4), pal);
        p.pat(P(3, r, 4), pal, true);
      }
    },
    face: (p, v) => {
      if (v === 'down') {
        p.rect(9, 9, 6, 1, '#4a9a32');
        p.sym(8, 8, 1, 1, '#4a9a32');
        p.sym(7, 10, 1, 1, '#ff9fb4');
      }
      if (v === 'left') p.rect(4, 9, 3, 1, '#4a9a32');
    },
  },
  // 7 ペンギン
  {
    m: '#3a4258',
    l: '#ffffff',
    d: '#ffa53a',
    face: (p, v) => {
      if (v === 'down') {
        p.pat(P(8, ['.w.......w.', 'wkw.....wkw', 'w..ooooo..w'], 6), { w: WHITE, k: INK, o: '#ffa53a' });
        p.pat(P(11, ['ooo'], 10), { o: '#e8862a' });
      } else if (v === 'left') {
        p.pat(P(8, ['.w.', 'wkw', 'ooo'], 5), { w: WHITE, k: INK, o: '#ffa53a' });
        p.pat(P(10, ['oo'], 3), { o: '#ffa53a' });
      }
    },
    tail: (p, v) => {
      p.part(() => {
        if (v === 'left') p.pat(P(23, ['mm.', 'mmm'], 16), { m: '#3a4258' });
      });
    },
  },
  // 8 ロボット
  {
    m: '#b5c0cf',
    l: '#dfe6ef',
    d: '#7d8aa0',
    body: 'robot',
    ears: (p, v) => {
      p.part(() => {
        if (v === 'left') {
          p.rect(13, 2, 1, 4, '#7d8aa0');
          p.pat(P(0, ['.rr.', 'rlrr', '.rr.'], 12), { r: '#e8475a', l: '#ff9aa6' });
        } else {
          p.rect(11, 2, 2, 4, '#7d8aa0');
          p.pat(P(0, ['.rr.', 'rlrr', '.rr.'], 10), { r: '#e8475a', l: '#ff9aa6' });
        }
      });
      p.part(() => {
        if (v === 'left') p.pat(P(12, ['yyy', 'ydy', 'yyy'], 13), { y: '#ffc145', d: '#d99a1f' });
        else {
          p.pat(P(12, ['yy', 'yd', 'yy', 'yy'], 1), { y: '#ffc145', d: '#d99a1f' });
          p.pat(P(12, ['yy', 'yd', 'yy', 'yy'], 1), { y: '#ffc145', d: '#d99a1f' }, true);
        }
      });
    },
    face: (p, v) => {
      if (v === 'down') {
        p.pat(P(8, ['dldldldldl'], 7), { d: '#7d8aa0', l: '#5ee0c2' });
        p.sym(4, 10, 1, 1, '#7d8aa0');
      } else if (v === 'left') {
        p.pat(P(8, ['dldl'], 4), { d: '#7d8aa0', l: '#5ee0c2' });
        p.rect(15, 14, 1, 1, '#7d8aa0');
      } else {
        p.rect(7, 10, 10, 1, '#7d8aa0');
        p.sym(6, 14, 1, 1, '#7d8aa0');
      }
    },
  },
  // 9 おばけ
  {
    m: '#f4f6ff',
    l: '#ffffff',
    d: '#c9cff0',
    body: 'ghost',
    hoodRound: true,
    face: (p, v) => {
      if (v === 'down') p.sym(5, 9, 2, 1, '#dfe3fb');
      if (v === 'up') p.rect(9, 9, 6, 1, '#dfe3fb');
    },
  },
  // 10 ドラゴン
  {
    m: '#e8603c',
    l: '#ffe1a8',
    d: '#b8432a',
    ears: (p, v) => {
      const pal = { i: '#fff1c9', j: '#e6cf98' };
      const horn = ['i..', 'ii.', 'jii', '.ji'];
      if (v === 'left') {
        p.pat(P(3, ['..i', '.ii', 'iij', 'ij.'], 12), pal);
        p.pat(P(3, horn, 7), pal);
      } else {
        p.pat(P(3, horn, 5), pal);
        p.pat(P(3, horn, 5), pal, true);
      }
    },
    face: (p, v) => {
      hoodEyes(p, v, 8, '#ffc145');
      const sp = { y: '#ffc145' };
      if (v === 'down') p.pat(P(5, ['.y..y.', 'yyyyyy'], 9), sp);
      else if (v === 'left') p.pat(P(4, ['....y...y..', '...yy..yy..', '..yyy.yyy.'], 9), sp);
      else p.pat(P(5, ['.y..y.', 'yyyyyy'], 9), sp);
    },
    tail: (p, v) => {
      p.part(() => {
        const pal = { m: '#e8603c', y: '#ffc145', d: '#b8432a' };
        if (v === 'up') p.pat(P(20, ['..yy..', '.mmmm.', '.mdmm.', 'mmmmmm', 'mmmmmm', 'y.mm.y', '..mm..'], 9), pal);
        else p.pat(P(20, ['.....y.', '....mmm', '...mmmd', '.ymmmm.', 'mmmm...', 'mmy....'], 15), pal);
      });
      // little wings
      if (v !== 'down') {
        p.part(() => {
          const w = { w: '#b8432a', l: '#e8603c' };
          if (v === 'up') {
            p.pat(P(19, ['w...', 'ww..', 'wlw.', 'wllw', 'www.'], 3), w);
            p.pat(P(19, ['w...', 'ww..', 'wlw.', 'wllw', 'www.'], 3), w, true);
          } else p.pat(P(18, ['..w', '.ww', 'wlw', 'wlw', 'ww.'], 15), w);
        });
      }
    },
  },
  // 11 サメ
  {
    m: '#6f9fd8',
    l: '#eef6ff',
    d: '#4f7fb8',
    ears: (p, v) => {
      const pal = { m: '#6f9fd8', d: '#4f7fb8' };
      if (v === 'left') p.pat(P(1, ['....m', '...mm', '..mmm', '.mmmm', 'mmmmd', 'mmmmd'], 12), pal);
      else p.pat(P(1, ['..mm..', '.mmmm.', '.mmmm.', 'mmmmmm', 'mmddmm', 'mmmmmm'], 9), pal);
    },
    face: (p, v) => {
      const t = { w: WHITE, k: INK };
      if (v === 'down') {
        p.pat(P(11, ['.kkkkkkkkkkkk.', 'kwkwkwkwkwkwkk', '.w.w.w.w.w.w..'], 5), t);
        p.sym(6, 9, 1, 1, INK);
      } else if (v === 'left') {
        p.pat(P(11, ['kkkkkk', 'wkwkwk', 'w.w.w'], 4), t);
        p.rect(7, 9, 1, 1, INK);
      } else {
        p.rect(7, 12, 10, 1, '#eef6ff');
      }
    },
    tail: (p, v) => {
      p.part(() => {
        const pal = { m: '#6f9fd8', d: '#4f7fb8' };
        if (v === 'up') p.pat(P(22, ['.mm.', 'mmmm', 'm..m'], 10), pal);
        else p.pat(P(20, ['....m', '...mm', '.mmm.', 'mmmm.', '...mm', '....m'], 15), pal);
      });
    },
  },
  // 12 ライオン
  {
    m: '#f2b84b',
    l: '#fff0c9',
    d: '#c98a2a',
    back: (p, v) => {
      // the mane: a big spiky ring around the hood
      const pal = { n: '#c8642e', N: '#a34d22' };
      p.part(() => {
        if (v === 'left') {
          p.pat(
            P(3, [
              '.........n..n..n........',
              '.......nnnnnnnnnnn......',
              '.....nnnnnnnnnnnnnnn.n..',
              '....nnnnnnnnnnnnnnnnnn..',
              '...nnnnnnnnnnnnnnnnnnnn.',
              '..nnnnnnnnnnnnnnnnnnnnnn',
              '...nnnnnnnnnnnnnnnnnnnn.',
              '........nnnnnnnnnnnnnnnn',
              '.........nnnnnnnnnnnnnn.',
              '.........nnnnnnnnnnnnnnn',
              '.........nnnnnnnNnnnnnn.',
              '.........nnnnnnnnnnnnnnn',
              '.........nnnnnNnnnnnnnn.',
              '..........nnnnnnnnnnnnn.',
              '...........nnnnnnnnnnnn.',
              '............nnnnnnnnn...',
              '.............nnn.nnn....',
            ]),
            pal,
          );
        } else {
          p.pat(
            P(3, [
              '.......n..n..n..n.......',
              '.....nnnnnnnnnnnnnn.....',
              '...n.nnnnnnnnnnnnnn.n...',
              '..nnnnnnnnnnnnnnnnnnnn..',
              '.nnnnnnnnnnnnnnnnnnnnnn.',
              'nnnnnnnnnnnnnnnnnnnnnnnn',
              '.nnnnnnnnnnnnnnnnnnnnnn.',
              'nnnnnnnnnnnnnnnnnnnnnnnn',
              '.nnNnnnnnnnnnnnnnnnnNnn.',
              'nnnnnnnnnnnnnnnnnnnnnnnn',
              '.nnnnnnnnnnnnnnnnnnnnnn.',
              'nnnNnnnnnnnnnnnnnnnnNnnn',
              '.nnnnnnnnnnnnnnnnnnnnnn.',
              '..nnnnnnnnnnnnnnnnnnnn..',
              '..nnnnnnnnnnnnnnnnnnnn..',
              '...nnnnnnnnnnnnnnnnnn...',
              '....nnn.nnnnnnnn.nnn....',
            ]),
            pal,
          );
        }
      });
    },
    ears: (p, v) => {
      if (v !== 'left') earPair(p, v, ['.mm.', 'mppm', 'mmmm'], { m: '#f2b84b', p: '#c98a2a' }, 5, 5);
      else p.pat(P(5, ['.mm.', 'mppm', 'mmmm'], 9), { m: '#f2b84b', p: '#c98a2a' });
    },
    face: (p, v) => {
      hoodEyes(p, v);
      if (v === 'down') p.pat(P(9, ['.kk.'], 10), { k: INK });
    },
    tail: (p, v) => {
      p.part(() => {
        const pal = { m: '#f2b84b', n: '#c8642e' };
        if (v === 'up') p.pat(P(20, ['..nn', '..nn', '..m.', '.m..', 'm...'], 11), pal);
        else p.pat(P(19, ['....nn', '....nn', '...m..', '..m...', 'mm....'], 15), pal);
      });
    },
  },
  // 13 キツネ
  {
    m: '#f08a3c',
    l: '#fff4e6',
    d: '#c9652a',
    ears: (p, v) => earPair(p, v, ['k....', 'mk...', 'mpm..', 'mppm.', 'mpppm', 'mmmmm'], { m: '#f08a3c', p: '#fff4e6', k: '#5a3020' }, 3, 1, [7, 12]),
    face: (p, v) => {
      hoodEyes(p, v);
      if (v === 'down') {
        p.sym(5, 11, 2, 1, '#fff4e6');
      }
    },
    tail: (p, v) => {
      p.part(() => {
        const pal = { m: '#f08a3c', w: '#fff4e6' };
        if (v === 'up') p.pat(P(19, ['..mmm.', '.mmmmm', '.mmmmm', 'mmmmm.', 'mmmm..', 'www...', 'ww....'], 12), pal);
        else p.pat(P(18, ['...ww.', '..mwww', '.mmmmw', 'mmmmm.', 'mmmm..', 'mmm...'], 16), pal);
      });
    },
  },
  // 14 ユニコーン
  {
    m: '#fbf7ff',
    l: '#ffffff',
    d: '#d8c8f0',
    ears: (p, v) => {
      // horn
      p.part(() => {
        const pal = { y: '#ffd23f', d: '#e0a92a' };
        if (v === 'left') p.pat(P(0, ['y...', 'yy..', 'dyy.', '.dyy', '..yy'], 6), pal);
        else if (v === 'down') p.pat(P(0, ['.y.', '.y.', 'yd.', '.yy', 'dyy', 'yyd'], 10), pal);
      });
      earPair(p, v, ['.m', 'mm', 'mp', 'mm'], { m: '#fbf7ff', p: '#ffb3c6' }, 5, 4, [9, 14]);
    },
    face: (p, v) => {
      hoodEyes(p, v, 8, '#7b5cd6');
      const mane = { a: '#ff8fb8', b: '#ffd23f', c: '#7fd0ff', e: '#b49cf5' };
      if (v === 'down') p.pat(P(6, ['abce', 'abce', '.bce', '..ce', '...e'], 14), mane);
      else if (v === 'left') p.pat(P(6, ['.abce', 'aabce', 'abbce', 'abcce', '.bcee', '.bce.', '..ce.', '..e..'], 16), mane);
      else p.pat(P(6, ['..abce..', '..abce..', '..abce..', '..abce..', '..abce..', '..abce..', '..abce..', '..abce..'], 8), mane);
    },
    tail: (p, v) => {
      p.part(() => {
        const pal = { a: '#ff8fb8', b: '#ffd23f', c: '#7fd0ff', e: '#b49cf5' };
        if (v === 'up') p.pat(P(21, ['abce', 'abce', '.bc.'], 10), pal);
        else p.pat(P(20, ['...ab', '..abc', '.abce', 'abce.', 'bce..'], 15), pal);
      });
    },
  },
];

// ---------------------------------------------------------------------------
// outfits

interface Ctx {
  look: AvatarLook;
  v: View;
  step: number; // -1, 0, 1 walking
  sit: boolean;
  skin: string;
  hairColor: string;
  main: string;
}

type SleeveKind = 'short' | 'long' | 'wide' | 'none';
interface Wear {
  top: string;
  sleeve: string;
  sleeves: SleeveKind;
  cuff?: string;
  hand?: string;
  pants: string; // leg colour (skin = bare legs)
  shoe: string;
  sock?: string;
  skirt?: string; // flared skirt colour over the hips
  robe?: string; // long robe/coat covering the legs
  coatTails?: string; // open coat tails over the legs
}

const JEANS = '#4a6496';
const DARK = '#3b3446';
const SNEAKER = '#f4f1ea';
const BROWN_SHOE = '#6b4430';

function contrast(main: string, a: string, b: string): string {
  return lum(main) > 0.62 ? b : a;
}

function wearFor(o: number, main: string, skin: string): Wear {
  switch (o) {
    case 1: // パーカー
      return { top: main, sleeve: main, sleeves: 'long', cuff: shade(main, -0.15), pants: DARK, shoe: SNEAKER };
    case 2: // スーツ
      return { top: main, sleeve: main, sleeves: 'long', pants: shade(main, -0.22), shoe: BROWN_SHOE };
    case 3: // ワンピース
      return { top: main, sleeve: main, sleeves: 'short', pants: skin, shoe: '#c4453c', skirt: main };
    case 4: // オーバーオール
      return { top: WHITE, sleeve: WHITE, sleeves: 'short', pants: main, shoe: BROWN_SHOE };
    case 5: // 白衣
      return { top: '#f7f7f2', sleeve: '#f7f7f2', sleeves: 'long', pants: DARK, shoe: '#2f2a36', coatTails: '#f7f7f2' };
    case 6: // ジャージ
      return { top: main, sleeve: main, sleeves: 'long', pants: main, shoe: SNEAKER };
    case 7: // 着物
      return { top: main, sleeve: main, sleeves: 'wide', pants: main, shoe: '#c4453c', sock: WHITE, robe: main };
    case 8: // セーター
      return { top: main, sleeve: main, sleeves: 'long', cuff: shade(main, -0.18), pants: '#c9a46a', shoe: BROWN_SHOE };
    case 9: // アロハ
      return { top: main, sleeve: main, sleeves: 'short', pants: '#d8c08e', shoe: '#e0483a' };
    case 10: // セーラー服
      return { top: WHITE, sleeve: WHITE, sleeves: 'long', cuff: main, pants: skin, shoe: '#4a3428', sock: WHITE, skirt: main };
    case 11: // ボーダー
      return { top: main, sleeve: main, sleeves: 'long', pants: JEANS, shoe: SNEAKER };
    default: // Tシャツ
      return { top: main, sleeve: main, sleeves: 'short', pants: JEANS, shoe: SNEAKER };
  }
}

/** Legs and shoes (standing / walking / sitting). */
function drawLegs(p: Painter, c: Ctx, w: Wear): void {
  const { v, step, sit } = c;
  const legC = w.robe ?? w.pants;
  const shoe = w.shoe;
  const sock = w.sock;
  if (sit) {
    p.part(() => {
      if (v === 'left') {
        p.rect(6, 26, 8, 2, legC);
        p.rect(6, 28, 3, 1, sock ?? legC);
        p.rect(5, 28, 3, 1, shoe);
      } else {
        const knee = w.skirt ?? legC;
        if (v === 'down') p.sym(7, 26, 4, 2, knee);
        p.sym(8, 28, 3, 1, shoe);
      }
    });
    return;
  }
  if (v === 'left') {
    const far = step === 0 ? 12 : step === 1 ? 14 : 8;
    const near = step === 0 ? 9 : step === 1 ? 8 : 14;
    for (const [x, dark] of [
      [far, true],
      [near, false],
    ] as [number, boolean][]) {
      p.part(() => {
        const lc = dark ? shade(legC, -0.15) : legC;
        p.rect(x, 26, 3, 2, lc);
        if (sock) p.rect(x, 27, 3, 1, sock);
        p.rect(x - 1, 28, 4, 1, dark ? shade(shoe, -0.12) : shoe);
      });
    }
    return;
  }
  p.part(() => {
    for (const [x, lifted] of [
      [8, step === -1],
      [13, step === 1],
    ] as [number, boolean][]) {
      const h = lifted ? 1 : 2;
      p.rect(x, 26, 3, h, legC);
      if (sock) p.rect(x, 26 + h - 1, 3, 1, sock);
      p.rect(x, 26 + h, 3, 1, shoe);
    }
  });
}

/** Torso and arms as one part; returns nothing, details are added after. */
function drawTorso(p: Painter, c: Ctx, w: Wear): void {
  const { v, step, skin } = c;
  const hand = w.hand ?? skin;
  if (v === 'left') {
    p.part(() => {
      p.rect(8, 20, 8, 6, w.top);
      if (w.skirt) {
        p.rect(7, 24, 10, 1, w.skirt);
        p.rect(6, 25, 11, 2, w.skirt);
      }
      if (w.robe) p.rect(8, 26, 8, 2, w.robe);
      if (w.coatTails) p.rect(10, 26, 6, 1, w.coatTails);
    });
    // the near arm, swinging (outlined in a dark shade so the narrow side body stays readable)
    p.part(() => {
      const fx = step === 1 ? -1 : step === -1 ? 1 : 0;
      const sl = w.sleeve;
      if (w.sleeves === 'wide') {
        p.rect(10, 20, 4, 2, sl);
        p.rect(10 + fx, 22, 5, 3, sl);
        p.rect(10 + fx, 25, 2, 1, hand);
        return;
      }
      p.rect(10, 20, 4, 1, sl);
      p.rect(11, 21, 2, 2, sl);
      p.rect(11 + fx, 23, 2, 2, w.sleeves === 'short' ? skin : sl);
      if (w.cuff) p.rect(11 + fx, 24, 2, 1, w.cuff);
      p.rect(11 + fx * 2, 25, 2, 1, hand);
    }, mix(shade(w.sleeve, -0.45), INK, 0.5));
    return;
  }
  p.part(() => {
    p.rect(7, 20, 10, 6, w.top);
    if (w.skirt) {
      p.rect(6, 24, 12, 2, w.skirt);
      p.rect(5, 26, 14, 1, w.skirt);
    }
    if (w.robe) p.rect(7, 26, 10, 2, w.robe);
    if (w.coatTails) p.sym(7, 26, 3, 1, w.coatTails);
    // arms: left arm reaches lower when stepping one way, right arm the other
    for (const [x, ext] of [
      [5, step === 1 ? 1 : step === -1 ? -1 : 0],
      [17, step === -1 ? 1 : step === 1 ? -1 : 0],
    ] as [number, number][]) {
      const sl = w.sleeve;
      if (w.sleeves === 'wide') {
        const ox = x === 5 ? -1 : 0;
        p.rect(x + ox, 20, 3, 5 + ext, sl);
        p.rect(x, 25 + ext, 2, 1, hand);
        continue;
      }
      p.rect(x, 21, 2, 2, sl);
      p.rect(x, 23, 2, 1 + ext + 1, w.sleeves === 'short' ? skin : sl);
      if (w.cuff) p.rect(x, 24 + ext, 2, 1, w.cuff);
      p.rect(x, 25 + ext, 2, 1, hand);
    }
    p.rect(6, 20, 1, 1, w.sleeve);
    p.rect(17, 20, 1, 1, w.sleeve);
  });
}

const FLOWER = { w: '#fffdf7', y: '#ffd23f', g: '#5cbf5a' };

function outfitDetails(p: Painter, c: Ctx, o: number, w: Wear): void {
  const { v, main } = c;
  const dk = shade(main, -0.2);
  const lt = shade(main, 0.3);
  const front = v === 'down';
  const side = v === 'left';
  switch (o) {
    case 0: // Tシャツ: crew neck + a small star print
      if (front) {
        p.rect(10, 20, 4, 1, dk);
        p.pat(P(21, ['s..s', '....', '.ss.'], 10), { s: contrast(main, WHITE, CORAL) });
      } else if (side) p.rect(9, 20, 2, 1, dk);
      break;
    case 1: // パーカー: hood, strings, pocket
      if (front) {
        p.rect(8, 20, 8, 1, dk);
        p.rect(10, 21, 1, 2, WHITE);
        p.rect(13, 21, 1, 2, WHITE);
        p.rect(9, 23, 6, 2, dk);
        p.rect(10, 24, 4, 1, shade(main, -0.32));
      } else if (v === 'up') {
        p.part(() => p.pat(P(19, ['.hhhhhh.', 'hhhhhhhh', 'hhhddhhh', '.hhhhhh.'], 8), { h: main, d: dk }));
      } else {
        p.part(() => p.pat(P(19, ['hhh', 'hhhh', 'hhd', 'hh'], 14), { h: main, d: dk }));
        p.rect(9, 23, 3, 2, dk);
      }
      break;
    case 2: {
      // スーツ: shirt V, tie, lapels, buttons
      const tie = lum(main) < 0.35 || /^#(ff6f|f08a|c46a)/.test(main) ? (main === '#ff6f59' ? '#2f4f8f' : '#e0483a') : '#d4433a';
      if (front) {
        p.pat(P(20, ['wwww', 'wttw', '.tt.', '.tt.', '.tt.'], 10), { w: WHITE, t: tie });
        p.rect(9, 20, 1, 3, dk);
        p.rect(14, 20, 1, 3, dk);
        p.rect(11, 25, 2, 1, dk);
      } else if (side) {
        p.pat(P(20, ['ww', 'wt', '.t', '.t'], 8), { w: WHITE, t: tie });
      } else {
        p.rect(11, 21, 2, 5, dk);
      }
      break;
    }
    case 3: // ワンピース: white round collar + waist ribbon
      if (front) {
        p.pat(P(20, ['wwwwww', '.w..w.'], 9), { w: WHITE });
        p.rect(7, 23, 10, 1, dk);
        p.rect(11, 23, 2, 1, lt);
        p.rect(6, 26, 12, 1, lt);
      } else if (side) {
        p.rect(8, 20, 3, 1, WHITE);
        p.rect(8, 23, 8, 1, dk);
      } else {
        p.rect(7, 23, 10, 1, dk);
        p.pat(P(22, ['r.r', 'rrr', 'r.r'], 11), { r: dk });
      }
      break;
    case 4: // オーバーオール: bib, straps, buttons
      p.part(() => {
        if (front) {
          p.rect(9, 22, 6, 2, main);
          p.rect(8, 20, 1, 2, main);
          p.rect(15, 20, 1, 2, main);
          p.rect(7, 24, 10, 2, main);
        } else if (side) {
          p.rect(8, 22, 5, 2, main);
          p.rect(9, 20, 1, 2, main);
          p.rect(8, 24, 8, 2, main);
        } else {
          p.pat(P(20, ['m......m', '.m....m.', '..m..m..', '...mm...'], 8), { m: main });
          p.rect(7, 24, 10, 2, main);
        }
      });
      if (front) {
        p.rect(9, 22, 1, 1, '#ffc145');
        p.rect(14, 22, 1, 1, '#ffc145');
        p.rect(11, 23, 2, 1, dk);
      }
      if (v === 'up') p.rect(10, 25, 4, 1, dk);
      break;
    case 5: // 白衣: inner shirt, lapels, pocket with pen
      if (front) {
        p.pat(P(20, ['.ssss.', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..'], 9), { s: main });
        p.rect(10, 20, 1, 3, '#d9d9d2');
        p.rect(13, 20, 1, 3, '#d9d9d2');
        p.rect(14, 23, 2, 1, '#d9d9d2');
        p.rect(15, 22, 1, 1, '#4d8ff0');
      } else if (side) {
        p.rect(8, 20, 1, 4, main);
        p.rect(13, 23, 2, 1, '#d9d9d2');
      } else {
        p.rect(11, 23, 1, 4, '#d9d9d2');
      }
      break;
    case 6: // ジャージ: zip, collar and white stripes
      if (front) {
        p.rect(9, 20, 6, 1, dk);
        p.rect(11, 21, 1, 5, WHITE);
        p.rect(12, 21, 1, 1, '#c9c2b6');
        p.rect(5, 21, 1, 3, WHITE);
        p.rect(18, 21, 1, 3, WHITE);
        if (!c.sit) {
          p.rect(8, 26, 1, 1, WHITE);
          p.rect(15, 26, 1, 1, WHITE);
        }
      } else if (side) {
        p.rect(8, 20, 3, 1, dk);
        p.rect(11, 21, 1, 3, WHITE);
      } else {
        p.rect(9, 20, 6, 1, dk);
        p.rect(5, 21, 1, 3, WHITE);
        p.rect(18, 21, 1, 3, WHITE);
        p.rect(8, 22, 8, 1, WHITE);
      }
      break;
    case 7: {
      // 着物: crossed collar, obi
      const obi = contrast(main, '#ffc145', '#e0483a') === '#ffc145' && main !== '#ffc145' ? '#ffc145' : '#e0483a';
      if (front) {
        p.pat(P(20, ['w....w', 'kw..wk', '.kwwk.', '..kk..'], 9), { w: WHITE, k: dk });
        p.rect(7, 23, 10, 2, obi);
        p.rect(7, 24, 10, 1, shade(obi, -0.2));
        p.rect(11, 23, 2, 1, '#e0483a');
        p.rect(11, 25, 1, 3, dk);
      } else if (side) {
        p.pat(P(20, ['w..', 'kw.', '.kw'], 8), { w: WHITE, k: dk });
        p.rect(8, 23, 8, 2, obi);
      } else {
        p.part(() => p.pat(P(22, ['oooooo', 'oddddo', 'oooooo'], 9), { o: obi, d: shade(obi, -0.2) }));
        p.rect(7, 23, 2, 1, obi);
        p.rect(15, 23, 2, 1, obi);
      }
      break;
    }
    case 8: // セーター: collar points + knit
      if (front) {
        p.pat(P(20, ['ww..ww', '.w..w.'], 9), { w: WHITE });
        p.rect(9, 22, 1, 3, dk);
        p.rect(14, 22, 1, 3, dk);
        p.pat(P(22, ['d.d.', '.d.d', 'd.d.'], 10), { d: lt });
        p.pat(P(25, ['dddddddddd'], 7), { d: dk });
      } else if (side) {
        p.rect(8, 20, 2, 1, WHITE);
        p.rect(12, 22, 1, 3, dk);
        p.rect(8, 25, 8, 1, dk);
      } else {
        p.rect(9, 22, 1, 3, dk);
        p.rect(14, 22, 1, 3, dk);
        p.rect(7, 25, 10, 1, dk);
      }
      break;
    case 9: // アロハ: open collar + flower print
      if (front) {
        p.pat(P(20, ['ww..ww', '.w..w.'], 9), { w: WHITE });
        p.rect(11, 22, 2, 1, skinShadow(c.skin));
        for (const [x, y] of [
          [8, 22],
          [14, 21],
          [10, 24],
          [15, 24],
        ] as [number, number][]) {
          p.pat(P(y, ['.w.', 'wyw', '.w.'], x - 1), FLOWER);
        }
        p.rect(12, 25, 1, 1, '#5cbf5a');
      } else if (side) {
        p.pat(P(21, ['.w.', 'wyw', '.w.'], 12), FLOWER);
        p.pat(P(23, ['.w.', 'wyw', '.w.'], 8), FLOWER);
      } else {
        for (const [x, y] of [
          [9, 21],
          [14, 23],
          [8, 24],
        ] as [number, number][]) {
          p.pat(P(y, ['.w.', 'wyw', '.w.'], x - 1), FLOWER);
        }
      }
      break;
    case 10: {
      // セーラー服: collar, scarf, pleats
      const sc = '#e0483a';
      if (front) {
        p.pat(P(20, ['cc......cc', 'ccw....wcc', '.cc.rr.cc.', '...rrrr...', '....rr....'], 7), { c: main, w: WHITE, r: sc });
        p.rect(8, 25, 1, 1, dk);
        p.rect(11, 25, 1, 1, dk);
        p.rect(14, 25, 1, 1, dk);
        p.rect(6, 26, 12, 1, dk);
      } else if (side) {
        p.pat(P(20, ['.cccc', 'r.ccc', 'rr.cc'], 10), { c: main, r: sc });
      } else {
        p.part(() => p.pat(P(20, ['cccccccc', 'cwwwwwwc', 'cccccccc'], 8), { c: main, w: WHITE }));
        p.rect(9, 25, 1, 1, dk);
        p.rect(14, 25, 1, 1, dk);
      }
      break;
    }
    case 11: // ボーダー: stripes on body and sleeves
      for (let y = 21; y <= 25; y += 2) {
        if (side) p.rect(8, y, 8, 1, WHITE);
        else p.rect(7, y, 10, 1, WHITE);
      }
      if (!side) {
        p.rect(5, 22, 2, 1, WHITE);
        p.rect(17, 22, 2, 1, WHITE);
      }
      break;
  }
}

function skinShadow(skin: string): string {
  return shade(skin, -0.12);
}

/** Onesie / robot body / ghost sheet for a costume. */
function drawCostumeBody(p: Painter, c: Ctx, k: CostumeArt, up: number): void {
  const { v, step, sit } = c;
  p.oy = up;
  if (k.body === 'ghost') {
    const pal = { m: k.m, d: k.d };
    p.part(() => {
      const hem = (step === 0 ? ['m.mm.mm.mm.m', '.m..m..m..m.'] : step === 1 ? ['mm.mm.mm.mm.', 'm..m..m..m..'] : ['.mm.mm.mm.mm', '..m..m..m..m']);
      if (v === 'left') {
        p.rect(7, 20, 11, 7, k.m);
        p.pat(P(27, hem.map((r) => r.slice(0, 11))), pal, false);
        p.cut(0, 27, 7, 2);
        p.rect(7 + (step === 1 ? -1 : step === -1 ? 1 : 0), 22, 3, 2, k.m);
      } else {
        p.rect(5, 20, 14, 7, k.m);
        p.pat({ y: 27, x: 6, rows: hem }, pal);
        p.rect(3, 21 + (step === 1 ? 1 : 0), 2, 2, k.m);
        p.rect(19, 21 + (step === -1 ? 1 : 0), 2, 2, k.m);
      }
      if (sit) p.cut(0, 28, GW, 1);
    });
    p.rect(v === 'left' ? 9 : 7, 25, v === 'left' ? 8 : 10, 1, k.d);
    return;
  }
  const w: Wear = {
    top: k.m,
    sleeve: k.m,
    sleeves: 'long',
    hand: k.body === 'robot' ? k.d : k.l,
    pants: k.m,
    shoe: k.d,
  };
  if (sit) {
    drawTorso(p, c, w);
    p.oy = BASE;
    drawLegs(p, c, w);
    p.oy = up;
  } else {
    p.oy = BASE;
    drawLegs(p, c, w);
    drawTorso(p, c, w);
  }
  if (k.body === 'robot') {
    if (v === 'down') {
      p.pat(P(21, ['dddddd', 'drgyld', 'dddddd'], 9), { d: '#7d8aa0', r: '#e8475a', g: '#5ee0c2', y: '#ffc145', l: '#4d8ff0' });
      p.rect(5, 23, 2, 1, '#7d8aa0');
      p.rect(17, 23, 2, 1, '#7d8aa0');
    } else if (v === 'left') {
      p.pat(P(21, ['ddd', 'rgd'], 8), { d: '#7d8aa0', r: '#e8475a', g: '#5ee0c2' });
    } else {
      p.rect(9, 21, 6, 4, '#a1adbf');
      p.pat(P(22, ['k.k.', '.k.k'], 10), { k: '#7d8aa0' });
    }
    return;
  }
  if (v === 'down' && !k.noBelly) {
    p.pat(P(21, ['.llll.', 'llllll', 'llllll', '.llll.'], 9), { l: k.l });
  }
  if (v === 'left' && !k.noBelly) p.rect(8, 21, 2, 4, k.l);
}

// ---------------------------------------------------------------------------
// putting it together

function hairPal(c: string): Pal {
  return { h: c, d: shade(c, -0.18), l: shade(c, 0.28), r: CORAL };
}

function paint(look: AvatarLook, dir: Dir, frame: number, pose: 'stand' | 'sit'): (string | null)[] {
  const p = new Painter();
  const v: View = dir === 'right' ? 'left' : dir;
  const sit = pose === 'sit';
  const step = sit ? 0 : frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const skin = SKIN[look.skin] ?? SKIN[0]!;
  const hairColor = HAIR[look.hair] ?? HAIR[0]!;
  const main = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0]!;
  const c: Ctx = { look, v, step, sit, skin, hairColor, main };
  const hair = HAIR_ART[look.hairStyle] ?? HAIR_ART[0]!;
  const hv = hair[v];
  const hp = hairPal(hairColor);
  const costume = COSTUME_ART[look.costume] ?? null;
  const acc = ACC_ART[look.accessory] ?? ACC_ART[0]!;
  const hat = acc.kind === 'hat';
  const up = sit ? BASE + 2 : BASE;

  // things behind the body
  p.oy = up;
  if (costume) {
    if (v === 'left' && costume.tail) costume.tail(p, v);
  } else if (hv.back) {
    p.part(() => p.pats(hv.back, hp));
  }

  // body
  if (costume) {
    drawCostumeBody(p, c, costume, up);
  } else {
    const w = wearFor(look.outfit, main, skin);
    if (sit) {
      p.oy = up;
      drawTorso(p, c, w);
      outfitDetails(p, c, look.outfit, w);
      p.oy = BASE;
      drawLegs(p, c, w);
    } else {
      p.oy = BASE;
      drawLegs(p, c, w);
      drawTorso(p, c, w);
      outfitDetails(p, c, look.outfit, w);
    }
  }
  p.oy = up;
  if (costume && v === 'up' && costume.tail) costume.tail(p, v);

  costume?.back?.(p, v);

  // head
  p.part(() => {
    p.rect(6, 9, 12, 1, skin);
    p.rect(5, 10, 14, 9, skin);
    p.rect(6, 19, 12, 1, skin);
  });

  // face
  if (v !== 'up') {
    const eye = EYE_ART[look.eyes] ?? EYE_ART[0]!;
    const ePal: Pal = { k: INK, w: WHITE, i: '#4d8ff0' };
    const blush = mix(skin, '#ff6f6f', 0.35);
    if (v === 'down') {
      p.pat(P(14, eye, 7), ePal);
      p.pat(P(14, eye, 7), ePal, true);
      p.sym(6, 17, 2, 1, blush);
      if (look.eyes === EYE_SMILE) p.pat(P(17, ['kk', 'mm'], 11), { k: MOUTH, m: '#e86a6a' });
      else if (look.eyes === EYE_SLEEPY) p.rect(11, 18, 2, 1, MOUTH);
      else p.pat(P(17, ['k..k', '.kk.'], 10), { k: MOUTH });
    } else {
      p.pat(P(14, eye, 6), ePal, false);
      p.rect(7, 17, 2, 1, blush);
      p.rect(6, 18, 1, 1, MOUTH);
    }
  }

  // hair or hood
  let top = hair.top;
  if (costume) {
    if (costume.ears && !(costume.hoodRound)) costume.ears(p, v);
    p.part(() => {
      hoodShape(p, v, costume.m);
      if (costume.hoodRound) {
        p.cut(7, 6, 10, 1);
        p.rect(8, 5, 8, 1, costume.m);
        p.rect(6, 6, 12, 1, costume.m);
      }
    });
    // a peek of fringe under the hood
    if (v === 'down') {
      p.rect(7, 11, 10, 1, hairColor);
      p.rect(9, 12, 2, 1, hairColor);
      p.rect(13, 12, 2, 1, hairColor);
    } else if (v === 'left') {
      p.rect(5, 11, 4, 1, hairColor);
      p.rect(5, 12, 2, 1, hairColor);
    }
    costume.face?.(p, v);
    top = costume.hoodRound ? 5 : 6;
  } else {
    if (hat && hair.tall) {
      p.clipTop = 7;
      top = 7;
    }
    p.part(() => p.pats(hv.front, hp), hair.outline === false ? null : INK);
    p.clipTop = -99;
    if (hv.ties) p.part(() => p.pats(hv.ties, hp));
    if (v === 'left' && hair.ear) {
      p.part(() => p.rect(12, 15, 2, 2, skin));
      p.rect(12, 16, 1, 1, skinShadow(skin));
    }
  }
  // accessory
  const lift = acc.kind === 'face' ? 0 : Math.max(-1 - (acc.top ?? 7), Math.min(0, top - 7));
  acc.draw(p, v, lift, c);

  if (dir === 'right') p.mirror();
  return p.px;
}

const cache = new Map<string, HTMLCanvasElement>();

function lookKey(look: AvatarLook): string {
  return `${look.skin}.${look.hair}.${look.hairStyle}.${look.eyes}.${look.outfit}.${look.outfitColor}.${look.accessory}.${look.costume}`;
}

function render(px: (string | null)[]): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = SPRITE_W;
  cv.height = SPRITE_H;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < px.length; i++) {
    const c = px[i];
    if (!c) continue;
    const x = i % GW;
    const y = (i - x) / GW;
    ctx.fillStyle = c;
    ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
  }
  return cv;
}

/**
 * Returns a canvas with the avatar drawn on it (cached).
 * frame 0 = standing, 1 and 2 = the two walking steps.
 */
export function avatarSprite(look: AvatarLook, dir: Dir, frame: number, pose: 'stand' | 'sit' = 'stand'): HTMLCanvasElement {
  const f = pose === 'sit' ? 0 : frame === 1 || frame === 2 ? frame : 0;
  const key = `${lookKey(look)}.${dir}.${f}.${pose}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 2000) cache.clear();
  const cv = render(paint(look, dir, f, pose));
  cache.set(key, cv);
  return cv;
}

const topCache = new Map<string, number>();

/** Distance in px from the feet to the top of this avatar (standing, facing down). */
export function headTop(look: AvatarLook): number {
  const key = lookKey(look);
  const hit = topCache.get(key);
  if (hit !== undefined) return hit;
  const px = paint(look, 'down', 0, 'stand');
  let row = 0;
  while (row < GH && !px.slice(row * GW, row * GW + GW).some(Boolean)) row++;
  const v = (FEET_ROW - row) * SCALE;
  topCache.set(key, v);
  return v;
}

/** Draws head and shoulders, facing down, into a canvas of any size (member lists, video tiles). */
export function drawPortrait(target: HTMLCanvasElement, look: AvatarLook, bg?: string): void {
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, target.width, target.height);
  }
  const s = avatarSprite(look, 'down', 0);
  // crop: from a little above the hair down to the shoulders, never taller than wide-ish
  const headTopRow = FEET_ROW - headTop(look) / SCALE;
  const bottom = 24 + BASE; // shoulders
  const top = Math.max(headTopRow, bottom - 20);
  const rows = bottom - top;
  const cols = Math.min(GW, Math.max(rows, 18));
  const srcH = rows * SCALE;
  const srcW = cols * SCALE;
  const srcX = ((GW - cols) / 2) * SCALE;
  let scale = Math.min(target.width / srcW, target.height / srcH);
  if (scale >= 2) scale = Math.floor(scale);
  const w = srcW * scale;
  const hgt = srcH * scale;
  ctx.drawImage(s, srcX, top * SCALE, srcW, srcH, Math.round((target.width - w) / 2), Math.round(target.height - hgt), Math.round(w), Math.round(hgt));
}

export function portraitCanvas(look: AvatarLook, size: number, bg?: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  drawPortrait(c, look, bg);
  return c;
}
