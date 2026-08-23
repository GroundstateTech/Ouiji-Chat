const params = new URLSearchParams(location.search);
const SERVER_URL = params.get('serverUrl') || 'ws://localhost:8080/ws';
const target = params.get('target') || '';
const sessionToken = params.get('sessionToken') || '';

const cardEl = document.getElementById('card');
const stateEl = document.getElementById('state');
let ws = null;

function setState(text, state = 'offline') {
  stateEl.textContent = text;
  stateEl.dataset.state = state;
}

function render(user) {
  cardEl.replaceChildren();
  if (!user) {
    cardEl.textContent = 'Employee not found.';
    return;
  }

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = user.displayName ? user.displayName[0].toUpperCase() : '?';
  cardEl.appendChild(avatar);

  const fields = [
    ['Name', user.displayName],
    ['Department', user.department],
    ['Role', user.role],
    ['Email', user.email],
    ['Extension', user.extension],
    ['Location', user.location]
  ];
  for (const [label, value] of fields) {
    const row = document.createElement('div');
    row.className = 'row';
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    row.append(strong, document.createTextNode(String(value || '—')));
    cardEl.appendChild(row);
  }

  const status = document.createElement('div');
  status.className = 'status';
  const badge = document.createElement('strong');
  badge.textContent = user.status || 'Offline';
  const message = document.createElement('div');
  message.textContent = user.statusMessage || 'No status message';
  status.append(badge, message);
  cardEl.appendChild(status);
}

function connect() {
  setState('Connecting…', 'connecting');
  ws = new WebSocket(SERVER_URL);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'resumeSession', sessionToken }));
  ws.onclose = () => setState('Disconnected', 'offline');
  ws.onerror = () => setState('Connection error', 'offline');
  ws.onmessage = event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'session') {
      if (!data.success) return setState('Session expired', 'offline');
      setState('Connected', 'online');
      ws.send(JSON.stringify({ type: 'getEmployeeCard', username: target }));
      return;
    }
    if (data.type === 'employeeCard') render(data.user);
    if (data.type === 'error') setState(data.message || 'Server error', 'offline');
  };
}

connect();
