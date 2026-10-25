// Stores uploaded files on disk: <dataDir>/uploads/<spaceId>/<fileId>.
// Ids are checked against strict patterns so a path can never leave that folder.

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SPACE_ID_RE } from '../../shared/constants.ts';

const FILE_ID_RE = /^[0-9a-f-]{36}$/;

export class FileStorage {
  readonly root: string;

  constructor(dataDir: string) {
    this.root = path.resolve(dataDir, 'uploads');
  }

  private dir(spaceId: string): string {
    if (!SPACE_ID_RE.test(spaceId)) throw new Error('bad space id');
    return path.join(this.root, spaceId);
  }

  /** Path of a stored file (for res.sendFile). */
  pathOf(spaceId: string, fileId: string): string {
    if (!FILE_ID_RE.test(fileId)) throw new Error('bad file id');
    return path.join(this.dir(spaceId), fileId);
  }

  async save(spaceId: string, fileId: string, data: Buffer): Promise<void> {
    await mkdir(this.dir(spaceId), { recursive: true, mode: 0o700 });
    await writeFile(this.pathOf(spaceId, fileId), data, { mode: 0o600, flag: 'wx' });
  }

  async remove(spaceId: string, fileId: string): Promise<void> {
    await rm(this.pathOf(spaceId, fileId), { force: true });
  }

  async removeSpace(spaceId: string): Promise<void> {
    await rm(this.dir(spaceId), { recursive: true, force: true });
  }

  /** Removes folders of spaces that no longer exist (e.g. deleted while the server was down). */
  async removeOrphans(keep: (spaceId: string) => boolean): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    for (const name of await readdir(this.root)) {
      if (SPACE_ID_RE.test(name) && !keep(name)) await rm(path.join(this.root, name), { recursive: true, force: true });
    }
  }
}
