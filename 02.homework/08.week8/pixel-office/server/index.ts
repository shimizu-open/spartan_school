// Entry point: starts the server.
//   npm run dev   -> development (Vite hot reload), http://localhost:3000
//   npm start     -> production (serves dist/), used in the Docker image

import { createAppServer } from './app.ts';
import { config } from './config.ts';

const server = await createAppServer();
server.listen(config.port, config.host, () => {
  console.log(`Pixel Office on http://localhost:${config.port} (${config.production ? 'production' : 'development'})`);
});

// Docker sends SIGTERM on stop; close connections cleanly.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
