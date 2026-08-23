const crypto = require('crypto');

const USER_RE = /^[a-z0-9._-]{1,32}$/i;
const ROOM_RE = /^[a-z0-9 ._:-]{1,80}$/i;

function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  return USER_RE.test(username) ? username : '';
}

function normalizeRoom(value) {
  const room = String(value || '').trim();
  return ROOM_RE.test(room) ? room : '';
}

function cleanText(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, expectedHex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function safePublicUser(user, departmentName = '') {
  return {
    username: user.username,
    displayName: cleanText(user.displayName, 80),
    departmentId: cleanText(user.departmentId, 40),
    department: cleanText(departmentName, 80),
    role: cleanText(user.role, 80),
    email: cleanText(user.email, 160),
    extension: cleanText(user.extension, 30),
    location: cleanText(user.location, 80),
    status: cleanText(user.status || 'Offline', 20),
    statusMessage: cleanText(user.statusMessage, 160)
  };
}

module.exports = {
  normalizeUsername,
  normalizeRoom,
  cleanText,
  hashPassword,
  verifyPassword,
  newSessionToken,
  safePublicUser
};
