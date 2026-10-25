// WebRTC call-setup messages ("signals") passed between two browsers by the server.
// Both the server (before relaying) and the browser (before using) rebuild them
// from scratch with strict types and sizes, so junk can never get through.

export type Signal =
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice'; candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } }
  | { kind: 'bye' };

const MAX_SDP = 20_000;
const MAX_CANDIDATE = 1_000;

/** Returns a clean copy of a signal, or null if it is not a valid one. */
export function cleanSignal(v: unknown): Signal | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  switch (o.kind) {
    case 'offer':
    case 'answer':
      return typeof o.sdp === 'string' && o.sdp.length > 0 && o.sdp.length <= MAX_SDP ? { kind: o.kind, sdp: o.sdp } : null;
    case 'ice': {
      const c = o.candidate as Record<string, unknown> | null;
      if (!c || typeof c !== 'object' || typeof c.candidate !== 'string' || c.candidate.length > MAX_CANDIDATE) return null;
      const mid = typeof c.sdpMid === 'string' && c.sdpMid.length <= 64 ? c.sdpMid : null;
      const line = Number.isInteger(c.sdpMLineIndex) && (c.sdpMLineIndex as number) >= 0 && (c.sdpMLineIndex as number) < 16 ? (c.sdpMLineIndex as number) : null;
      return { kind: 'ice', candidate: { candidate: c.candidate, sdpMid: mid, sdpMLineIndex: line } };
    }
    case 'bye':
      return { kind: 'bye' };
    default:
      return null;
  }
}
