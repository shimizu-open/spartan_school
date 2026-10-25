// When ORIGIN_SECRET is set, every request must carry the header X-Origin-Secret with
// that value. CloudFront adds it (an "origin custom header"), so requests that go
// around CloudFront straight to the server are refused. The Docker health check
// (from inside the container, 127.0.0.1) is still allowed.

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function hasOriginSecret(req: IncomingMessage, secret: string): boolean {
  if (!secret) return true;
  const got = req.headers['x-origin-secret'];
  if (typeof got !== 'string') return false;
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isLocalHealthCheck(req: IncomingMessage): boolean {
  const ip = req.socket.remoteAddress ?? '';
  return (req.url ?? '').startsWith('/healthz') && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
}
