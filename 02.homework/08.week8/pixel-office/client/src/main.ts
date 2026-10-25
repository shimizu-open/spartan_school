// Entry point of the browser app.

import './style.css';
import { AppController } from './controllers/AppController.ts';

const root = document.getElementById('app')!;
new AppController(root).route();

// PWA: cache the app shell so it starts fast and can be installed.
// Only in production builds (the dev server changes files all the time).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // updateViaCache 'none': always check sw.js itself for a new version
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  });
}
