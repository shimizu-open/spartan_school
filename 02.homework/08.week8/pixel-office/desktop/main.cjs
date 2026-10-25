// Pixel Office desktop app (Electron).
//
// Like Discord's desktop app, this is a window that shows the web app from
// your server, so the desktop app and the browser always run the same version.
// The page gets no access to Node.js or the computer; it only gets the
// camera, microphone and screen capture, and only from your server's address.
//
// Server address, in order of priority:
//   1. environment variable PIXEL_OFFICE_URL
//   2. "url" in config.json (menu: ファイル > サーバー設定を開く)
//   3. "pixelOffice.defaultUrl" in package.json

const { app, BrowserWindow, Menu, desktopCapturer, dialog, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const pkg = require('./package.json');

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'config.json');

/** Only https, or http to this computer (for development), is allowed. */
function safeUrl(raw) {
  try {
    const u = new URL(raw);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u;
  } catch {
    // invalid
  }
  return null;
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

function serverUrl() {
  const candidates = [process.env.PIXEL_OFFICE_URL, readConfig().url, pkg.pixelOffice.defaultUrl];
  for (const c of candidates) {
    const u = c && safeUrl(c);
    if (u) return u;
  }
  return new URL('http://localhost:3000');
}

const APP_URL = () => serverUrl();
const isAppOrigin = (url) => {
  try {
    return new URL(url).origin === APP_URL().origin;
  } catch {
    return false;
  }
};

const ALLOWED_PERMISSIONS = new Set(['media', 'display-capture', 'notifications', 'fullscreen', 'clipboard-sanitized-write', 'speaker-selection']);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Pixel Office',
    backgroundColor: '#1d1f2b',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      // Security: the page is treated like a normal website.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted (normal during navigation)
    void win.loadFile(path.join(__dirname, 'offline.html'), { query: { url } });
  });

  void win.loadURL(APP_URL().href);
}

function setupSecurity() {
  const ses = session.defaultSession;

  // Camera, mic and screen only for our own server.
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(details.requestingUrl || wc.getURL()));
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(requestingOrigin);
  });

  // Screen sharing: Electron has no built-in picker, so show a simple one.
  ses.setDisplayMediaRequestHandler(
    async (request, callback) => {
      if (!isAppOrigin(request.securityOrigin || request.frame?.url || '')) return callback({});
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const choices = sources.slice(0, 12);
      if (choices.length === 0) return callback({});
      const { response } = await dialog.showMessageBox(win, {
        type: 'question',
        title: '画面共有',
        message: '共有する画面またはウィンドウを選んでください',
        buttons: [...choices.map((s) => s.name.slice(0, 40)), 'キャンセル'],
        cancelId: choices.length,
        noLink: true,
      });
      const picked = choices[response];
      callback(picked ? { video: picked } : {});
    },
    { useSystemPicker: true }, // macOS 15+: use the system's own picker instead
  );

  app.on('web-contents-created', (_e, contents) => {
    // Never navigate the window away from our server.
    contents.on('will-navigate', (event, url) => {
      const offline = pathToFileURL(path.join(__dirname, 'offline.html')).href;
      if (!isAppOrigin(url) && !url.startsWith(offline)) event.preventDefault();
    });
    contents.on('will-redirect', (event, url) => {
      if (!isAppOrigin(url)) event.preventDefault();
    });
    // Links that open a new window go to the normal browser (https only).
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}

function setupMenu() {
  const template = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: 'サーバー設定を開く',
          click: () => {
            if (!fs.existsSync(CONFIG_FILE())) {
              fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
              fs.writeFileSync(CONFIG_FILE(), JSON.stringify({ url: APP_URL().href }, null, 2));
            }
            void shell.openPath(CONFIG_FILE());
          },
        },
        { label: '再読み込み', accelerator: 'CmdOrCtrl+R', click: () => win?.loadURL(APP_URL().href) },
        { type: 'separator' },
        { role: 'quit', label: '終了' },
      ],
    },
    { label: '編集', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '表示', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ];
  if (!app.isPackaged) template[2].submenu.push({ role: 'toggleDevTools' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Only one window of the app at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    setupSecurity();
    setupMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
