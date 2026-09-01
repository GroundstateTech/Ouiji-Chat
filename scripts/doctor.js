#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok: Boolean(ok), detail }); }

const required = [
  'client/main.js', 'client/preload.js', 'client/index.html', 'client/index.js',
  'client/chat.html', 'client/chat.js', 'client/employee-card.html', 'client/employee-card.js',
  'server/server.js', 'server/security.js', 'server/admin.js', 'config.json', 'README.md', 'SECURITY.md'
];
for (const file of required) check(`required file: ${file}`, fs.existsSync(path.join(root, file)), file);

const nodeMajor = Number(process.versions.node.split('.')[0]);
check('Node.js >= 22', nodeMajor >= 22, process.version);
check('package is private', pkg.private === true, `private=${String(pkg.private)}`);
check('ws dependency declared', /^\^8\./.test(pkg.dependencies?.ws || ''), pkg.dependencies?.ws || 'missing');
check('supported Electron declared', /^\^(43|44)\./.test(pkg.devDependencies?.electron || ''), pkg.devDependencies?.electron || 'missing');
check('verify script declared', typeof pkg.scripts?.verify === 'string', pkg.scripts?.verify || 'missing');

try {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const lockRoot = lock.packages?.[''] || {};
  check('lockfile project matches package', lockRoot.name === pkg.name && lockRoot.version === pkg.version, `${lockRoot.name || 'missing'}@${lockRoot.version || 'missing'}`);
  check('lockfile ws range matches package', lockRoot.dependencies?.ws === pkg.dependencies?.ws, lockRoot.dependencies?.ws || 'missing');
  check('lockfile Electron range matches package', lockRoot.devDependencies?.electron === pkg.devDependencies?.electron, lockRoot.devDependencies?.electron || 'missing');
} catch (error) {
  check('package-lock parses', false, error.message);
}

const server = fs.readFileSync(path.join(root, 'server/server.js'), 'utf8');
check('server defaults to loopback', server.includes("OUIJI_HOST || '127.0.0.1'"), 'OUIJI_HOST fallback');
check('server enforces sessions', server.includes("msg.type === 'resumeSession'"), 'resumeSession');
check('server limits websocket payload', server.includes('maxPayload:'), 'maxPayload');
check('plaintext password migration exists', server.includes('passwordHash') && server.includes('delete user.password'), 'migration');
check('server has no seeded accounts', !server.includes('demoUsers()') && !server.includes('@groundstate.local'), 'empty local directory');
check('local admin bootstrap declared', pkg.scripts?.['create-admin'] === 'node server/admin.js', pkg.scripts?.['create-admin'] || 'missing');
const clientIndex = fs.readFileSync(path.join(root, 'client/index.js'), 'utf8');
check('client uses neutral organization default', clientIndex.includes("'Your Organization'") && !clientIndex.includes("|| 'Groundstate'"), 'organization branding');

const electron = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
check('Electron sandbox enabled', electron.includes('app.enableSandbox()') && electron.includes('sandbox: true'), 'sandbox');
check('context isolation enabled', electron.includes('contextIsolation: true'), 'contextIsolation');
check('Node integration disabled', electron.includes('nodeIntegration: false'), 'nodeIntegration');
check('navigation restrictions installed', electron.includes('setWindowOpenHandler') && electron.includes('will-navigate'), 'navigation');

for (const html of ['client/index.html', 'client/chat.html', 'client/employee-card.html']) {
  const text = fs.readFileSync(path.join(root, html), 'utf8');
  check(`${html} has CSP`, /Content-Security-Policy/i.test(text), 'CSP');
  check(`${html} blocks inline scripts`, !/<script(?![^>]*\bsrc=)[^>]*>/i.test(text), 'external scripts only');
}

console.log(`Ouiji Doctor — ${pkg.version}`);
console.log(`Platform: ${process.platform} ${process.arch}`);
console.log(`Node: ${process.version}\n`);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
const failed = checks.filter(item => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) {
  console.error('Doctor found project setup or security-invariant problems.');
  process.exitCode = 1;
} else {
  console.log('Project structure and baseline security invariants look healthy.');
}
