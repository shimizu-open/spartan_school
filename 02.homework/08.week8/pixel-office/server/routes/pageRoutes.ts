// Serves the built browser app (production). Every page URL returns the same
// index.html; the browser-side router decides what to show.

import path from 'node:path';
import express, { Router } from 'express';

export function pageRoutes(distDir: string): Router {
  const r = Router();
  r.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, file) {
        // Files in assets/ have a content hash in their name, so they can be cached forever.
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  r.get(/^\/(s\/[A-Za-z0-9_-]{1,64})?\/?$/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
  return r;
}
