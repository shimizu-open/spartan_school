// Short-lived TURN passwords (the "TURN REST API" scheme supported by coturn's
// --use-auth-secret). Only people who joined a space get them, and they expire,
// so nobody can copy a fixed password and use our TURN server as a free relay.
//
//   username   = "<expiry unix seconds>:<uid>"
//   credential = base64( HMAC-SHA1( TURN_SECRET, username ) )

import { createHmac } from 'node:crypto';

export function turnCredential(secret: string, uid: string, ttlSeconds: number, now = Date.now()): { username: string; credential: string } {
  const username = `${Math.floor(now / 1000) + ttlSeconds}:${uid}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

/** ICE servers for one person: the public STUN list, plus TURN with their own temporary password. */
export function iceServersFor(uid: string, stun: unknown[], turnUrls: string[], turnSecret: string): unknown[] {
  if (!turnUrls.length || !turnSecret) return stun;
  return [...stun, { urls: turnUrls, ...turnCredential(turnSecret, uid, 12 * 60 * 60) }];
}
