// Model: all spaces on this server.
//
// Spaces are saved on disk (SpaceRepository) and stay there. A space is loaded
// into memory when someone enters, and dropped from memory (not deleted) a while
// after the last person leaves.
//
// Deleting old spaces is optional: set SPACE_RETENTION_DAYS to delete spaces
// nobody has entered for that many days (0 = keep forever, the default).
//
// Note for scaling: one process. For several containers, move the state to a
// shared database (and files to S3) and use @socket.io/redis-adapter.

import { CHAT_HISTORY, MAX_SPACES, SPACE_ID_RE } from '../../shared/constants.ts';
import { Space } from './Space.ts';
import type { SpaceRepository } from './SpaceRepository.ts';

export interface StoreOptions {
  /** Spaces kept on disk at most (protects the disk, since anyone can create one). */
  maxStoredSpaces: number;
  /** Delete spaces unused for this many days. 0 = never. */
  retentionDays: number;
  /** Drop an empty space from memory after this long (it stays on disk). */
  unloadAfterMs: number;
}

export class SpaceStore {
  private readonly spaces = new Map<string, Space>();
  readonly repo: SpaceRepository;
  private readonly opts: StoreOptions;
  /** Called when a space is deleted for good (to remove its files). */
  onDelete: (spaceId: string) => void = () => undefined;

  constructor(repo: SpaceRepository, opts: StoreOptions) {
    this.repo = repo;
    this.opts = opts;
  }

  static isValidId(id: unknown): id is string {
    return typeof id === 'string' && SPACE_ID_RE.test(id);
  }

  /** A space that is loaded right now (people are in it, or were recently). */
  get(id: string): Space | null {
    return this.spaces.get(id) ?? null;
  }

  /**
   * Loads the space from disk, or creates it. Null if a limit is reached.
   * `mayCreate` is asked only when the space is new (per-IP creation limit).
   */
  getOrCreate(id: string, mayCreate: () => boolean = () => true): Space | null {
    const loaded = this.spaces.get(id);
    if (loaded) return loaded;
    if (this.spaces.size >= MAX_SPACES) {
      this.sweep(Date.now(), true);
      if (this.spaces.size >= MAX_SPACES) return null;
    }
    // New spaces live in memory only until something is written in them,
    // so opening random URLs does not fill the disk with empty spaces.
    const saved = this.repo.exists(id);
    if (!saved && (this.repo.count() >= this.opts.maxStoredSpaces || !mayCreate())) return null;
    const s = new Space(id, this.repo, saved ? this.repo.load(id, CHAT_HISTORY) : { chat: [], files: [], notes: [] }, saved);
    this.spaces.set(id, s);
    return s;
  }

  /**
   * Housekeeping, run every few minutes:
   * - empty spaces leave memory after `unloadAfterMs` (or right away when `force`)
   * - with a retention period, long-unused spaces are deleted from disk
   */
  sweep(now: number, force = false): void {
    for (const s of this.spaces.values()) {
      if (s.emptySince !== null && (force || now - s.emptySince >= this.opts.unloadAfterMs)) this.spaces.delete(s.id);
    }
    if (this.opts.retentionDays > 0) {
      const before = now - this.opts.retentionDays * 24 * 60 * 60 * 1000;
      for (const id of this.repo.inactiveSince(before)) {
        if (this.spaces.get(id)?.players.size) continue; // someone is in it right now
        this.spaces.delete(id);
        this.repo.remove(id);
        this.onDelete(id);
      }
    }
  }

  stats(): { spaces: number; players: number; stored: number } {
    let players = 0;
    for (const s of this.spaces.values()) players += s.players.size;
    return { spaces: this.spaces.size, players, stored: this.repo.count() };
  }
}
