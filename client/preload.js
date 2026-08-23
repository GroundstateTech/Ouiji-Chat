const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ouijiAPI", {
  openDM: (viewer, buddy) => ipcRenderer.send("open-dm", { viewer, buddy }),
  openRoom: (viewer, room) => ipcRenderer.send("open-room", { viewer, room }),
  openCard: (viewer, target) => ipcRenderer.send("open-card", { viewer, target })
});
