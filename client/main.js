const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8")); }
  catch { return { companyName: "Groundstate", serverUrl: "ws://localhost:8080/ws" }; }
}

function createMainWindow() {
  const cfg = readConfig();
  const win = new BrowserWindow({
    width: 320, height: 640, resizable: false, autoHideMenuBar: true,
    title: "Ouiji", backgroundColor: "#0d1020",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  const url = new URL(`file://${path.join(__dirname, "index.html")}`);
  url.searchParams.set("serverUrl", cfg.serverUrl);
  url.searchParams.set("companyName", cfg.companyName);
  win.loadURL(url.toString());
}

function openWindow(file, params, opts={}) {
  const cfg = readConfig();
  const win = new BrowserWindow({
    width: opts.width || 640, height: opts.height || 480, resizable: true,
    autoHideMenuBar: true, title: opts.title || "Ouiji",
    backgroundColor: "#1b1f2b",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  const url = new URL(`file://${path.join(__dirname, file)}`);
  url.searchParams.set("serverUrl", cfg.serverUrl);
  url.searchParams.set("companyName", cfg.companyName);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);
  win.loadURL(url.toString());
}

app.whenReady().then(createMainWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
ipcMain.on("open-dm", (_, p) => openWindow("chat.html", {kind:"dm", viewer:p.viewer, buddy:p.buddy}, {title:`Chat - ${p.buddy}`}));
ipcMain.on("open-room", (_, p) => openWindow("chat.html", {kind:"room", viewer:p.viewer, room:p.room}, {title:`Room - ${p.room}`}));
ipcMain.on("open-card", (_, p) => openWindow("employee-card.html", {viewer:p.viewer, target:p.target}, {width:440,height:360,title:`Employee Card - ${p.target}`}));
