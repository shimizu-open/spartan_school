import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, 'client'),
  publicDir: path.join(root, 'client/public'),
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
});
