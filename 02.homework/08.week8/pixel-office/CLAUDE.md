# Pixel Office — notes for AI agents

2D pixel-art virtual office (campus-town map): proximity WebRTC audio/video (P2P mesh), private meeting rooms, quiet library, stage→hall broadcast, chat with commands and file attachments, files placed on the map, sticky notes, shared whiteboards, vending drinks, photo spot, emotes/dance/sit, statuses, pets and a large avatar system. No login; spaces are persisted in SQLite (node:sqlite, `DATA_DIR/pixel-office.db`: spaces, #space chat, files meta, notes, strokes) + files on disk; loaded into memory while in use. Optional retention SPACE_RETENTION_DAYS (0 = forever), caps MAX_STORED_SPACES / MAX_TOTAL_STORAGE_MB. Ownership uses `uid` = sha256 of a per-browser `clientKey` (localStorage), never the socket id. Web (PWA) + Electron desktop wrapper. User docs are Japanese (README.md, docs/*.md); write user-facing text in Japanese.

Detailed map of files and symbols: `docs/ai/codemap.md`.

## Commands
- `npm run dev` — server + Vite middleware (HMR) on :3000
- `npm test` — node:test, 37 tests (unit, store, limits, Socket.IO integration incl. restart persistence and security fixes); runs with NODE_ENV=production
- `npm run typecheck` — tsc (TypeScript 7) over server/shared/client/test
- `npm run build` / `npm start` — production (serves dist/)
- `docker compose up --build` — production container; `-f docker-compose.turn.yml` adds coturn
- `cd desktop && npm run setup && npm start` — Electron (PIXEL_OFFICE_URL overrides server)

## Rules
- MVC on both sides: server `server/{models,views,controllers,routes,middleware}`, client `client/src/{models,views,controllers}`. Models hold data + validation, views only render/serialize, controllers wire events.
- Code shared by server and browser goes in `shared/` (map, proximity rules, types, sanitizers). Proximity must be computed by the same functions on both sides.
- Server runs `.ts` directly with Node 24 type stripping: only erasable TS syntax (no enums/namespaces/parameter properties), relative imports with `.ts` extensions.
- Never render user text with innerHTML; use `h()`/`textContent` from `client/src/views/dom.ts`.
- Validate every socket payload in the server model layer; add a RateLimiter for new events.
- Signaling relay is gated by `maySignal` (server-side distance check) — keep it when changing proximity rules.
- Dependencies: exact versions, `ignore-scripts=true`, avoid releases younger than ~2 weeks except official security fixes; run `npm audit` after changes (currently 0).
- Files: upload only with the per-join upload token (header); download with the separate read-only download token (URL). 'nearby' files carry `audience` uids. Inline display only for sniffed PNG/JPEG/GIF/WebP; keep `sandbox` CSP on file responses.
- Media is sent to a peer only if `volumeBetween(peer, me) > 0` (RtcController.maySend) — broadcasts are one-way. Signals are rebuilt by `shared/signal.ts cleanSignal` on both ends.
- Whiteboard events go only to `boardUsers` (room boards stay in the room). TURN passwords are per-person, temporary (server/lib/turn.ts), given in the join answer. ORIGIN_SECRET gates requests behind CloudFront.
- UI style: retro game (ink outlines, offset shadows, DotGothic16 self-hosted); deliberately NOT MetaLife's layout.
- No database. Single process; scaling out needs @socket.io/redis-adapter + sticky sessions.
