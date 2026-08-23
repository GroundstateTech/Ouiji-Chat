# Ouiji InHouse

![Ouiji InHouse / Groundstate](assets/ouiji-groundstate-logo.png)

**Ouiji InHouse v3.2 Alpha** is a compact, private-first desktop communications client for small teams. It keeps the fast buddy-list feel of classic instant messengers while adding departments, project rooms, presence, searchable people, popout conversations, and a deliberately small operational footprint.

Ouiji is the **communications layer**. Organization-wide identity, authority, HR records, and administrative policy belong outside the chat client so Ouiji can stay focused and understandable.

## Open-source philosophy

Ouiji is licensed under **GPL-3.0-or-later**. Use it, study it, modify it, fork it, and help improve it. The GPL is intentional: distributed covered modifications/derivatives must preserve the GPL's source-code freedoms rather than turning the shared code into a closed derivative.

Copyright is not surrendered by open-sourcing the project. Contributors retain copyright in their contributions unless separately agreed. The Groundstate/Ouiji names, logos, artwork, and official-project identity are separate from the source-code license; forks must not imply they are official Groundstate releases without permission.

See `LICENSE` and `CONTRIBUTING.md`.

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

The safe default endpoint is `ws://localhost:8080/ws`. The server listens only on `127.0.0.1` unless you explicitly opt into LAN access.

## Demo accounts

Fresh alpha data seeds demonstration accounts. The initial demo password is `password` and is immediately stored as a salted scrypt hash rather than plaintext. **Do not treat the seeded password as a production credential.**

## Trusted LAN setup

Ouiji intentionally requires explicit configuration for LAN use. Start the server with `OUIJI_HOST=0.0.0.0`, and create an ignored `config.local.json` on each client containing the trusted server's `ws://` URL. For networks you do not fully trust, use TLS termination and `wss://` rather than exposing plain WebSockets.

## Useful commands

```text
npm start        Launch the Electron client
npm run server   Launch the WebSocket server
npm run doctor   Check project structure and security invariants
npm run check    Parse-check JavaScript sources
npm test         Run regression tests
npm run verify   Run doctor + syntax checks + tests
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

Ouiji v3.2 is significantly hardened compared with the original v3.1 alpha, but it remains **pre-production software**. It is not yet a substitute for a professionally operated internet-facing secure messenger. See `SECURITY.md` before deployment.

## Roadmap

Near-term priorities include unread/notification controls, delivery/read state, room permissions, account/password management, safe file/image sharing, message search, durable database storage, TLS/WSS deployment, signed installers, and Groundstate Control Center identity integration.

## Contributing

Community pull requests are welcome. Start with `CONTRIBUTING.md`, run `npm run verify`, and keep changes scoped. Security changes should include regression coverage.

## Support

See `SUPPORT.md` for optional Patreon and PayPal support. Financial support does not purchase ownership, equity, IP rights, or special licensing rights.

## Design principle

**Directory → Presence → Messages → Rooms → Files**

Fast enough to feel casual. Small enough to understand. Secure defaults before clever defaults.
