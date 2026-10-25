import express, { Router } from 'express';
import { MAX_FILE_BYTES } from '../../shared/constants.ts';
import type { ApiController } from '../controllers/ApiController.ts';
import type { FileController } from '../controllers/FileController.ts';

export function apiRoutes(api: ApiController, files: FileController): Router {
  const r = Router();
  r.get('/healthz', api.health);
  // 1) who / how big / is there room — checked BEFORE the body is read into memory
  // 2) the body is the raw file (no multipart parsing needed), up to MAX_FILE_BYTES
  r.post('/api/spaces/:spaceId/files', files.precheck, express.raw({ type: () => true, limit: MAX_FILE_BYTES }), (req, res, next) => {
    files.upload(req, res).catch(next);
  });
  r.get('/api/spaces/:spaceId/files/:fileId', files.download);
  return r;
}
