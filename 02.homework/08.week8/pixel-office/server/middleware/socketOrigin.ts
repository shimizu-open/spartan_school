// Stops other websites from opening a realtime connection using a visitor's browser.

import type { IncomingMessage } from 'node:http';

export function socketOriginCheck(extraOrigins: string[], trustProxy: boolean) {
  return (req: IncomingMessage, callback: (err: string | null | undefined, success: boolean) => void): void => {
    const origin = req.headers.origin;
    if (!origin) return callback(null, true); // not a browser (tests, health tools)
    let ok = false;
    try {
      // Behind CloudFront/ALB the original host arrives in X-Forwarded-Host.
      const fwd = trustProxy ? (req.headers['x-forwarded-host'] as string | undefined) : undefined;
      const host = fwd ?? req.headers.host;
      ok = new URL(origin).host === host || extraOrigins.includes(origin);
    } catch {
      ok = false;
    }
    callback(ok ? null : 'origin not allowed', ok);
  };
}
