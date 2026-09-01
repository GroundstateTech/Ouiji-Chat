#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { normalizeUsername, cleanText, hashPassword } = require('./security');

const DATA = path.join(__dirname, 'data');
const USERS = path.join(DATA, 'users.json');
const [rawUsername, rawPassword, rawDisplayName] = process.argv.slice(2);
const username = normalizeUsername(rawUsername);
const password = String(rawPassword || '');
const displayName = cleanText(rawDisplayName || rawUsername, 80);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!username) fail('Usage: npm run create-admin -- <username> <password> [display name]');
if (password.length < 12) fail('Administrator password must contain at least 12 characters.');
if (!displayName) fail('Display name is required.');

fs.mkdirSync(DATA, { recursive: true });
let users = [];
try {
  users = fs.existsSync(USERS) ? JSON.parse(fs.readFileSync(USERS, 'utf8')) : [];
  if (!Array.isArray(users)) fail('users.json does not contain a valid account list.');
} catch (error) {
  fail(`Could not read users.json: ${error.message}`);
}
if (users.some(user => normalizeUsername(user.username) === username)) {
  fail(`Account already exists: ${username}`);
}

users.push({
  username,
  passwordHash: hashPassword(password),
  displayName,
  departmentId: 'general',
  role: 'Administrator',
  email: '',
  extension: '',
  location: '',
  status: 'Offline',
  statusMessage: ''
});

const temporary = `${USERS}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(users, null, 2), { encoding: 'utf8', mode: 0o600 });
fs.renameSync(temporary, USERS);
console.log(`Created local Ouiji administrator: ${username}`);
