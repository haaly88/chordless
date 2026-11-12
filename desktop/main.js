/**
 * Chordless desktop shell (Electron).
 *
 * - Spawns the Chordless Node server (ELECTRON_RUN_AS_NODE — no separate
 *   Node install needed) and serves the built web UI from it.
 * - System tray with Show / Play-Pause / Next / Quit.
 * - "Close to tray" and "Launch on startup" (Windows login items).
 *
 * v2 startup: the window opens immediately; the server spawns in parallel
 * and the page loads once the server is healthy (or after a short deadline).
 * If port 3001 is already held by an orphaned server process, a healthy
 * existing server is reused; otherwise the next free port is tried.
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const BASE_PORT = 3001;
const HOST = '127.0.0.1';
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath)
  : path.join(__dirname, '..');
const SERVER_ENTRY = path.join(APP_ROOT, 'server', 'index.js');
const ICON_PATH = [
  path.join(APP_ROOT, 'web', 'dist', 'icon.png'),
  path.join(APP_ROOT, 'web', 'public', 'icon.png'),
].find((p) => fs.existsSync(p)) || path.join(APP_ROOT, 'web', 'dist', 'icon.png');

let win = null;
let tray = null;
let serverProc = null;
let activePort = BASE_PORT;
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

/**
 * macOS marks every file that came from a downloaded archive with the
 * quarantine attribute, which blocks the bundled yt-dlp helper from running.
 * The app itself is not signed, so we clear the flag for our own helper.
 */
function clearHelperQuarantine() {
  if (process.platform !== 'darwin') return;
  const helper = path.join(APP_ROOT, 'yt-dlp', 'yt-dlp_macos');
  if (!fs.existsSync(helper)) return;
  try {
    spawn('xattr', ['-dr', 'com.apple.quarantine', helper], { windowsHide: true });
  } catch { /* best effort */ }
}

function logServer(msg) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'chordless-server.log'), line);
    // keep the log bounded (~200 KB)
    const logPath = path.join(app.getPath('userData'), 'chordless-server.log');
    const size = fs.statSync(logPath).size;
    if (size > 200 * 1024) {
      const data = fs.readFileSync(logPath);
      fs.writeFileSync(logPath, data.subarray(data.length - 100 * 1024));
    }
  } catch { /* ignore */ }
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${port}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkHealth(port)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function spawnServer(port, lan = false) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: APP_ROOT,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          NODE_ENV: 'production',
          PORT: String(port),
          HOST: lan ? '0.0.0.0' : HOST,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      logServer(`spawn failed: ${e.message}`);
      resolve(null);
      return;
    }
    serverProc = proc;
    proc.stdout.on('data', (d) => logServer(`[server:out] ${String(d).trim()}`));
    proc.stderr.on('data', (d) => logServer(`[server:err] ${String(d).trim()}`));
    proc.on('error', (e) => {
      logServer(`spawn error: ${e.message}`);
      resolve(null);
    });
    proc.on('exit', (code, signal) => {
      logServer(`server exited (code=${code}, signal=${signal})`);
      if (serverProc === proc) serverProc = null;
      if (!quitting) console.error(`[desktop] server exited with code ${code}`);
    });
    resolve(proc);
  });
}

async function startServer() {
  // LAN mode: bind 0.0.0.0 so phones on the same Wi-Fi can use the app
  // (their own residential IP is not blocked by YouTube, so streaming and
  // offline downloads work there).
  const lan = String(process.env.CHORDLESS_LAN || '').trim() === '1';

  // 1) Reuse a healthy orphaned server on the default port if one exists.
  if (await checkHealth(BASE_PORT)) {
    logServer('reusing healthy server already on ' + BASE_PORT);
    activePort = BASE_PORT;
    return true;
  }
  // 2) Otherwise spawn, trying a few ports in case of a stuck process.
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = BASE_PORT + attempt;
    logServer(`starting server on port ${port}${lan ? ' (LAN mode)' : ''}`);
    const proc = await spawnServer(port, lan);
    if (!proc) continue;
    // Do not wait for the full health timeout when the child dies right away
    // (for example because the port is still held by an old process).
    const died = new Promise((resolve) => proc.once('exit', () => resolve(true)));
    const healthy = await Promise.race([waitHealth(port, 12000), died.then(() => false)]);
    if (healthy) {
      activePort = port;
      if (lan) {
        const lanUrl = `http://${lanAddress()}:${port}`;
        logServer(`LAN url: ${lanUrl}`);
        console.log(`[desktop] LAN url: ${lanUrl}`);
      }
      return true;
    }
    try { proc.kill(); } catch { /* ignore */ }
    serverProc = null;
  }
  logServer('all server start attempts failed');
  return false;
}

/** Best guess at this machine's address on the local network. */
function lanAddress() {
  try {
    const { networkInterfaces } = require('node:os');
    for (const list of Object.values(networkInterfaces())) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch { /* ignore */ }
  return '127.0.0.1';
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createTray() {
  const image = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : new nativeImage();
  tray = new Tray(image);
  const lan = String(process.env.CHORDLESS_LAN || '').trim() === '1';
  tray.setToolTip(lan ? `Chordless — LAN: http://${lanAddress()}:${activePort}` : 'Chordless');
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
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const loadPage = () => {
    if (!win) return;
    win.loadURL(`http://${HOST}:${activePort}/`);
  };

  // Shown when the bundled server could not be started — a friendly retry
  // screen beats Electron's "ERR_CONNECTION_REFUSED" page.
  const loadErrorPage = (message) => {
    if (!win) return;
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Chordless</title><style>
      body{margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0e;color:#f4f4f7;
        font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center}
      .card{max-width:420px;padding:28px 30px;border-radius:20px;background:#141418;border:1px solid #26262e}
      h1{font-size:19px;margin:0 0 10px}p{font-size:13.5px;line-height:1.55;color:#a3a3ad;margin:0 0 18px}
      button{appearance:none;border:0;border-radius:999px;padding:10px 20px;font-size:13px;font-weight:700;
        background:#fc3c44;color:#fff;cursor:pointer}
      </style></head><body><div class="card">
      <h1>Chordless could not start its server</h1><p>${String(message).replace(/[<>&]/g, '')}</p>
      <button onclick="location.reload()">Try again</button></div></body></html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  };
  // External links (license pages, etc.) open in the system browser.
  // Allow any 127.0.0.1 port (the active port is only known after the
  // async server spawn; the default is BASE_PORT before that).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', (e) => {
    if (!quitting && prefs.closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });

  // The window is already on screen — load the app as soon as the server
  // is healthy (or after a short deadline so the user still sees the UI).
  startServer().then((ok) => {
    logServer(`server ready: ${ok} on port ${activePort}`);
    if (ok) loadPage();
    else loadErrorPage('The local server did not start. Check that port ' + activePort + ' is free and try again.');
  });
}

// Prevent a second instance from opening its own window/server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    // No default File/Edit/View menu bar — the app uses its own chrome.
    Menu.setApplicationMenu(null);
    clearHelperQuarantine();
    loadPrefs();
    createWindow();
    createTray();
  });

  ipcMain.handle('ui:scale', (_e, scale) => {
    const s = Math.max(0.4, Math.min(1.5, Number(scale) || 1));
    if (win) win.webContents.setZoomFactor(s);
    return s;
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
