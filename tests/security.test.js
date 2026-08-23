const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const security = require('../server/security');

const root = path.resolve(__dirname, '..');

test('password hashes verify without storing plaintext', () => {
  const hash = security.hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes('correct horse battery staple'), false);
  assert.equal(security.verifyPassword('correct horse battery staple', hash), true);
  assert.equal(security.verifyPassword('wrong password', hash), false);
});

test('identifiers and messages are bounded', () => {
  assert.equal(security.normalizeUsername(' Alice '), 'alice');
  assert.equal(security.normalizeUsername('../alice'), '');
  assert.equal(security.normalizeRoom('Engineering'), 'Engineering');
  assert.equal(security.normalizeRoom('<script>'), '');
  assert.equal(security.cleanText('  hello\u0000  ', 20), 'hello');
  assert.equal(security.cleanText('x'.repeat(5000), 4000).length, 4000);
});

test('session tokens have strong entropy and URL-safe encoding', () => {
  const a = security.newSessionToken();
  const b = security.newSessionToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 40);
});

test('server removes username-trust auth and revokes whole sessions', () => {
  const server = fs.readFileSync(path.join(root, 'server/server.js'), 'utf8');
  assert.doesNotMatch(server, /registerClient/);
  assert.match(server, /resumeSession/);
  assert.match(server, /requireAuth/);
  assert.match(server, /sessionSockets/);
  assert.match(server, /revokeSession/);
  assert.match(server, /socketSessions/);
});

test('server keeps safe network and resource defaults', () => {
  const server = fs.readFileSync(path.join(root, 'server/server.js'), 'utf8');
  assert.match(server, /OUIJI_HOST \|\| '127\.0\.0\.1'/);
  assert.match(server, /maxPayload:\s*64 \* 1024/);
  assert.match(server, /MAX_EVENTS_PER_MINUTE/);
  assert.match(server, /MAX_STORED_MESSAGES/);
});

test('Electron windows keep security invariants', () => {
  const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /\['ws:', 'wss:'\]/);
});

test('renderer pages use CSP and external scripts', () => {
  for (const name of ['index.html', 'chat.html', 'employee-card.html']) {
    const html = fs.readFileSync(path.join(root, 'client', name), 'utf8');
    assert.match(html, /Content-Security-Policy/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  }
});
