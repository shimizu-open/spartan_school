// Builds the HTTP app and the realtime server and connects the MVC parts.

import { createServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '../shared/types.ts';
import { config } from './config.ts';
import { ApiController } from './controllers/ApiController.ts';
import { FileController } from './controllers/FileController.ts';
import { SpaceSocketController } from './controllers/SpaceSocketController.ts';
import { FileStorage } from './lib/FileStorage.ts';
import { securityHeaders } from './middleware/securityHeaders.ts';
import { IpLimits, clientIp } from './middleware/ipLimits.ts';
import { hasOriginSecret, isLocalHealthCheck } from './middleware/originSecret.ts';
import { socketOriginCheck } from './middleware/socketOrigin.ts';
import { SpaceRepository } from './models/SpaceRepository.ts';
import { SpaceStore } from './models/SpaceStore.ts';
import { apiRoutes } from './routes/apiRoutes.ts';
import { pageRoutes } from './routes/pageRoutes.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function createAppServer(): Promise<HttpServer> {
  // Spaces, chat, notes and whiteboards are saved in SQLite; files next to it.
  const repo = new SpaceRepository(path.join(config.dataDir, 'pixel-office.db'));
  const files = new FileStorage(config.dataDir);
  await files.removeOrphans((id) => repo.exists(id));
  const store = new SpaceStore(repo, {
    maxStoredSpaces: config.maxStoredSpaces,
    retentionDays: config.retentionDays,
    unloadAfterMs: 10 * 60 * 1000,
  });
  store.onDelete = (spaceId) => void files.removeSpace(spaceId);
  const timer = setInterval(() => store.sweep(Date.now()), 5 * 60 * 1000);
  timer.unref();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(securityHeaders(config.production, config.production && config.trustProxy));
  // Refuse requests that did not come through CloudFront (when ORIGIN_SECRET is set).
  app.use((req, res, next) => {
    if (hasOriginSecret(req, config.originSecret) || isLocalHealthCheck(req)) return next();
    res.status(403).type('text/plain').send('Forbidden');
  });

  const httpServer = createServer(app);

  // Realtime (positions, chat, call setup)
  const io = new Server<ClientToServer, ServerToClient>(httpServer, {
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    allowRequest: (req, cb) => {
      if (!hasOriginSecret(req, config.originSecret)) return cb('forbidden', false);
      socketOriginCheck(config.allowedOrigins, config.trustProxy)(req, cb);
    },
  });
  const ipLimits = new IpLimits(config.maxConnectionsPerIp, config.maxNewSpacesPerHour);
  new SpaceSocketController(io, store, files, ipLimits, (s) => clientIp(s.handshake.headers, s.handshake.address, config.trustProxy), config.maxTotalStorageMb * 1024 * 1024).attach();
  httpServer.on('close', () => {
    clearInterval(timer);
    repo.close();
  });

  // HTTP
  app.use(apiRoutes(new ApiController(store), new FileController(store, files, io, config.maxTotalStorageMb * 1024 * 1024)));
  if (config.production) {
    app.use(pageRoutes(path.join(ROOT, 'dist')));
  } else {
    // Development: Vite serves the browser code with hot reload, on the same port.
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({
      configFile: path.join(ROOT, 'vite.config.ts'),
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });
  // Errors (e.g. a file larger than the limit) become short JSON answers, never stack traces.
  app.use((err: { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.type === 'entity.too.large' ? 413 : (err.status ?? 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 413 ? 'ファイルが大きすぎます（20MBまで）' : 'エラーが発生しました' });
  });
  return httpServer;
}
