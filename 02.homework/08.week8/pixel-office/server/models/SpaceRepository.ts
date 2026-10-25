// Model: saves spaces to disk so they survive restarts and empty rooms.
// Uses SQLite built into Node.js (node:sqlite), so no extra package is needed.
// The database file lives in DATA_DIR next to the uploaded files.
//
// What is saved: the space itself, "#みんな" chat, files (metadata), sticky notes,
// whiteboard strokes. Positions, statuses and "nearby" chat are not saved.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { ChatMessage, FileMeta, Note, Stroke } from '../../shared/types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_json TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_space_at ON chat(space_id, at);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  type TEXT NOT NULL,
  image INTEGER NOT NULL,
  uid TEXT NOT NULL,
  by_name TEXT NOT NULL,
  at INTEGER NOT NULL,
  x REAL,
  y REAL
);
CREATE INDEX IF NOT EXISTS files_space ON files(space_id);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  text TEXT NOT NULL,
  color INTEGER NOT NULL,
  uid TEXT NOT NULL,
  by_name TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_space ON notes(space_id);
CREATE TABLE IF NOT EXISTS strokes (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  board TEXT NOT NULL,
  color INTEGER NOT NULL,
  width INTEGER NOT NULL,
  points TEXT NOT NULL,
  uid TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS strokes_board ON strokes(space_id, board, at);
`;

/** Chat lines kept on disk per space (older ones are pruned). */
const CHAT_KEEP = 1000;

type Row = Record<string, unknown>;

export interface StoredSpace {
  chat: ChatMessage[];
  files: FileMeta[];
  notes: Note[];
}

export class SpaceRepository {
  private readonly db: DatabaseSync;
  private readonly q: Record<string, StatementSync>;
  /** Chat lines written per space since the last prune. */
  private readonly inserts = new Map<string, number>();

  /** `file` is a path, or ':memory:' for tests. */
  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
    // added later: who may see a file sent to "nearby" (JSON list of uids)
    const cols = (this.db.prepare('PRAGMA table_info(files)').all() as Row[]).map((c) => c.name);
    if (!cols.includes('audience')) this.db.exec('ALTER TABLE files ADD COLUMN audience TEXT');
    const p = (sql: string) => this.db.prepare(sql);
    this.q = {
      exists: p('SELECT 1 FROM spaces WHERE id = ?'),
      count: p('SELECT COUNT(*) AS n FROM spaces'),
      create: p('INSERT OR IGNORE INTO spaces (id, created_at, last_active_at) VALUES (?, ?, ?)'),
      touch: p('UPDATE spaces SET last_active_at = ? WHERE id = ?'),
      inactive: p('SELECT id FROM spaces WHERE last_active_at < ?'),
      chat: p('SELECT * FROM (SELECT * FROM chat WHERE space_id = ? ORDER BY at DESC LIMIT ?) ORDER BY at ASC'),
      addChat: p('INSERT INTO chat (id, space_id, uid, name, text, kind, file_json, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      pruneChat: p('DELETE FROM chat WHERE space_id = ? AND id NOT IN (SELECT id FROM chat WHERE space_id = ? ORDER BY at DESC LIMIT ?)'),
      files: p('SELECT * FROM files WHERE space_id = ? ORDER BY at ASC'),
      addFile: p('INSERT INTO files (id, space_id, name, size, type, image, uid, by_name, at, x, y, audience) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      removeFile: p('DELETE FROM files WHERE id = ? AND space_id = ?'),
      totalBytes: p('SELECT COALESCE(SUM(size), 0) AS n FROM files'),
      notes: p('SELECT * FROM notes WHERE space_id = ? ORDER BY at ASC'),
      addNote: p('INSERT INTO notes (id, space_id, x, y, text, color, uid, by_name, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
      removeNote: p('DELETE FROM notes WHERE id = ? AND space_id = ?'),
      strokes: p('SELECT * FROM strokes WHERE space_id = ? AND board = ? ORDER BY at ASC'),
      addStroke: p('INSERT INTO strokes (id, space_id, board, color, width, points, uid, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      dropStroke: p('DELETE FROM strokes WHERE id = ?'),
      clearBoard: p('DELETE FROM strokes WHERE space_id = ? AND board = ?'),
      strokeBytes: p('SELECT COALESCE(SUM(LENGTH(points)), 0) AS n FROM strokes WHERE space_id = ?'),
      boardBytes: p('SELECT COALESCE(SUM(LENGTH(points)), 0) AS n FROM strokes WHERE space_id = ? AND board = ?'),
      dbBytes: p('SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()'),
    };
  }

  close(): void {
    this.db.close();
  }

  // ---- spaces ----------------------------------------------------------------

  exists(id: string): boolean {
    return !!this.q.exists!.get(id);
  }

  count(): number {
    return Number((this.q.count!.get() as Row).n);
  }

  create(id: string, now = Date.now()): void {
    this.q.create!.run(id, now, now);
  }

  touch(id: string, now = Date.now()): void {
    this.q.touch!.run(now, id);
  }

  /** Everything needed to show a space (whiteboards are loaded per board, when opened). */
  load(id: string, chatLimit: number): StoredSpace {
    return {
      chat: (this.q.chat!.all(id, chatLimit) as Row[]).map(toChat),
      files: (this.q.files!.all(id) as Row[]).map(toFile),
      notes: (this.q.notes!.all(id) as Row[]).map(toNote),
    };
  }

  /** Ids of spaces nobody has entered since `before` (epoch ms). */
  inactiveSince(before: number): string[] {
    return (this.q.inactive!.all(before) as Row[]).map((r) => String(r.id));
  }

  /** Deletes a space and everything in it. */
  remove(id: string): void {
    this.db.exec('BEGIN');
    try {
      for (const t of ['chat', 'files', 'notes', 'strokes']) this.db.prepare(`DELETE FROM ${t} WHERE space_id = ?`).run(id);
      this.db.prepare('DELETE FROM spaces WHERE id = ?').run(id);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ---- contents --------------------------------------------------------------

  addChat(spaceId: string, m: ChatMessage): void {
    this.q.addChat!.run(m.id, spaceId, m.uid, m.name, m.text, m.kind, m.file ? JSON.stringify(m.file) : null, m.at);
    const n = (this.inserts.get(spaceId) ?? 0) + 1;
    if (n >= 50) {
      this.q.pruneChat!.run(spaceId, spaceId, CHAT_KEEP);
      this.inserts.delete(spaceId);
    } else this.inserts.set(spaceId, n);
  }

  addFile(spaceId: string, f: FileMeta): void {
    this.q.addFile!.run(f.id, spaceId, f.name, f.size, f.type, f.image ? 1 : 0, f.by, f.byName, f.at, f.x ?? null, f.y ?? null, f.audience ? JSON.stringify(f.audience) : null);
  }

  removeFile(spaceId: string, id: string): void {
    this.q.removeFile!.run(id, spaceId);
  }

  /** Bytes used on disk: all uploaded files plus the database itself (for the global limit). */
  totalBytes(): number {
    return Number((this.q.totalBytes!.get() as Row).n) + Number((this.q.dbBytes!.get() as Row).n);
  }

  /** Bytes of saved whiteboard data in a space (or one board of it). */
  strokeBytes(spaceId: string, board?: string): number {
    const row = board === undefined ? this.q.strokeBytes!.get(spaceId) : this.q.boardBytes!.get(spaceId, board);
    return Number((row as Row).n);
  }

  addNote(spaceId: string, n: Note): void {
    this.q.addNote!.run(n.id, spaceId, n.x, n.y, n.text, n.color, n.by, n.byName, n.at);
  }

  removeNote(spaceId: string, id: string): void {
    this.q.removeNote!.run(id, spaceId);
  }

  strokes(spaceId: string, board: string): Stroke[] {
    return (this.q.strokes!.all(spaceId, board) as Row[]).map(toStroke);
  }

  addStroke(spaceId: string, board: string, s: Stroke, dropId?: string): void {
    this.q.addStroke!.run(s.id, spaceId, board, s.color, s.width, JSON.stringify(s.points), s.by, Date.now());
    if (dropId) this.q.dropStroke!.run(dropId);
  }

  clearBoard(spaceId: string, board: string): void {
    this.q.clearBoard!.run(spaceId, board);
  }
}

function toChat(r: Row): ChatMessage {
  const m: ChatMessage = {
    id: String(r.id),
    channel: 'space',
    from: '',
    uid: String(r.uid),
    name: String(r.name),
    text: String(r.text),
    at: Number(r.at),
    kind: r.kind === 'roll' || r.kind === 'file' ? r.kind : 'text',
  };
  if (typeof r.file_json === 'string') m.file = JSON.parse(r.file_json) as FileMeta;
  return m;
}

function toFile(r: Row): FileMeta {
  const f: FileMeta = {
    id: String(r.id),
    name: String(r.name),
    size: Number(r.size),
    type: String(r.type),
    image: Number(r.image) === 1,
    by: String(r.uid),
    byName: String(r.by_name),
    at: Number(r.at),
  };
  if (r.x !== null && r.y !== null) {
    f.x = Number(r.x);
    f.y = Number(r.y);
  }
  if (typeof r.audience === 'string') f.audience = JSON.parse(r.audience) as string[];
  return f;
}

function toNote(r: Row): Note {
  return { id: String(r.id), x: Number(r.x), y: Number(r.y), text: String(r.text), color: Number(r.color), by: String(r.uid), byName: String(r.by_name), at: Number(r.at) };
}

function toStroke(r: Row): Stroke {
  return { id: String(r.id), color: Number(r.color), width: Number(r.width), points: JSON.parse(String(r.points)) as number[], by: String(r.uid) };
}
