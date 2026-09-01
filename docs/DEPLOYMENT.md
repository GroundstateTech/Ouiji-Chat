# Deployment Guide

Ouiji v3.2 is designed to be safe-by-default for local development and deliberate about network exposure.

## Local development

```powershell
npm ci
npm run verify
npm run create-admin -- admin "choose-a-password-with-12+-characters"
npm run server
```

Then, in a second terminal:

```powershell
npm start
```

The first command creates a local administrator in the server's own data directory. Fresh installations contain no demo users or shared passwords. The server binds to `127.0.0.1:8080` by default; no LAN or internet exposure is required for normal development.

## Trusted LAN

Use LAN mode only on a network you control.

On PowerShell:

```powershell
$env:OUIJI_HOST="0.0.0.0"
npm run server
```

On Command Prompt:

```bat
set OUIJI_HOST=0.0.0.0
npm run server
```

Create `config.local.json` on each client:

```json
{
  "companyName": "Example Team",
  "serverUrl": "ws://192.168.1.50:8080/ws"
}
```

`config.local.json` is intentionally ignored by Git.

## Firewall

Only allow inbound TCP 8080 from the trusted network segment that needs Ouiji. Do not create a broad public firewall rule for the built-in development server.

## Internet / remote access

The built-in server does not terminate TLS. Do not port-forward it directly to the internet.

A remote deployment should instead place the WebSocket server behind a TLS-capable reverse proxy, expose `wss://`, restrict network access, and add the remaining production controls documented in `SECURITY.md`.

## Runtime data

The alpha server creates data under:

```text
server/data/
```

That directory contains password hashes and message history. Back it up only if you intentionally want to preserve alpha data, protect backups as sensitive data, and never commit it to Git.

## Upgrades

Before upgrading:

1. stop the server;
2. back up `server/data/` if needed;
3. update the repository;
4. run `npm ci`;
5. run `npm run verify`;
6. restart the server and client.

The v3.2 server automatically migrates older v3.1 plaintext password fields to salted scrypt hashes when it first loads an existing alpha `users.json`.

## Production checklist

Before treating Ouiji as production communications infrastructure, complete the items in `SECURITY.md`, especially account management, room authorization, WSS/TLS, database-backed persistence, audit/retention policy and independent security review.
