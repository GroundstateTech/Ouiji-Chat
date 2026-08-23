const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.enableSandbox();

function readConfig() {
  const local = path.join(__dirname, '..', 'config.local.json');
  const shared = path.join(__dirname, '..', 'config.json');
  for (const file of [local, shared]) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return { companyName: 'Groundstate', serverUrl: 'ws://localhost:8080/ws' };
}

function safeString(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function safeServerUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['ws:', 'wss:'].includes(url.protocol) ? url.toString() : 'ws://localhost:8080/ws';
  } catch {
    return 'ws://localhost:8080/ws';
  }
}

function secureWindowOptions(overrides = {}) {
  return {
    autoHideMenuBar: true,
    backgroundColor: '#0d1020',
    show: false,
    ...overrides,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  };
}

function hardenWindow(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.once('ready-to-show', () => win.show());
}

function localFileUrl(file, params = {}) {
  const cfg = readConfig();
  const url = pathToFileURL(path.join(__dirname, file));
  url.searchParams.set('serverUrl', safeServerUrl(cfg.serverUrl));
  url.searchParams.set('companyName', safeString(cfg.companyName, 80));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, safeString(value, key === 'sessionToken' ? 200 : 120));
  }
  return url.toString();
}

function createMainWindow() {
  const win = new BrowserWindow(secureWindowOptions({
    width: 340,
    height: 680,
    minWidth: 320,
    minHeight: 520,
    resizable: true,
    title: 'Ouiji InHouse'
  }));
  hardenWindow(win);
  win.loadURL(localFileUrl('index.html'));
}

function openWindow(file, params, opts = {}) {
  const allowed = new Set(['chat.html', 'employee-card.html']);
  if (!allowed.has(file)) return;
  const win = new BrowserWindow(secureWindowOptions({
    width: opts.width || 640,
    height: opts.height || 480,
    minWidth: 380,
    minHeight: 300,
    resizable: true,
    title: safeString(opts.title || 'Ouiji InHouse', 120)
  }));
  hardenWindow(win);
  win.loadURL(localFileUrl(file, params));
}

function validIdentity(value) {
  return /^[a-z0-9._-]{1,32}$/i.test(String(value || ''));
}
function validRoom(value) {
  return /^[a-z0-9 ._:-]{1,80}$/i.test(String(value || ''));
}
function validSession(value) {
  return /^[A-Za-z0-9_-]{32,200}$/.test(String(value || ''));
}

app.whenReady().then(createMainWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('open-dm', (_event, payload = {}) => {
  if (!validIdentity(payload.viewer) || !validIdentity(payload.buddy) || !validSession(payload.sessionToken)) return;
  openWindow('chat.html', {
    kind: 'dm', viewer: payload.viewer, buddy: payload.buddy, sessionToken: payload.sessionToken
  }, { title: `Chat - ${payload.buddy}` });
});

ipcMain.on('open-room', (_event, payload = {}) => {
  if (!validIdentity(payload.viewer) || !validRoom(payload.room) || !validSession(payload.sessionToken)) return;
  openWindow('chat.html', {
    kind: 'room', viewer: payload.viewer, room: payload.room, sessionToken: payload.sessionToken
  }, { title: `Room - ${payload.room}` });
});

ipcMain.on('open-card', (_event, payload = {}) => {
  if (!validIdentity(payload.viewer) || !validIdentity(payload.target) || !validSession(payload.sessionToken)) return;
  openWindow('employee-card.html', {
    viewer: payload.viewer, target: payload.target, sessionToken: payload.sessionToken
  }, { width: 460, height: 390, title: `Employee Card - ${payload.target}` });
});

ipcMain.on('notify', (_event, payload = {}) => {
  if (!Notification.isSupported()) return;
  const title = safeString(payload.title, 80);
  const body = safeString(payload.body, 240);
  if (!title) return;
  new Notification({ title, body, silent: true }).show();
});
