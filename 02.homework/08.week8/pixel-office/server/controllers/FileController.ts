// Controller: file upload and download over HTTP.
//
// Upload:   POST /api/spaces/:spaceId/files?name=<file name>&to=space|nearby|map&x=&y=
//           header X-Upload-Token (given when joining), body = the raw file
// Download: GET  /api/spaces/:spaceId/files/:fileId?t=<download token>[&dl=1]
//
// Only people currently in the space can upload or download. The download token
// (it appears in image URLs) cannot be used to upload. Files sent to "nearby"
// are visible only to the people who were near.

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { MAX_FILE_BYTES, MAX_FILE_NAME, TILE, cleanText } from '../../shared/constants.ts';
import { MAP_H, MAP_W } from '../../shared/map.ts';
import type { FileMeta, Player } from '../../shared/types.ts';
import { FileStorage } from '../lib/FileStorage.ts';
import { RateLimiter } from '../lib/RateLimiter.ts';
import { sniff } from '../lib/sniff.ts';
import type { Space } from '../models/Space.ts';
import type { SpaceStore } from '../models/SpaceStore.ts';
import { chatView, fileView } from '../views/spaceView.ts';
import type { IO } from './SpaceSocketController.ts';

export class FileController {
  private readonly store: SpaceStore;
  private readonly files: FileStorage;
  private readonly io: IO;
  private readonly limits = new WeakMap<object, RateLimiter>();

  private readonly maxTotalBytes: number;
  /** Uploads being received right now. Each can hold up to 20 MB in memory. */
  private inFlight = 0;
  /** People (uids) with an upload in progress: one at a time per person. */
  private readonly uploading = new Set<string>();
  static readonly MAX_IN_FLIGHT = 8;
  /** A slow sender is cut off: no data for 15 s, or not finished within 2 minutes. */
  static readonly IDLE_MS = 15_000;
  static readonly MAX_MS = 120_000;

  constructor(store: SpaceStore, files: FileStorage, io: IO, maxTotalBytes: number) {
    this.store = store;
    this.files = files;
    this.io = io;
    this.maxTotalBytes = maxTotalBytes;
  }

  /**
   * Runs before the file body is read: member check, rate limit, declared size,
   * free space, and how many uploads are in progress. Rejected uploads never use memory.
   */
  precheck = (req: Request, res: Response, next: NextFunction): void => {
    const space = this.store.get(String(req.params.spaceId));
    const me = space?.playerByToken(req.get('x-upload-token'), 'upload');
    if (!space || !me) {
      res.status(403).json({ error: '入室している人だけがアップロードできます' });
      return;
    }
    if (this.uploading.has(me.uid)) {
      res.status(429).json({ error: 'ひとつずつアップロードしてください' });
      return;
    }
    let limiter = this.limits.get(me);
    if (!limiter) this.limits.set(me, (limiter = new RateLimiter(0.2, 5)));
    if (!limiter.take()) {
      res.status(429).json({ error: '少し待ってからもう一度お試しください' });
      return;
    }
    const size = Number(req.get('content-length'));
    if (!Number.isInteger(size) || size <= 0) {
      res.status(411).json({ error: 'ファイルのサイズがわかりません' });
      return;
    }
    if (size > MAX_FILE_BYTES) {
      res.status(413).json({ error: 'ファイルが大きすぎます（20MBまで）' });
      return;
    }
    if (this.store.repo.totalBytes() + size > this.maxTotalBytes) {
      res.status(507).json({ error: 'サーバーの保存容量がいっぱいです。管理者に連絡してください' });
      return;
    }
    const full = space.canStore(size);
    if (full) {
      res.status(413).json({ error: full });
      return;
    }
    if (this.inFlight >= FileController.MAX_IN_FLIGHT) {
      res.status(503).json({ error: 'アップロードが混み合っています。少し待ってからお試しください' });
      return;
    }
    this.inFlight++;
    this.uploading.add(me.uid);
    const cut = setTimeout(() => req.destroy(), FileController.MAX_MS);
    req.setTimeout(FileController.IDLE_MS, () => req.destroy());
    res.once('close', () => {
      this.inFlight--;
      this.uploading.delete(me.uid);
      clearTimeout(cut);
    });
    res.locals.space = space;
    res.locals.me = me;
    next();
  };

  upload = async (req: Request, res: Response): Promise<void> => {
    const space = res.locals.space as Space;
    const me = res.locals.me as Player;
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: 'ファイルが空です' });
      return;
    }
    if (!space.has(me.id)) {
      res.status(403).json({ error: '退出したためアップロードできませんでした' });
      return;
    }
    const name = cleanText(String(req.query.name ?? ''), MAX_FILE_NAME).replace(/[\\/]/g, '_') || 'file';
    const to = req.query.to === 'map' ? 'map' : req.query.to === 'nearby' ? 'nearby' : 'space';
    const kind = sniff(body);
    const meta: FileMeta = {
      id: randomUUID(),
      name,
      size: body.length,
      type: kind.type,
      image: kind.image,
      by: me.uid,
      byName: me.name,
      at: Date.now(),
    };
    if (to === 'map') {
      const x = Number(req.query.x);
      const y = Number(req.query.y);
      const ok = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= MAP_W * TILE && y <= MAP_H * TILE;
      // files are placed near the person who drops them
      if (!ok || Math.hypot(x - me.x, y - me.y) > TILE * 6) {
        res.status(400).json({ error: 'もう少し近くに置いてください' });
        return;
      }
      meta.x = Math.round(x);
      meta.y = Math.round(y);
    }
    // "nearby": only the people near me now may ever see this file
    const near = to === 'nearby' ? space.nearby(me) : null;
    if (near) meta.audience = [...new Set([me.uid, ...near.map((p) => p.uid)])];
    await this.files.save(space.id, meta.id, body);
    space.addFile(meta);
    const viewers = near ?? [...space.players.values()];
    for (const p of viewers) this.io.to(p.id).emit('file:add', fileView(meta));
    if (to !== 'map') {
      const msg = space.postFile(me, to, meta);
      for (const p of viewers) this.io.to(p.id).emit('chat', chatView(msg));
    }
    res.status(201).json(fileView(meta));
  };

  download = (req: Request, res: Response): void => {
    const space = this.store.get(String(req.params.spaceId));
    const me = space?.playerByToken(req.query.t, 'download');
    const meta = space?.file(req.params.fileId);
    if (!space || !me || !meta || !space.mayRead(meta, me.uid)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    const inline = meta.image && req.query.dl !== '1';
    res.setHeader('Content-Type', meta.image ? meta.type : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="file"; filename*=UTF-8''${encodeURIComponent(meta.name)}`);
    // The file itself can never run scripts, even if opened directly.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(this.files.pathOf(space.id, meta.id), { dotfiles: 'deny', headers: { 'X-Content-Type-Options': 'nosniff' } }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  };
}
