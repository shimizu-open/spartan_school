import type { ActionKind, Status } from './types.ts';

/** Size of one map tile in pixels. */
export const TILE = 32;

/**
 * Talking distance, in pixels.
 * Inside HEAR_FULL you hear someone at full volume; the voice fades out
 * until HEAR_MAX. Calls are opened a bit earlier (CONNECT) and closed a bit
 * later (DISCONNECT) so that walking along the edge does not reconnect over and over.
 */
export const HEAR_FULL = TILE * 2;
export const HEAR_MAX = TILE * 4.5;
export const CONNECT_DIST = TILE * 5;
export const DISCONNECT_DIST = TILE * 6.5;

/** Walking speed in pixels per second. */
export const WALK_SPEED = 170;

/** Limits that protect the server. */
export const MAX_PLAYERS_PER_SPACE = 25; // a full-mesh call gets heavy above this
export const MAX_SPACES = 200;
export const MAX_NAME = 20;
export const MAX_CHAT = 500;
export const MAX_STATUS_NOTE = 40;
export const CHAT_HISTORY = 150;
export const SPACE_ID_RE = /^[A-Za-z0-9_-]{4,32}$/;

/** Files */
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file
export const MAX_SPACE_BYTES = 200 * 1024 * 1024; // 200 MB per space
export const MAX_FILES_PER_SPACE = 100;
export const MAX_FILE_NAME = 120;

/** Sticky notes */
export const MAX_NOTES_PER_SPACE = 120;
export const MAX_NOTE_TEXT = 140;
export const NOTE_COLORS = ['#ffe27a', '#ffb3a7', '#a8e6cf', '#a9c8ff', '#e0c3ff'];

/** Whiteboards */
export const WB_COLORS = ['#2b2433', '#ff6f59', '#2ec4a6', '#4d8ff0', '#ffc145', '#7b5cd6', '#ffffff'];
export const WB_MAX_STROKES = 3000;
export const WB_MAX_POINTS = 600; // numbers per stroke (= 300 points)
/** Saved whiteboard data per space (all boards together), in bytes. */
export const WB_MAX_BYTES_PER_SPACE = 2 * 1024 * 1024;

export const REACTIONS = ['👋', '👍', '🎉', '❤️', '😂', '👏', '🙏', '🔥'] as const;
export const ACTIONS: readonly ActionKind[] = ['jump', 'wave', 'spin'];
export const DRINKS = ['☕', '🍵', '🧃', '🥤', '🍶', '🧋'] as const;

/** Status choices: emoji, label, and whether calls open automatically. */
export const STATUSES: Record<Status, { emoji: string; label: string; talk: boolean }> = {
  present: { emoji: '🟢', label: '在席', talk: true },
  meeting: { emoji: '🗣️', label: '会議中', talk: true },
  focus: { emoji: '🎧', label: '集中', talk: false },
  lunch: { emoji: '🍙', label: 'ランチ', talk: false },
  break: { emoji: '☕', label: '休憩', talk: false },
  away: { emoji: '💤', label: '離席', talk: false },
};
export const STATUS_KEYS = Object.keys(STATUSES) as Status[];

// Avatar options live in shared/avatar.ts.
export { DEFAULT_LOOK, sanitizeLook } from './avatar.ts';

/** Trims text, removes control characters and caps the length. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '').trim().slice(0, max);
}

/** Like cleanText but keeps line breaks (for chat and notes). */
export function cleanMultiline(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return (
    v
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, max)
  );
}
