# Ouiji InHouse

![Ouiji InHouse / Groundstate](assets/ouiji-groundstate-logo.png)

**Ouiji InHouse v3.2 Alpha** is a compact, private-first desktop communications client for small teams. It keeps the fast buddy-list feel of classic instant messengers while adding departments, project rooms, presence, searchable people, popout conversations, and a deliberately small operational footprint.

Ouiji is the **communications layer**. Organization-wide identity, authority, HR records, and administrative policy belong outside the chat client so Ouiji can stay focused and understandable.

## What works now

- Compact Electron buddy list with people search
- Department-based directory and project rooms
- Separate direct-message and room windows
- Online/offline/busy/away/meeting presence
- Employee cards
- Automatic WebSocket reconnects
- Visible message timestamps
- Replaceable sent/received/sign-on/sign-off sounds
- Persistent local alpha message history
- Server-issued authenticated sessions for every window
- Scrypt password hashing with one-time migration from the older plaintext alpha format
- Server-side authorization for directory, profile, history, direct-message and room operations
- WebSocket payload limits, request/login rate limits, heartbeat cleanup, bounded history responses and bounded local message stores
- Electron sandboxing, context isolation, disabled Node integration, validated IPC, blocked renderer navigation and restrictive CSPs
- Localhost-only server binding by default
- Project doctor, syntax checks, regression tests and CI-ready verification command

## Requirements

- Node.js 22.12 or newer
- npm
- Windows, macOS or Linux capable of running Electron

## Quick start: local machine

```powershell
npm install
npm run verify
npm run server
```

Leave the server terminal open. In a second terminal:

```powershell
npm start
```

The safe default endpoint is:

```text
ws://localhost:8080/ws
```

The server listens only on `127.0.0.1` unless you explicitly opt into LAN access.

## Demo accounts

Fresh alpha data seeds several demonstration accounts. The initial demo password is `password` and is immediately stored as a salted scrypt hash rather than plaintext.

| Username | Department | Role |
|---|---|---|
| michael | Administration | Director |
| sarah | Administration | Coordinator |
| kevin | IT | Technician |
| lisa | Engineering | Engineer |
| steve | Operations | Operator |
| amanda | Research | Researcher |

**Do not treat the seeded password as a production credential.** The demo accounts exist so a cloned repository is immediately testable.

## Trusted LAN setup

Ouiji intentionally requires two explicit changes for LAN use.

First, start the server on all interfaces:

```powershell
$env:OUIJI_HOST="0.0.0.0"
npm run server
```

On Command Prompt:

```bat
set OUIJI_HOST=0.0.0.0
npm run server
```

Second, create an ignored `config.local.json` on each client:

```json
{
  "companyName": "Groundstate",
  "serverUrl": "ws://192.168.1.50:8080/ws"
}
```

Replace the example address with the server computer's trusted LAN IP. `config.local.json` is ignored by Git so machine-specific addresses do not become repository defaults.

For networks you do not fully trust, use a TLS-terminating reverse proxy and `wss://` rather than exposing plain WebSockets.

## Useful commands

```text
npm start        Launch the Electron client
npm run server   Launch the WebSocket server
npm run doctor   Check project structure and security invariants
npm run check    Parse-check JavaScript sources
npm test         Run regression tests
npm run verify   Run doctor + syntax checks + tests
```

## Sounds

Replace these files while keeping their names:

```text
sounds/send.wav
sounds/incoming.wav
sounds/online.wav
sounds/offline.wav
```

## Repository layout

```text
client/       Electron shell, buddy list, conversations and employee cards
server/       WebSocket server and security helpers
scripts/      Project diagnostics
tests/        Regression/security tests
sounds/       Replaceable application sounds
assets/       Branding
docs/         Architecture and deployment notes
config.json   Safe checked-in localhost configuration
```

Runtime account/message data is created under `server/data/` and is intentionally ignored by Git.

## Security model

Ouiji v3.2 is significantly hardened compared with the original v3.1 alpha, but it remains **pre-production software**. The application is designed to be safe to clone, inspect and experiment with; it is not yet a substitute for a professionally operated internet-facing secure messenger.

The current model includes authenticated per-window sessions, password hashing, server-side authorization, input bounds, rate limiting, sandboxed Electron renderers and safe localhost defaults. Remaining production work includes TLS/WSS deployment guidance, robust account provisioning/password rotation, durable database storage, audit policy, room membership/authorization, session revocation administration and formal security review.

See [`SECURITY.md`](SECURITY.md) before deployment.

## Roadmap

Near-term priorities:

- unread counts and notification controls
- delivery/read state
- room membership and permissions
- account/password management without editing JSON
- optional file/image sharing with strict type/size controls
- message search
- SQLite/PostgreSQL storage adapter
- TLS/WSS deployment recipe
- signed installers and release artifacts
- Groundstate Control Center identity integration

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), run `npm run verify`, and keep changes scoped. Security changes should include regression coverage.

## License status

No open-source license has been selected yet. Source visibility alone does not grant unrestricted rights to copy, redistribute, modify, sublicense or sell the project. See `LICENSE_STATUS.md`.

## Design principle

**Directory → Presence → Messages → Rooms → Files**

Fast enough to feel casual. Small enough to understand. Secure defaults before clever defaults.
