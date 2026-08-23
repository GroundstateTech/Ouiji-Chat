const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const {
  normalizeUsername,
  normalizeRoom,
  cleanText,
  hashPassword,
  verifyPassword,
  newSessionToken,
  safePublicUser
} = require('./security');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.OUIJI_HOST || '127.0.0.1';
const DATA = path.join(__dirname, 'data');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_HISTORY = 500;
const MAX_STORED_MESSAGES = 10000;
const MAX_EVENTS_PER_MINUTE = 120;
const MAX_LOGIN_ATTEMPTS_PER_MINUTE = 10;

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
const fp = name => path.join(DATA, name);
const read = (name, fallback) => {
  try {
    return fs.existsSync(fp(name)) ? JSON.parse(fs.readFileSync(fp(name), 'utf8')) : fallback;
  } catch {
    return fallback;
  }
};
const save = (name, data) => {
  const target = fp(name);
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, target);
};

function demoUsers() {
  return [
    ['michael', 'Michael', 'admin', 'Director', 'michael@groundstate.local', '101', 'HQ', 'Building Groundstate'],
    ['sarah', 'Sarah', 'admin', 'Coordinator', 'sarah@groundstate.local', '102', 'HQ', ''],
    ['kevin', 'Kevin', 'it', 'Technician', 'kevin@groundstate.local', '201', 'Server Room', ''],
    ['lisa', 'Lisa', 'eng', 'Engineer', 'lisa@groundstate.local', '301', 'Lab', ''],
    ['steve', 'Steve', 'ops', 'Operator', 'steve@groundstate.local', '401', 'Floor', ''],
    ['amanda', 'Amanda', 'research', 'Researcher', 'amanda@groundstate.local', '501', 'Research', '']
  ].map(([username, displayName, departmentId, role, email, extension, location, statusMessage]) => ({
    username,
    passwordHash: hashPassword('password'),
    displayName,
    departmentId,
    role,
    email,
    extension,
    location,
    status: 'Offline',
    statusMessage
  }));
}

function seed() {
  if (!fs.existsSync(fp('departments.json'))) save('departments.json', [
    { id: 'admin', name: 'Administration' },
    { id: 'it', name: 'IT' },
    { id: 'eng', name: 'Engineering' },
    { id: 'ops', name: 'Operations' },
    { id: 'research', name: 'Research' }
  ]);
  if (!fs.existsSync(fp('projects.json'))) save('projects.json', [
    { id: 'blackglass', name: 'BlackGlass' },
    { id: 'caregrid', name: 'CareGrid' },
    { id: 'staffroot', name: 'StaffRoot' },
    { id: 'iupetra', name: 'IuPetra' },
    { id: 'thothscript', name: 'ThothScript' },
    { id: 'bonepile', name: 'Bonepile' }
  ]);
  if (!fs.existsSync(fp('users.json'))) save('users.json', demoUsers());
  if (!fs.existsSync(fp('messages.json'))) save('messages.json', []);
  if (!fs.existsSync(fp('roomMessages.json'))) save('roomMessages.json', []);
}

seed();

let users = read('users.json', []);
let departments = read('departments.json', []);
let projects = read('projects.json', []);
let messages = read('messages.json', []);
let roomMessages = read('roomMessages.json', []);

let migratedPasswords = false;
for (const user of users) {
  if (!user.passwordHash && typeof user.password === 'string') {
    user.passwordHash = hashPassword(user.password);
    delete user.password;
    migratedPasswords = true;
  }
}
if (migratedPasswords) save('users.json', users);

let migratedMessages = false;
for (const message of messages) {
  if (!message.id) {
    message.id = crypto.randomUUID();
    migratedMessages = true;
  }
  if (!Object.hasOwn(message, 'deliveredAt')) {
    message.deliveredAt = null;
    migratedMessages = true;
  }
  if (!Object.hasOwn(message, 'readAt')) {
    message.readAt = null;
    migratedMessages = true;
  }
}
if (migratedMessages) save('messages.json', messages);

const sockets = new Map();
const socketsByUser = new Map();
const sessions = new Map();
const sessionSockets = new Map();
const socketSessions = new WeakMap();
const limits = new WeakMap();

function departmentName(id) {
  return departments.find(item => item.id === id)?.name || '';
}
function pub(user) {
  return safePublicUser(user, departmentName(user.departmentId));
}
function directory() {
  users = read('users.json', users);
  return { departments, users: users.map(pub), projects };
}
function allowedRooms() {
  return new Set([
    ...departments.map(d => d.name),
    ...projects.map(p => `${p.name}-General`)
  ]);
}
function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}
function broadcast(payload) {
  const body = JSON.stringify(payload);
  for (const client of wss.clients) if (client.readyState === 1) client.send(body);
}
function sendToUser(username, payload) {
  const set = socketsByUser.get(username);
  if (!set) return false;
  let sent = false;
  for (const ws of set) {
    if (ws.readyState === 1) {
      send(ws, payload);
      sent = true;
    }
  }
  return sent;
}
function sendError(ws, code, message) {
  send(ws, { type: 'error', code, message });
}
function trimStore(list) {
  return list.length > MAX_STORED_MESSAGES ? list.slice(-MAX_STORED_MESSAGES) : list;
}
function rateAllowed(ws, bucket = 'events', limit = MAX_EVENTS_PER_MINUTE) {
  const now = Date.now();
  const state = limits.get(ws) || {};
  const current = state[bucket] || { start: now, count: 0 };
  if (now - current.start >= 60000) {
    current.start = now;
    current.count = 0;
  }
  current.count += 1;
  state[bucket] = current;
  limits.set(ws, state);
  return current.count <= limit;
}
function markPendingDelivered(username) {
  const deliveredAt = new Date().toISOString();
  const changed = [];
  for (const message of messages) {
    if (message.to === username && !message.deliveredAt) {
      message.deliveredAt = deliveredAt;
      changed.push(message);
    }
  }
  if (!changed.length) return;
  save('messages.json', messages);
  for (const message of changed) {
    sendToUser(message.from, { type: 'dmDelivery', messageId: message.id, deliveredAt });
  }
}
function attach(ws, username) {
  const existing = sockets.get(ws);
  if (existing === username) return;
  if (existing) detach(ws);
  sockets.set(ws, username);
  if (!socketsByUser.has(username)) socketsByUser.set(username, new Set());
  const set = socketsByUser.get(username);
  const first = set.size === 0;
  set.add(ws);
  const user = users.find(item => item.username === username);
  if (user) {
    user.status = 'Online';
    save('users.json', users);
  }
  if (first) {
    markPendingDelivered(username);
    broadcast({ type: 'buddyOnline', username });
    broadcast({ type: 'directory', ...directory() });
  }
}
function detach(ws) {
  const username = sockets.get(ws);
  if (!username) return;
  sockets.delete(ws);
  const set = socketsByUser.get(username);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    socketsByUser.delete(username);
    const user = users.find(item => item.username === username);
    if (user) {
      user.status = 'Offline';
      save('users.json', users);
    }
    broadcast({ type: 'buddyOffline', username });
    broadcast({ type: 'directory', ...directory() });
  }
}
function unbindSession(ws) {
  const token = socketSessions.get(ws);
  if (!token) return;
  socketSessions.delete(ws);
  const set = sessionSockets.get(token);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sessionSockets.delete(token);
}
function bindSession(ws, token, username) {
  const previous = socketSessions.get(ws);
  if (previous && previous !== token) revokeSession(previous, 'Session replaced');
  socketSessions.set(ws, token);
  if (!sessionSockets.has(token)) sessionSockets.set(token, new Set());
  sessionSockets.get(token).add(ws);
  attach(ws, username);
}
function newSession(username) {
  const token = newSessionToken();
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}
function resumeSession(tokenValue) {
  const token = String(tokenValue || '');
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    revokeSession(token, 'Session expired');
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, username: session.username };
}
function revokeSession(tokenValue, reason = 'Session revoked') {
  const token = String(tokenValue || '');
  sessions.delete(token);
  const set = sessionSockets.get(token);
  if (!set) return;
  sessionSockets.delete(token);
  for (const ws of [...set]) {
    send(ws, { type: 'sessionRevoked', message: reason });
    socketSessions.delete(ws);
    detach(ws);
    try { ws.close(4001, reason.slice(0, 120)); } catch {}
  }
}
function requireAuth(ws) {
  const username = sockets.get(ws);
  const token = socketSessions.get(ws);
  const session = token ? sessions.get(token) : null;
  if (!username || !token || !session || session.username !== username || session.expiresAt <= Date.now()) {
    if (token) revokeSession(token, 'Session expired or invalid');
    else sendError(ws, 'AUTH_REQUIRED', 'Authentication required.');
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return username;
}

const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  path: '/ws',
  maxPayload: 64 * 1024,
  perMessageDeflate: false
});

console.log(`Ouiji server listening on ws://${HOST}:${PORT}/ws`);
if (HOST === '127.0.0.1' || HOST === 'localhost') {
  console.log('Local-only mode. Set OUIJI_HOST=0.0.0.0 explicitly for trusted LAN access.');
}

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { type: 'hello', protocol: 3 });

  ws.on('message', raw => {
    if (!rateAllowed(ws)) return sendError(ws, 'RATE_LIMIT', 'Too many requests. Try again shortly.');
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return sendError(ws, 'BAD_JSON', 'Invalid message format.');
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      return sendError(ws, 'BAD_MESSAGE', 'Message type is required.');
    }

    if (msg.type === 'login') {
      if (!rateAllowed(ws, 'login', MAX_LOGIN_ATTEMPTS_PER_MINUTE)) {
        return sendError(ws, 'LOGIN_RATE_LIMIT', 'Too many login attempts.');
      }
      const username = normalizeUsername(msg.username);
      const password = String(msg.password || '').slice(0, 256);
      const user = users.find(item => item.username.toLowerCase() === username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return send(ws, { type: 'auth', success: false, message: 'Invalid username or password' });
      }
      const sessionToken = newSession(user.username);
      bindSession(ws, sessionToken, user.username);
      return send(ws, { type: 'auth', success: true, sessionToken, username: user.username, user: pub(user), ...directory() });
    }

    if (msg.type === 'resumeSession') {
      const resumed = resumeSession(msg.sessionToken);
      if (!resumed) return send(ws, { type: 'session', success: false, message: 'Session expired or invalid.' });
      bindSession(ws, resumed.token, resumed.username);
      return send(ws, { type: 'session', success: true, username: resumed.username });
    }

    const username = requireAuth(ws);
    if (!username) return;

    if (msg.type === 'logout') {
      const token = socketSessions.get(ws);
      send(ws, { type: 'logout', success: true });
      if (token) revokeSession(token, 'Signed out');
      return;
    }
    if (msg.type === 'getDirectory') return send(ws, { type: 'directory', ...directory() });
    if (msg.type === 'setStatus') {
      const status = ['Online', 'Busy', 'Meeting', 'Away'].includes(msg.status) ? msg.status : 'Online';
      const user = users.find(item => item.username === username);
      if (user) {
        user.status = status;
        user.statusMessage = cleanText(msg.statusMessage, 160);
        save('users.json', users);
        broadcast({ type: 'directory', ...directory() });
      }
      return;
    }
    if (msg.type === 'getEmployeeCard') {
      const target = normalizeUsername(msg.username);
      const user = users.find(item => item.username.toLowerCase() === target);
      return send(ws, { type: 'employeeCard', user: user ? pub(user) : null });
    }
    if (msg.type === 'getConversation') {
      const buddy = normalizeUsername(msg.buddy);
      if (!buddy) return sendError(ws, 'BAD_BUDDY', 'Invalid buddy name.');
      const history = messages.filter(m =>
        (m.from.toLowerCase() === username && m.to.toLowerCase() === buddy) ||
        (m.from.toLowerCase() === buddy && m.to.toLowerCase() === username)
      ).slice(-MAX_HISTORY);
      return send(ws, { type: 'conversationHistory', messages: history });
    }
    if (msg.type === 'markConversationRead') {
      const buddy = normalizeUsername(msg.buddy);
      if (!buddy) return sendError(ws, 'BAD_BUDDY', 'Invalid buddy name.');
      const readAt = new Date().toISOString();
      const changed = [];
      for (const message of messages) {
        if (message.from.toLowerCase() === buddy && message.to === username && !message.readAt) {
          if (!message.deliveredAt) message.deliveredAt = readAt;
          message.readAt = readAt;
          changed.push(message);
        }
      }
      if (changed.length) {
        save('messages.json', messages);
        sendToUser(buddy, {
          type: 'dmRead',
          reader: username,
          messageIds: changed.map(message => message.id),
          readAt
        });
      }
      return send(ws, { type: 'conversationRead', buddy, messageIds: changed.map(message => message.id), readAt });
    }
    if (msg.type === 'dmSend') {
      const to = normalizeUsername(msg.to);
      const text = cleanText(msg.text, 4000);
      if (!to || !text) return sendError(ws, 'BAD_DM', 'Recipient and message are required.');
      const recipient = users.find(item => item.username.toLowerCase() === to);
      if (!recipient) return sendError(ws, 'NO_USER', 'Recipient does not exist.');
      const timestamp = new Date().toISOString();
      const recipientOnline = !!socketsByUser.get(recipient.username)?.size;
      const dm = {
        id: crypto.randomUUID(),
        from: username,
        to: recipient.username,
        text,
        timestamp,
        deliveredAt: recipientOnline ? timestamp : null,
        readAt: null
      };
      messages = trimStore([...messages, dm]);
      save('messages.json', messages);
      const payload = { type: 'message', ...dm };
      sendToUser(username, payload);
      if (recipient.username !== username) sendToUser(recipient.username, payload);
      if (dm.deliveredAt) sendToUser(username, { type: 'dmDelivery', messageId: dm.id, deliveredAt: dm.deliveredAt });
      return;
    }
    if (msg.type === 'joinRoom') {
      const room = normalizeRoom(msg.room);
      if (!room || !allowedRooms().has(room)) return sendError(ws, 'BAD_ROOM', 'Unknown room.');
      const history = roomMessages.filter(m => m.room === room).slice(-MAX_HISTORY);
      return send(ws, { type: 'roomHistory', room, messages: history });
    }
    if (msg.type === 'roomSend') {
      const room = normalizeRoom(msg.room);
      const text = cleanText(msg.text, 4000);
      if (!room || !allowedRooms().has(room) || !text) return sendError(ws, 'BAD_ROOM_MESSAGE', 'Valid room and message are required.');
      const rm = { room, from: username, text, timestamp: new Date().toISOString() };
      roomMessages = trimStore([...roomMessages, rm]);
      save('roomMessages.json', roomMessages);
      broadcast({ type: 'roomMessage', ...rm });
      return;
    }

    sendError(ws, 'UNKNOWN_TYPE', 'Unknown message type.');
  });

  const cleanup = () => {
    detach(ws);
    unbindSession(ws);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

const heartbeat = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) revokeSession(token, 'Session expired');
  }
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => clearInterval(heartbeat));