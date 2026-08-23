const params = new URLSearchParams(location.search);
const SERVER_URL = params.get('serverUrl') || 'ws://localhost:8080/ws';
const viewer = params.get('viewer') || '';
const kind = params.get('kind');
const buddy = params.get('buddy');
const room = params.get('room');
const sessionToken = params.get('sessionToken') || '';
const target = kind === 'dm' ? buddy : room;

let ws = null;
let messages = [];
let reconnectAttempt = 0;
let reconnectTimer = null;
let authenticated = false;

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('text');
const sendBtn = document.getElementById('sendBtn');
const stateEl = document.getElementById('state');

document.getElementById('title').textContent = target || 'Chat';
document.getElementById('subtitle').textContent = kind === 'dm' ? `Direct message · ${viewer}` : `Room · ${viewer}`;

function sound(id) {
  const audio = document.getElementById(id);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function setState(label, state = 'offline') {
  stateEl.textContent = label;
  stateEl.dataset.state = state;
  sendBtn.disabled = state !== 'online';
}

function send(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !authenticated) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function receiptFor(message) {
  if (kind !== 'dm' || message.from !== viewer) return '';
  if (message.readAt) return 'Read';
  if (message.deliveredAt) return 'Delivered';
  return 'Sent';
}

function render() {
  chatEl.replaceChildren(...messages.map(message => {
    const row = document.createElement('div');
    row.className = `msg ${message.from === viewer ? 'me' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = `${message.from === viewer ? 'Me' : message.from} · ${formatTime(message.timestamp)}`;
    const body = document.createElement('div');
    body.className = 'msg-body';
    body.textContent = message.text || '';
    row.append(meta, body);
    const receipt = receiptFor(message);
    if (receipt) {
      const receiptEl = document.createElement('div');
      receiptEl.className = `receipt ${receipt.toLowerCase()}`;
      receiptEl.textContent = receipt;
      row.append(receiptEl);
    }
    return row;
  }));
  chatEl.scrollTop = chatEl.scrollHeight;
}

function markConversationRead() {
  if (kind !== 'dm' || !authenticated || document.hidden) return;
  send({ type: 'markConversationRead', buddy });
}

function requestHistory() {
  if (kind === 'dm') send({ type: 'getConversation', buddy });
  else send({ type: 'joinRoom', room });
}

function updateMessage(messageId, patch) {
  const message = messages.find(item => item.id === messageId);
  if (!message) return false;
  Object.assign(message, patch);
  return true;
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const delay = Math.min(8000, 500 * (2 ** Math.min(reconnectAttempt++, 4)));
  setState(`Reconnecting ${Math.ceil(delay / 1000)}s`, 'connecting');
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  clearTimeout(reconnectTimer);
  authenticated = false;
  setState('Connecting…', 'connecting');
  try { ws = new WebSocket(SERVER_URL); } catch { scheduleReconnect(); return; }

  ws.onopen = () => ws.send(JSON.stringify({ type: 'resumeSession', sessionToken }));
  ws.onclose = scheduleReconnect;
  ws.onerror = () => setState('Connection error', 'offline');
  ws.onmessage = event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'session') {
      if (!data.success) {
        setState('Session expired', 'offline');
        inputEl.disabled = true;
        return;
      }
      authenticated = true;
      reconnectAttempt = 0;
      inputEl.disabled = false;
      setState('Connected', 'online');
      requestHistory();
      inputEl.focus();
      return;
    }
    if (data.type === 'conversationHistory' && kind === 'dm') {
      messages = Array.isArray(data.messages) ? data.messages : [];
      render();
      markConversationRead();
      return;
    }
    if (data.type === 'roomHistory' && kind === 'room' && data.room === room) {
      messages = Array.isArray(data.messages) ? data.messages : [];
      render();
      return;
    }
    if (data.type === 'message' && kind === 'dm') {
      if ((data.from === viewer && data.to === buddy) || (data.from === buddy && data.to === viewer)) {
        if (!messages.some(message => message.id && message.id === data.id)) messages.push(data);
        render();
        if (data.from !== viewer) {
          sound('snd-incoming');
          markConversationRead();
        }
      }
      return;
    }
    if (data.type === 'dmDelivery' && kind === 'dm') {
      if (updateMessage(data.messageId, { deliveredAt: data.deliveredAt })) render();
      return;
    }
    if (data.type === 'dmRead' && kind === 'dm' && data.reader === buddy) {
      let changed = false;
      for (const id of Array.isArray(data.messageIds) ? data.messageIds : []) {
        changed = updateMessage(id, { deliveredAt: data.readAt, readAt: data.readAt }) || changed;
      }
      if (changed) render();
      return;
    }
    if (data.type === 'roomMessage' && kind === 'room' && data.room === room) {
      messages.push(data);
      render();
      if (data.from !== viewer) sound('snd-incoming');
      return;
    }
    if (data.type === 'error') setState(data.message || 'Server error', 'offline');
  };
}

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  const ok = kind === 'dm'
    ? send({ type: 'dmSend', to: buddy, text })
    : send({ type: 'roomSend', room, text });
  if (!ok) return;
  inputEl.value = '';
  sound('snd-send');
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
window.addEventListener('focus', markConversationRead);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) markConversationRead();
});

connect();