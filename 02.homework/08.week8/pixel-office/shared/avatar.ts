// Avatar options shared by the server (to validate) and the browser (to draw).
// AvatarLook stores an index into each list below.

export interface AvatarLook {
  skin: number;
  hair: number; // hair color
  hairStyle: number;
  eyes: number;
  outfit: number;
  outfitColor: number;
  accessory: number;
  costume: number; // 0 = none, otherwise an animal costume (hood with ears)
  pet: number; // 0 = none
}

export const SKIN = ['#ffe3cc', '#f8cfa8', '#e9b48a', '#c98d62', '#9b6340', '#6e4429'];

export const HAIR = [
  '#2b2630', '#5a3826', '#8f5a32', '#c98a3e', '#f0c75a', '#e8e1d6',
  '#a6a6b4', '#d4523f', '#f08ab0', '#7b5cd6', '#3f8fd8', '#3aa77a',
];

export const HAIR_STYLES = [
  'ショート', 'ボブ', 'ロング', 'ポニーテール', 'おだんご', 'ツインテール',
  'ツンツン', 'マッシュ', 'ぼうず', 'アフロ', '七三', 'ウェーブ',
];

export const EYES = ['ふつう', 'にっこり', 'キリッ', 'まんまる', 'ねむい', 'キラキラ'];

export const OUTFITS = [
  'Tシャツ', 'パーカー', 'スーツ', 'ワンピース', 'オーバーオール',
  '白衣', 'ジャージ', '着物', 'セーター', 'アロハ',
  'セーラー服', 'ボーダー',
];

export const OUTFIT_COLORS = [
  '#ff6f59', '#ffc145', '#2ec4a6', '#4d8ff0', '#9b6cf0',
  '#f08ab0', '#3b3446', '#f4efe6', '#7fbf4d', '#c46a3a',
];

export const ACCESSORIES = [
  'なし', 'メガネ', 'サングラス', 'キャップ', 'ニット帽', 'ヘッドホン', 'ネコ耳',
  'ウサ耳', 'リボン', '王冠', '花かざり', 'マスク', '天使の輪', 'ツノ',
  'ベレー帽', '麦わら帽子', '魔女の帽子', 'ひげ', '葉っぱ', 'ハチマキ',
];

export const COSTUMES = [
  'なし', 'ネコ', 'イヌ', 'クマ', 'パンダ', 'ウサギ', 'カエル', 'ペンギン', 'ロボット', 'おばけ', 'ドラゴン',
  'サメ', 'ライオン', 'キツネ', 'ユニコーン',
];

export const PETS = [
  'なし', 'ネコ', 'イヌ', 'ひよこ', 'スライム', 'ペンギン', 'ウサギ', 'おばけ', 'ミニロボ',
  'ハムスター', 'カメ', 'ミニドラゴン',
];

export const DEFAULT_LOOK: AvatarLook = {
  skin: 1,
  hair: 1,
  hairStyle: 0,
  eyes: 0,
  outfit: 0,
  outfitColor: 0,
  accessory: 0,
  costume: 0,
  pet: 0,
};

/** How many choices each field has. Used for validation and random looks. */
export const LOOK_SIZES: Record<keyof AvatarLook, number> = {
  skin: SKIN.length,
  hair: HAIR.length,
  hairStyle: HAIR_STYLES.length,
  eyes: EYES.length,
  outfit: OUTFITS.length,
  outfitColor: OUTFIT_COLORS.length,
  accessory: ACCESSORIES.length,
  costume: COSTUMES.length,
  pet: PETS.length,
};

const KEYS = Object.keys(LOOK_SIZES) as (keyof AvatarLook)[];

/** Returns a safe AvatarLook, or null if the input is not one. Missing fields get defaults. */
export function sanitizeLook(v: unknown): AvatarLook | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const out = { ...DEFAULT_LOOK };
  for (const k of KEYS) {
    const val = o[k];
    if (val === undefined) continue;
    if (!Number.isInteger(val) || (val as number) < 0 || (val as number) >= LOOK_SIZES[k]) return null;
    out[k] = val as number;
  }
  return out;
}

/** A random look (no costume, no pet most of the time) for first-time visitors. */
export function randomLook(rand: () => number = Math.random): AvatarLook {
  const pick = (n: number) => Math.floor(rand() * n);
  return {
    skin: pick(SKIN.length),
    hair: pick(HAIR.length),
    hairStyle: pick(HAIR_STYLES.length),
    eyes: pick(EYES.length),
    outfit: pick(OUTFITS.length),
    outfitColor: pick(OUTFIT_COLORS.length),
    accessory: rand() < 0.5 ? 0 : pick(ACCESSORIES.length),
    costume: rand() < 0.85 ? 0 : 1 + pick(COSTUMES.length - 1),
    pet: rand() < 0.7 ? 0 : 1 + pick(PETS.length - 1),
  };
}
