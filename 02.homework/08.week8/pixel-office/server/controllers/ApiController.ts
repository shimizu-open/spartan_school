// Controller: small HTTP endpoints.

import type { Request, Response } from 'express';
import type { SpaceStore } from '../models/SpaceStore.ts';
import { healthView } from '../views/spaceView.ts';

export class ApiController {
  private readonly store: SpaceStore;

  constructor(store: SpaceStore) {
    this.store = store;
  }

  /** Used by Docker HEALTHCHECK and AWS load balancer health checks. */
  health = (_req: Request, res: Response): void => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(healthView(this.store.stats()));
  };
}
