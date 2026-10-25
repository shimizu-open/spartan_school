// Adds security headers to every HTTP response.
// The Content-Security-Policy only lets the page load code and media from this server.

import type { NextFunction, Request, Response } from 'express';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(withCsp: boolean, https: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // In development Vite injects inline scripts for hot reload, so the CSP is production only.
    if (withCsp) res.setHeader('Content-Security-Policy', CSP);
    // Behind CloudFront (HTTPS): tell browsers to always use HTTPS for this site.
    if (https) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=()');
    next();
  };
}
