const fs = require('fs');
const path = require('path');
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

// One-time migration for older alpha data that stored plaintext passwords.
let migratedPasswords = false;
for (const user of users) {
  if (!user.passwordHash && typeof user.password === 'string') {
    user.passwordHash = hashPassword(user.password);
    delete user.password;
    migratedPasswords = true;
  }
}
if (migratedPasswords) save('users.json', users);

const sockets = new Map();
const socketsByUser = new Map();
const sessions = new Map();
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
function newSession(username) {
  const token = newSessionToken();
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}
function resumeSession(token) {
  const session = sessions.get(String(token || ''));
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(String(token || ''));
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session.username;
}
function requireAuth(ws) {
  const username = sockets.get(ws);
  if (!username) sendError(ws, 'AUTH_REQUIRED', 'Authentication required.');
  return username || null;
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
  send(ws, { type: 'hello', protocol: 2 });

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
      attach(ws, user.username);
      const sessionToken = newSession(user.username);
      return send(ws, { type: 'auth', success: true, sessionToken, username: user.username, user: pub(user), ...directory() });
    }

    if (msg.type === 'resumeSession') {
      const username = resumeSession(msg.sessionToken);
      if (!username) return send(ws, { type: 'session', success: false, message: 'Session expired or invalid.' });
      attach(ws, username);
      return send(ws, { type: 'session', success: true, username });
    }

    const username = requireAuth(ws);
    if (!username) return;

    if (msg.type === 'logout') {
      if (msg.sessionToken) sessions.delete(String(msg.sessionToken));
      detach(ws);
      return send(ws, { type: 'logout', success: true });
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
    if (msg.type === 'dmSend') {
      const to = normalizeUsername(msg.to);
      const text = cleanText(msg.text, 4000);
      if (!to || !text) return sendError(ws, 'BAD_DM', 'Recipient and message are required.');
      const recipient = users.find(item => item.username.toLowerCase() === to);
      if (!recipient) return sendError(ws, 'NO_USER', 'Recipient does not exist.');
      const dm = { from: username, to: recipient.username, text, timestamp: new Date().toISOString() };
      messages = trimStore([...messages, dm]);
      save('messages.json', messages);
      const payload = { type: 'message', ...dm };
      for (const name of new Set([username, recipient.username])) {
        const set = socketsByUser.get(name);
        if (set) for (const sock of set) send(sock, payload);
      }
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

  ws.on('close', () => detach(ws));
  ws.on('error', () => detach(ws));
});

const heartbeat = setInterval(() => {
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
