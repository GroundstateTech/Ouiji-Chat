const { contextBridge, ipcRenderer } = require('electron');

function safeIdentity(value) {
  const text = String(value || '').trim();
  return /^[a-z0-9._-]{1,32}$/i.test(text) ? text : '';
}
function safeRoom(value) {
  const text = String(value || '').trim();
  return /^[a-z0-9 ._:-]{1,80}$/i.test(text) ? text : '';
}
function safeSession(value) {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_-]{32,200}$/.test(text) ? text : '';
}

contextBridge.exposeInMainWorld('ouijiAPI', {
  openDM: (viewer, buddy, sessionToken) => {
    const payload = { viewer: safeIdentity(viewer), buddy: safeIdentity(buddy), sessionToken: safeSession(sessionToken) };
    if (payload.viewer && payload.buddy && payload.sessionToken) ipcRenderer.send('open-dm', payload);
  },
  openRoom: (viewer, room, sessionToken) => {
    const payload = { viewer: safeIdentity(viewer), room: safeRoom(room), sessionToken: safeSession(sessionToken) };
    if (payload.viewer && payload.room && payload.sessionToken) ipcRenderer.send('open-room', payload);
  },
  openCard: (viewer, target, sessionToken) => {
    const payload = { viewer: safeIdentity(viewer), target: safeIdentity(target), sessionToken: safeSession(sessionToken) };
    if (payload.viewer && payload.target && payload.sessionToken) ipcRenderer.send('open-card', payload);
  }
});
