/**
 * Chordless desktop shell (Electron).
 *
 * - Spawns the Chordless Node server (ELECTRON_RUN_AS_NODE — no separate
 *   Node install needed) and serves the built web UI from it.
 * - System tray with Show / Play-Pause / Next / Quit.
 * - "Close to tray" and "Launch on startup" (Windows login items).
 *
 * Dev mode (repo checkout):  npm start          (run `npm run build` first)
 * Packaged:                  npm run dist     (electron-builder)
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PORT = 3001;
const HOST = '127.0.0.1';
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath)
  : path.join(__dirname, '..');
const SERVER_ENTRY = path.join(APP_ROOT, 'server', 'index.js');
const ICON_PATH = path.join(APP_ROOT, 'web', 'public', 'icon.png');

let win = null;
let tray = null;
let serverProc = null;
let quitting = false;
let prefs = { closeToTray: true, openAtLogin: false };

function loadPrefs() {
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'prefs.json'), 'utf8');
    prefs = { ...prefs, ...JSON.parse(raw) };
  } catch { /* first run */ }
  applyLoginItem();
}

function savePrefs() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(path.join(app.getPath('userData'), 'prefs.json'), JSON.stringify(prefs));
  } catch { /* ignore */ }
}

function applyLoginItem() {
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(prefs.openAtLogin), args: [] });
  } catch { /* unsupported platform */ }
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(PORT),
        HOST,
      },
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    });
    serverProc.on('error', reject);
    serverProc.on('exit', (code) => {
      if (!quitting) {
        // Keep the window usable: reload shows backend-offline toasts.
        console.error(`[desktop] server exited with code ${code}`);
      }
    });
    // Wait for the server's health endpoint before loading the window.
    const deadline = Date.now() + 30000;
    const tryHealth = () => {
      const req = http.get(`http://${HOST}:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (Date.now() < deadline) setTimeout(tryHealth, 400);
        else reject(new Error('server health check failed'));
      });
      req.on('error', () => {
        if (Date.now() < deadline) setTimeout(tryHealth, 400);
        else reject(new Error('server health check failed'));
      });
    };
    tryHealth();
  });
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createTray() {
  const image = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : new nativeImage();
  tray = new Tray(image);
  tray.setToolTip('Chordless');
  const menu = Menu.buildFromTemplate([
    { label: 'Open Chordless', click: showWindow },
    { label: 'Play / Pause', click: () => win?.webContents.send('chordless:tray', 'togglePlay') },
    { label: 'Next', click: () => win?.webContents.send('chordless:tray', 'next') },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showWindow);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    backgroundColor: '#0b0b0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(`http://${HOST}:${PORT}/`);
  // External links (license pages, etc.) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://${HOST}:${PORT}/`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.on('close', (e) => {
    if (!quitting && prefs.closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
}

// Prevent a second instance from opening its own window/server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(async () => {
    loadPrefs();
    try {
      await startServer();
    } catch (e) {
      console.error('[desktop] server failed to start:', e.message);
    }
    createWindow();
    createTray();
  });

  ipcMain.handle('prefs:get', () => ({ ...prefs }));
  ipcMain.handle('prefs:set', (_e, patch) => {
    prefs = { ...prefs, ...patch };
    savePrefs();
    applyLoginItem();
    return { ...prefs };
  });
  ipcMain.handle('app:quit', () => { quitting = true; app.quit(); });
  ipcMain.handle('app:show', showWindow);

  app.on('before-quit', () => {
    quitting = true;
    if (serverProc && !serverProc.killed) serverProc.kill();
  });

  app.on('window-all-closed', () => {
    // In tray mode, closing the window hides it — quit only via tray menu.
    if (!prefs.closeToTray) app.quit();
  });

  app.on('activate', showWindow);
}
