// Types shared by the server and the browser.

import type { AvatarLook } from './avatar.ts';

export type { AvatarLook };

export type Dir = 'down' | 'up' | 'left' | 'right';
/** present/meeting: talk normally. focus: no automatic calls. away/lunch/break: not at the desk. */
export type Status = 'present' | 'focus' | 'meeting' | 'away' | 'lunch' | 'break';
export type ChatChannel = 'space' | 'nearby';
export type Pose = 'stand' | 'sit';
export type ActionKind = 'jump' | 'wave' | 'spin';

/** What everyone in the space knows about one person. */
export interface Player {
  id: string; // connection id (changes every visit)
  uid: string; // stable id of this browser (same across visits); used for "mine"
  name: string;
  look: AvatarLook;
  x: number; // feet position in map pixels
  y: number;
  dir: Dir;
  moving: boolean;
  status: Status;
  statusNote: string; // short comment, e.g. "13時に戻ります"
  mic: boolean;
  cam: boolean;
  screen: boolean;
  hand: boolean;
  megaphone: boolean;
  pose: Pose;
  dancing: boolean;
  item: string; // drink held in hand ('' = none)
}

/** Fields a client may change about itself with the `state` event. */
export type PlayerStatePatch = Partial<
  Pick<Player, 'status' | 'statusNote' | 'mic' | 'cam' | 'screen' | 'hand' | 'megaphone' | 'pose' | 'dancing' | 'item'>
>;

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string; // MIME type decided by the server
  image: boolean; // safe to show inline as <img>
  by: string; // uploader's uid
  byName: string;
  at: number;
  x?: number; // set when the file was placed on the map
  y?: number;
  /** For files sent to "nearby": uids of the people who may see it. Unset = everyone in the space. */
  audience?: string[];
}

export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
  color: number;
  by: string; // author's uid
  byName: string;
  at: number;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  from: string; // connection id of the sender ('' for messages loaded from storage)
  uid: string; // sender's stable uid
  name: string;
  text: string;
  at: number; // epoch ms
  kind: 'text' | 'roll' | 'file';
  file?: FileMeta;
}

/** One pen stroke on a whiteboard. Points are 0..1 relative to the board, flattened [x0, y0, x1, y1, ...]. */
export interface Stroke {
  id: string;
  color: number;
  width: number;
  points: number[];
  by: string; // uid
}

export interface JoinRequest {
  spaceId: string;
  name: string;
  look: AvatarLook;
  /** Random secret kept in this browser. The server turns it into the public uid. */
  clientKey: string;
}

export interface JoinResult {
  ok: true;
  selfId: string;
  selfUid: string;
  spaceId: string;
  uploadToken: string; // proves "I am in this space" when uploading (sent in a header only)
  downloadToken: string; // read-only token for file URLs (may end up in links, logs, history)
  iceServers: RTCIceServerLike[]; // STUN, and TURN with a temporary password just for me
  players: Player[];
  chat: ChatMessage[];
  files: FileMeta[];
  notes: Note[];
}

/** Same shape as the browser's RTCIceServer (written out so the server does not need DOM types). */
export interface RTCIceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface JoinError {
  ok: false;
  error: string;
}

export interface MoveMsg {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
}

/** WebRTC signaling payload relayed by the server without reading it. */
export interface SignalMsg {
  to: string;
  data: unknown;
}

export interface ServerToClient {
  'player:join': (p: Player) => void;
  'player:leave': (id: string) => void;
  'player:move': (m: MoveMsg & { id: string }) => void;
  'player:state': (m: PlayerStatePatch & { id: string }) => void;
  'player:profile': (m: { id: string; name: string; look: AvatarLook }) => void;
  react: (m: { id: string; emoji: string }) => void;
  action: (m: { id: string; kind: ActionKind }) => void;
  chat: (m: ChatMessage) => void;
  signal: (m: { from: string; data: unknown }) => void;
  intercom: (m: { from: string; name: string }) => void;
  'file:add': (f: FileMeta) => void;
  'file:remove': (id: string) => void;
  'note:add': (n: Note) => void;
  'note:remove': (id: string) => void;
  'wb:stroke': (m: { board: string; stroke: Stroke }) => void;
  'wb:clear': (m: { board: string; by: string }) => void;
  /** A short message for this person only (e.g. "the whiteboard is full"). */
  notice: (text: string) => void;
}

export interface ClientToServer {
  join: (req: JoinRequest, ack: (res: JoinResult | JoinError) => void) => void;
  move: (m: MoveMsg) => void;
  state: (m: PlayerStatePatch) => void;
  profile: (m: { name: string; look: AvatarLook }) => void;
  react: (emoji: string) => void;
  action: (kind: ActionKind) => void;
  chat: (m: { channel: ChatChannel; text: string }) => void;
  signal: (m: SignalMsg) => void;
  intercom: (to: string) => void;
  'file:remove': (id: string) => void;
  'note:add': (m: { x: number; y: number; text: string; color: number }) => void;
  'note:remove': (id: string) => void;
  'wb:open': (board: string, ack: (strokes: Stroke[] | null) => void) => void;
  'wb:stroke': (m: { board: string; stroke: Omit<Stroke, 'id' | 'by'> }) => void;
  'wb:clear': (board: string) => void;
}
