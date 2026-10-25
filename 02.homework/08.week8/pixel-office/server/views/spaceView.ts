// View: shapes model data into what is sent to browsers.
// Every field is listed explicitly, so internal data never leaks by accident.

import type { ChatMessage, FileMeta, JoinResult, Note, Player, RTCIceServerLike, Stroke } from '../../shared/types.ts';
import type { Space } from '../models/Space.ts';

export function playerView(p: Player): Player {
  return {
    id: p.id,
    uid: p.uid,
    name: p.name,
    look: { ...p.look },
    x: p.x,
    y: p.y,
    dir: p.dir,
    moving: p.moving,
    status: p.status,
    statusNote: p.statusNote,
    mic: p.mic,
    cam: p.cam,
    screen: p.screen,
    hand: p.hand,
    megaphone: p.megaphone,
    pose: p.pose,
    dancing: p.dancing,
    item: p.item,
  };
}

export function fileView(f: FileMeta): FileMeta {
  const out: FileMeta = { id: f.id, name: f.name, size: f.size, type: f.type, image: f.image, by: f.by, byName: f.byName, at: f.at };
  if (f.x !== undefined && f.y !== undefined) {
    out.x = f.x;
    out.y = f.y;
  }
  if (f.audience) out.audience = [...f.audience];
  return out;
}

export function chatView(m: ChatMessage): ChatMessage {
  const out: ChatMessage = { id: m.id, channel: m.channel, from: m.from, uid: m.uid, name: m.name, text: m.text, at: m.at, kind: m.kind };
  if (m.file) out.file = fileView(m.file);
  return out;
}

export function noteView(n: Note): Note {
  return { id: n.id, x: n.x, y: n.y, text: n.text, color: n.color, by: n.by, byName: n.byName, at: n.at };
}

export function strokeView(s: Stroke): Stroke {
  return { id: s.id, color: s.color, width: s.width, points: s.points, by: s.by };
}

export function joinView(space: Space, selfId: string, selfUid: string, tokens: { upload: string; download: string }, iceServers: RTCIceServerLike[]): JoinResult {
  return {
    ok: true,
    selfId,
    selfUid,
    iceServers,
    spaceId: space.id,
    uploadToken: tokens.upload,
    downloadToken: tokens.download,
    players: [...space.players.values()].map(playerView),
    chat: space.chat.map(chatView),
    files: space.filesFor(selfUid).map(fileView),
    notes: space.notes.map(noteView),
  };
}

export function healthView(stats: { spaces: number; players: number; stored: number }) {
  return { ok: true, ...stats, uptime: Math.round(process.uptime()) };
}
