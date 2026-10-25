// Model: the user's own preferences, remembered in this browser (localStorage).
// Nothing important depends on it: if storage is blocked, defaults are used.

import { randomLook, sanitizeLook } from '../../../shared/avatar.ts';
import { MAX_NAME, cleanText } from '../../../shared/constants.ts';
import type { AvatarLook } from '../../../shared/types.ts';

export type VideoLayout = 'map' | 'row' | 'grid';
export type Weather = 'none' | 'sakura' | 'snow' | 'rain' | 'leaves';
export type Daylight = 'auto' | 'day' | 'evening' | 'night';

export interface Settings {
  /** Random secret that identifies this browser (so your notes and files stay yours). Never shown. */
  clientKey: string;
  name: string;
  look: AvatarLook;
  micId: string;
  camId: string;
  speakerId: string;
  micOnJoin: boolean;
  camOnJoin: boolean;
  layout: VideoLayout;
  weather: Weather;
  daylight: Daylight;
  sounds: boolean;
  minimap: boolean;
  recentSpaces: string[];
}

const KEY = 'pixel-office:settings';
const ANIMALS = ['カピバラ', 'レッサーパンダ', 'クジラ', 'ペンギン', 'カワウソ', 'フクロウ', 'ハリネズミ', 'アルパカ', 'ラッコ', 'シマエナガ'];
const LAYOUTS: VideoLayout[] = ['map', 'row', 'grid'];
const WEATHERS: Weather[] = ['none', 'sakura', 'snow', 'rain', 'leaves'];
const DAYLIGHTS: Daylight[] = ['auto', 'day', 'evening', 'night'];

function newKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function defaults(): Settings {
  return {
    clientKey: newKey(),
    name: ANIMALS[Math.floor(Math.random() * ANIMALS.length)]!,
    look: randomLook(),
    micId: '',
    camId: '',
    speakerId: '',
    micOnJoin: false,
    camOnJoin: false,
    layout: 'map',
    weather: 'none',
    daylight: 'auto',
    sounds: true,
    minimap: true,
    recentSpaces: [],
  };
}

function oneOf<T extends string>(v: unknown, list: T[], fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback;
}

export function loadSettings(): Settings {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<Settings>;
    const key = typeof o.clientKey === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(o.clientKey) ? o.clientKey : d.clientKey;
    const s: Settings = {
      clientKey: key,
      name: cleanText(o.name, MAX_NAME) || d.name,
      look: sanitizeLook(o.look) ?? d.look,
      micId: typeof o.micId === 'string' ? o.micId : '',
      camId: typeof o.camId === 'string' ? o.camId : '',
      speakerId: typeof o.speakerId === 'string' ? o.speakerId : '',
      micOnJoin: o.micOnJoin === true,
      camOnJoin: o.camOnJoin === true,
      layout: oneOf(o.layout, LAYOUTS, d.layout),
      weather: oneOf(o.weather, WEATHERS, d.weather),
      daylight: oneOf(o.daylight, DAYLIGHTS, d.daylight),
      sounds: o.sounds !== false,
      minimap: o.minimap !== false,
      recentSpaces: Array.isArray(o.recentSpaces) ? o.recentSpaces.filter((x) => typeof x === 'string').slice(0, 5) : [],
    };
    if (key !== o.clientKey) saveSettings(s);
    return s;
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked (private mode etc.): ignore
  }
}

export function rememberSpace(s: Settings, id: string): void {
  s.recentSpaces = [id, ...s.recentSpaces.filter((x) => x !== id)].slice(0, 5);
  saveSettings(s);
}
