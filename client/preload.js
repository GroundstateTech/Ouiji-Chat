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
function safeNotice(value, max) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
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
  },
  isConversationOpen: async (kind, viewer, target) => {
    const normalizedKind = kind === 'room' ? 'room' : kind === 'dm' ? 'dm' : '';
    const payload = {
      kind: normalizedKind,
      viewer: safeIdentity(viewer),
      target: normalizedKind === 'room' ? safeRoom(target) : safeIdentity(target)
    };
    if (!payload.kind || !payload.viewer || !payload.target) return false;
    return !!(await ipcRenderer.invoke('conversation-open', payload));
  },
  notify: (title, body, context = {}) => {
    const kind = context.kind === 'room' ? 'room' : context.kind === 'dm' ? 'dm' : '';
    const viewer = safeIdentity(context.viewer);
    const target = kind === 'room' ? safeRoom(context.target) : safeIdentity(context.target);
    const payload = {
      title: safeNotice(title, 80),
      body: safeNotice(body, 240),
      kind,
      viewer,
      target
    };
    if (payload.title) ipcRenderer.send('notify', payload);
  }
});