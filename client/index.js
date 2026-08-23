const params = new URLSearchParams(location.search);
const SERVER_URL = params.get('serverUrl') || 'ws://localhost:8080/ws';
const COMPANY = params.get('companyName') || 'Groundstate';

let ws = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let currentUser = null;
let sessionToken = null;
let directory = { departments: [], users: [], projects: [] };
let menuTarget = null;
let query = '';
const unreadDM = new Map();
const unreadRooms = new Map();

const appEl = document.getElementById('app');
const menuEl = document.getElementById('menu');
const toastEl = document.getElementById('toast');
const connectionEl = document.getElementById('connectionState');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function sound(id) {
  const audio = document.getElementById(id);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function toast(message) {
  toastEl.textContent = String(message || '');
  toastEl.style.display = 'block';
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => { toastEl.style.display = 'none'; }, 2400);
}

function notify(title, body = '', context = {}) {
  window.ouijiAPI?.notify?.(title, body, context);
}

function setConnection(label, state = 'offline') {
  connectionEl.textContent = label;
  connectionEl.dataset.state = state;
}

function send(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const delay = Math.min(8000, 500 * (2 ** Math.min(reconnectAttempt++, 4)));
  setConnection(`Reconnecting in ${Math.ceil(delay / 1000)}s`, 'connecting');
  reconnectTimer = setTimeout(connect, delay);
}

function totalUnread() {
  return [...unreadDM.values(), ...unreadRooms.values()].reduce((sum, count) => sum + count, 0);
}

function bumpUnread(store, key) {
  store.set(key, (store.get(key) || 0) + 1);
}

async function conversationIsOpen(kind, target) {
  try {
    return !!(await window.ouijiAPI?.isConversationOpen?.(kind, currentUser, target));
  } catch {
    return false;
  }
}

function connect() {
  clearTimeout(reconnectTimer);
  setConnection('Connecting…', 'connecting');
  try { ws = new WebSocket(SERVER_URL); } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempt = 0;
    setConnection('Connected', 'online');
    if (sessionToken) send({ type: 'resumeSession', sessionToken });
  };
  ws.onclose = () => {
    setConnection('Disconnected', 'offline');
    if (currentUser && sessionToken) scheduleReconnect();
  };
  ws.onerror = () => setConnection('Connection error', 'offline');
  ws.onmessage = async event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }

    if (data.type === 'auth') {
      if (!data.success) return toast(data.message || 'Login failed');
      currentUser = data.username;
      sessionToken = data.sessionToken;
      unreadDM.clear();
      unreadRooms.clear();
      directory = { departments: data.departments || [], users: data.users || [], projects: data.projects || [] };
      render();
      toast(`Signed in as ${currentUser}`);
      return;
    }
    if (data.type === 'session') {
      if (!data.success) {
        currentUser = null;
        sessionToken = null;
        unreadDM.clear();
        unreadRooms.clear();
        renderLogin('Your session expired. Sign in again.');
        return;
      }
      send({ type: 'getDirectory' });
      return;
    }
    if (data.type === 'logout') {
      currentUser = null;
      sessionToken = null;
      unreadDM.clear();
      unreadRooms.clear();
      renderLogin();
      return;
    }
    if (data.type === 'directory') {
      directory = { departments: data.departments || [], users: data.users || [], projects: data.projects || [] };
      if (currentUser) render();
      return;
    }
    if (data.type === 'message' && currentUser && data.to === currentUser && data.from !== currentUser) {
      const open = await conversationIsOpen('dm', data.from);
      if (open) {
        unreadDM.delete(data.from);
        render();
        return;
      }
      bumpUnread(unreadDM, data.from);
      sound('snd-incoming');
      toast(`Message from ${data.from}`);
      notify(`Ouiji · ${data.from}`, data.text || 'New message', { kind: 'dm', viewer: currentUser, target: data.from });
      render();
      return;
    }
    if (data.type === 'roomMessage' && currentUser && data.from !== currentUser) {
      const open = await conversationIsOpen('room', data.room);
      if (open) {
        unreadRooms.delete(data.room);
        render();
        return;
      }
      bumpUnread(unreadRooms, data.room);
      sound('snd-incoming');
      toast(`New message in ${data.room}`);
      notify(`Ouiji · #${data.room}`, `${data.from}: ${data.text || ''}`, { kind: 'room', viewer: currentUser, target: data.room });
      render();
      return;
    }
    if (data.type === 'buddyOnline' && data.username !== currentUser) {
      sound('snd-online');
      toast(`${data.username} signed on`);
      notify('Ouiji Presence', `${data.username} signed on`);
      return;
    }
    if (data.type === 'buddyOffline' && data.username !== currentUser) {
      sound('snd-offline');
      toast(`${data.username} signed off`);
      return;
    }
    if (data.type === 'error') toast(data.message || data.code || 'Server error');
  };
}

function renderLogin(message = '') {
  document.title = 'Ouiji InHouse';
  appEl.innerHTML = `<div class="login">
    <div class="brand-row"><div><div class="title">Ouiji InHouse</div><div class="subtitle">${esc(COMPANY)} Internal Network</div></div><span class="sigil">◉</span></div>
    <div class="note">Private-first team messaging. Demo builds use seeded local accounts; change them before real deployment.</div>
    ${message ? `<div class="login-message">${esc(message)}</div>` : ''}
    <label>Username<input id="username" autocomplete="username" placeholder="Username"></label>
    <label>Password<input id="password" type="password" autocomplete="current-password" placeholder="Password"></label>
    <div class="login-actions"><button class="primary" id="loginBtn">Sign In</button></div>
  </div>`;
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('password').addEventListener('keydown', event => { if (event.key === 'Enter') login(); });
  document.getElementById('username').addEventListener('keydown', event => { if (event.key === 'Enter') document.getElementById('password').focus(); });
  document.getElementById('username').focus();
}

function filteredUsers() {
  if (!query) return directory.users;
  const q = query.toLowerCase();
  return directory.users.filter(user => [user.displayName, user.username, user.role, user.department, user.statusMessage]
    .some(value => String(value || '').toLowerCase().includes(q)));
}

function unreadBadge(count) {
  if (!count) return '';
  return `<span class="unread" aria-label="${count} unread">${count > 99 ? '99+' : count}</span>`;
}

function render() {
  if (!currentUser) return renderLogin();
  const users = filteredUsers();
  const usersByDept = {};
  for (const user of users) {
    if (user.username === currentUser) continue;
    (usersByDept[user.departmentId] ||= []).push(user);
  }

  const deptHtml = directory.departments.map(dept => {
    const people = (usersByDept[dept.id] || []).map(user => `<button class="person" data-user="${esc(user.username)}" title="Double-click to message">
      <span class="dot ${esc(user.status)}"></span><span class="name">${esc(user.displayName)}</span>${unreadBadge(unreadDM.get(user.username) || 0)}<span class="role">${esc(user.role)}</span>
    </button>`).join('');
    return `<section class="dept"><div class="dept-name">${esc(dept.name)}</div>${people || '<div class="empty">No matches</div>'}</section>`;
  }).join('');

  const rooms = [
    ...directory.departments.map(dept => ({ name: dept.name, type: 'Dept' })),
    ...directory.projects.map(project => ({ name: `${project.name}-General`, type: 'Project' }))
  ];
  const roomHtml = rooms.map(room => `<button class="room" data-room="${esc(room.name)}">
    <span class="room-icon">#</span><span class="name">${esc(room.name)}</span>${unreadBadge(unreadRooms.get(room.name) || 0)}<span class="role">${esc(room.type)}</span>
  </button>`).join('');
  const online = directory.users.filter(user => user.status !== 'Offline').length;
  const me = directory.users.find(user => user.username === currentUser);
  const unread = totalUnread();
  document.title = unread ? `(${unread}) Ouiji InHouse` : 'Ouiji InHouse';

  appEl.innerHTML = `<div class="window">
    <header class="header"><div><div class="title">Ouiji Chat${unread ? ` · ${unread} unread` : ''}</div><div class="subtitle">${esc(COMPANY)} · ${online} online</div></div><button class="small-btn" id="refreshBtn" title="Refresh directory">↻</button></header>
    <div class="search-wrap"><input id="search" value="${esc(query)}" placeholder="Find a person…" aria-label="Find a person"></div>
    <main class="body"><div class="section">People</div>${deptHtml}<div class="section">Rooms</div>${roomHtml}</main>
    <footer class="footer"><div><strong>${esc(me?.displayName || currentUser)}</strong><div class="presence-line">${esc(me?.status || 'Online')}${me?.statusMessage ? ` · ${esc(me.statusMessage)}` : ''}</div></div><span class="footer-actions"><button class="small-btn" id="statusBtn">Status</button><button class="small-btn" id="cardBtn">Card</button><button class="small-btn" id="logoutBtn">Sign out</button></span></footer>
  </div>`;

  document.getElementById('refreshBtn').addEventListener('click', refresh);
  document.getElementById('statusBtn').addEventListener('click', setStatus);
  document.getElementById('cardBtn').addEventListener('click', () => openCard(currentUser));
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('search').addEventListener('input', event => { query = event.target.value; render(); document.getElementById('search')?.focus(); });
  document.querySelectorAll('.person').forEach(el => {
    const username = el.dataset.user;
    el.addEventListener('dblclick', () => openDM(username));
    el.addEventListener('contextmenu', event => openMenu(event, username));
  });
  document.querySelectorAll('.room').forEach(el => el.addEventListener('dblclick', () => openRoom(el.dataset.room)));
}

function login() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return toast('Not connected to the server yet.');
  const username = document.getElementById('username')?.value || '';
  const password = document.getElementById('password')?.value || '';
  send({ type: 'login', username, password });
}
function logout() {
  send({ type: 'logout', sessionToken });
  currentUser = null;
  sessionToken = null;
  unreadDM.clear();
  unreadRooms.clear();
  renderLogin();
}
function refresh() { send({ type: 'getDirectory' }); }
function openDM(username) {
  unreadDM.delete(username);
  render();
  window.ouijiAPI.openDM(currentUser, username, sessionToken);
}
function openRoom(room) {
  unreadRooms.delete(room);
  render();
  window.ouijiAPI.openRoom(currentUser, room, sessionToken);
}
function openCard(username) { window.ouijiAPI.openCard(currentUser, username, sessionToken); }
function setStatus() {
  const status = prompt('Status: Online, Busy, Meeting, Away', 'Online');
  if (!status) return;
  const normalized = ['Online', 'Busy', 'Meeting', 'Away'].find(item => item.toLowerCase() === status.trim().toLowerCase());
  if (!normalized) return toast('Use Online, Busy, Meeting, or Away.');
  const statusMessage = prompt('Status message', '') || '';
  send({ type: 'setStatus', status: normalized, statusMessage });
}
function openMenu(event, username) {
  event.preventDefault();
  menuTarget = username;
  menuEl.innerHTML = '<button id="menuMessage">Message</button><button id="menuCard">Employee Card</button>';
  menuEl.style.left = `${Math.min(event.clientX, innerWidth - 170)}px`;
  menuEl.style.top = `${Math.min(event.clientY, innerHeight - 90)}px`;
  menuEl.style.display = 'block';
  document.getElementById('menuMessage').addEventListener('click', () => { openDM(menuTarget); closeMenu(); });
  document.getElementById('menuCard').addEventListener('click', () => { openCard(menuTarget); closeMenu(); });
}
function closeMenu() { menuEl.style.display = 'none'; }

document.addEventListener('click', event => { if (!menuEl.contains(event.target)) closeMenu(); });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu();
  if (event.ctrlKey && event.key.toLowerCase() === 'f' && currentUser) {
    event.preventDefault();
    document.getElementById('search')?.focus();
  }
});

connect();
renderLogin();