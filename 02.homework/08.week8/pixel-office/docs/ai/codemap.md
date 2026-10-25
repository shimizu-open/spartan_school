# Code map

## Runtime flow
1. `GET /` or `/s/:id` → `server/routes/pageRoutes.ts` (prod) or Vite middleware (dev) → `client/index.html` → `client/src/main.ts` → `AppController.route()`.
2. Home (`views/HomeView.ts`, live hero scene) → `/s/<id>` → Lobby (`views/LobbyView.ts`: device preview + `AvatarEditor`) → `SpaceController.join()`:
   fetch `/api/config` (ICE) → socket.io `join` → `SpaceSocketController` validates → ack `joinView` (players, chat, files, notes, uploadToken).
3. Frame loop (`SpaceController.loop`): `InputController.update` (keys / path following / follow) → `SpaceModel.tick` (interpolation, pets, bubbles) → `RtcController.updateVolumes` → `MapView.render` → `VideoView.place` (bubbles over heads). Every 250 ms: `RtcController.update`, `refreshVideos`, `refreshShell`, `refreshHint` (objectNear/seatAt), minimap.
4. WebRTC: smaller socket id calls; 3 fixed transceivers (mic, cam, screen); `replaceTrack` toggles. Server relays signals only if `maySignal`.
5. Files: `SpaceController.upload` → `POST /api/spaces/:id/files?name&to=space|nearby|map&x&y` (X-Upload-Token, raw body) → `FileController.upload` (sniff, limits, `FileStorage.save`) → `file:add` + chat `kind:'file'`. Download `GET .../files/:fileId?t=token[&dl=1]`.

## Socket events (shared/types.ts)
| C→S | server | notes |
|---|---|---|
| join | SpaceSocketController | clientKey → uid; spawn at free spot; returns selfUid + uploadToken; loads space from SQLite |
| move | `Player.applyMove` | rejects NaN/out of map/walls; moving resets pose+dancing |
| state | `Player.applyState` | status(6), statusNote, mic/cam/screen/hand/megaphone/dancing, pose, item(DRINKS) |
| profile | `Player.parseProfile` | name + look (`shared/avatar.ts sanitizeLook`) |
| react / action | whitelists REACTIONS / ACTIONS | |
| chat | `Space.postChat` (+ `/dice /omikuji /janken /coin`) | 'space' kept (150), 'nearby' to `Space.nearby` |
| signal | `maySignal` gate | 'bye' always passes |
| intercom | — | |
| file:remove | `Space.removeFile` (owner only) | deletes from disk |
| note:add / note:remove | `Space.addNote` (≤3 tiles from you) / author only | |
| wb:open (ack strokes) / wb:stroke / wb:clear | `Space.canUseBoard`, `addStroke` validation | |
S→C: player:join/leave/move/state/profile, react, action, chat, signal, intercom, file:add/remove, note:add/remove, wb:stroke/clear.

## Files
| Path | Role |
|---|---|
| shared/constants.ts | distances, limits (files/notes/whiteboard), REACTIONS, ACTIONS, DRINKS, STATUSES, cleanText/cleanMultiline |
| shared/avatar.ts | AvatarLook (skin, hair, hairStyle, eyes, outfit, outfitColor, accessory, costume, pet), option lists, LOOK_SIZES, sanitizeLook, randomLook |
| shared/map.ts | 80×48 campus map built in code; TILE_INFO; AREAS (private rooms A/B/C, quiet library, stage→hall audience, office, cafe, garden, lobby, game); OBJECTS (whiteboards wb-*, vend-1/2, photo-1); collides, areaAt, privateAreaAt, objectNear, seatAt, SEAT_TILES, nearestFree, occupiedBy, areaEntry, SPAWN |
| shared/proximity.ts | shouldConnect (status/quiet/room/megaphone/stage/distance), volumeBetween, stageReaches, maySignal |
| shared/path.ts | findPath (BFS, 8-dir, no corner cutting) |
| server/app.ts | wiring; SpaceRepository at DATA_DIR/pixel-office.db; FileStorage.removeOrphans; SpaceStore sweep every 5 min (unload empty after 10 min, optional retention); JSON error handler (413) |
| server/config.ts | PORT, HOST, TRUST_PROXY, ALLOWED_ORIGINS, ICE_SERVERS, DATA_DIR, SPACE_RETENTION_DAYS, MAX_STORED_SPACES, MAX_TOTAL_STORAGE_MB |
| server/models/{Player,Space,SpaceStore}.ts | state + validation (uidFromKey); load/unload/retention/caps |
| server/models/SpaceRepository.ts | SQLite persistence (node:sqlite): spaces, chat(#space, last 1000), files, notes, strokes; prepared statements only |
| server/lib/{FileStorage,sniff,RateLimiter}.ts | disk storage with id checks; magic-byte type detection; token bucket |
| server/controllers/{SpaceSocketController,FileController,ApiController}.ts | socket events; file HTTP; config/health |
| server/views/spaceView.ts | explicit serializers |
| client/src/models/SpaceModel.ts | players (+drawX/Y, walkTime, petX/Y, action, bubble), chat, files, notes, reactions, speaking; fileUrl() |
| client/src/models/SettingsModel.ts | name, look, devices, layout map/row/grid, weather, daylight, sounds, minimap |
| client/src/controllers/SpaceController.ts | server→model, actions, hotkeys, interact (E), sit, uploads/drag-drop, panels, popups, sounds |
| client/src/controllers/InputController.ts | keys, click-to-walk, dblclick teleport, follow, hover |
| client/src/views/MapView.ts | camera/zoom, layers: base map → room tint/hearing → notes/files → avatars+pets (y-sorted) → renderMapTop → labels → bubbles → reactions/confetti → weather/daylight |
| client/src/views/effects.ts | confetti/sparks, weather particles, daylight tint |
| client/src/views/avatarSprite.ts / petSprite.ts | procedural pixel sprites (48×64, headTop(look), SIT_DROP) / pets |
| client/src/views/AvatarEditor.ts (+ avatarEditor.css) | tabbed editor with live thumbnails, random, sit preview |
| client/src/views/tileArt.ts | renderMap / renderMapTop |
| client/src/views/ShellView.ts | top bar, right dock, hotbar (me card + status menu, media, emotes, actions, more), corner (minimap/zoom), hint, drop zone |
| client/src/views/VideoView.ts | tiles; map layout places bubbles over heads with overlap push |
| client/src/views/{MinimapView,WhiteboardView,Modal,NoteViews,Lightbox}.ts | minimap; shared drawing; dialogs; notes; image/file viewer |
| client/src/views/panels/* | Members (follow/call), Chat (attachments, file cards), Files, Map (areas + objects), Settings (profile/effects/devices) |
| client/public/fonts/DotGothic16-Regular.woff2 | pixel font (OFL, license file beside it) |
| desktop/main.cjs | Electron wrapper (unchanged by v2) |
| test/*.test.ts, test/helpers.ts | map/proximity/avatar unit tests; socket+HTTP integration (files, notes, whiteboard, commands) |

## Invariants
- Every area entry, object and seat is reachable from SPAWN (tested). Seat tiles are walkable.
- Proximity changes affect client calls, server `maySignal`, and nearby chat.
- Only the smaller id sends offers; callee re-checks `shouldConnect` before answering.
