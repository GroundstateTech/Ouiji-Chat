# Ouiji Architecture

Ouiji InHouse is deliberately the communications client, not the organization authority. It handles directory display, presence, direct messages, rooms and lightweight employee cards. Organization-wide roles, HR data and administrative authority belong outside Ouiji.

## Process model

Ouiji has two independently runnable pieces:

1. **WebSocket server** — `server/server.js` owns authentication, presence, directory data, message persistence and authorization.
2. **Electron client** — `client/main.js` creates sandboxed renderer windows. Renderers communicate with the server through the browser WebSocket API and use a narrow preload bridge only to request approved popout windows.

The server is authoritative. A renderer-supplied username is never sufficient proof of identity.

## Authentication flow

1. The main buddy-list window sends `login` with username/password.
2. The server verifies a salted scrypt password hash.
3. The server attaches that socket to the authenticated username and returns a cryptographically random session token.
4. The main Electron process passes the token only to approved child windows it creates locally.
5. Chat/profile windows open their own WebSocket and send `resumeSession`.
6. Only after successful session resume may the child request history, profiles or send messages.

Sessions currently expire after 12 hours and are memory-resident, so a server restart invalidates them.

## Trust boundaries

### Main process

Trusted Node/Electron process. It may create windows and read local client configuration. Renderer IPC requests are validated before use.

### Preload bridge

Small capability surface. It exposes only approved direct-message, room and employee-card window requests and validates their parameters.

### Renderers

Sandboxed and context-isolated. Node integration is disabled. Pages use CSP, and server/user strings should be rendered as text rather than trusted HTML.

### WebSocket server

Owns identity and authorization. It validates message types, bounds strings, rate-limits connections, limits WebSocket payload size and does not accept a claimed username as authentication.

### Runtime data

`server/data/` contains generated password hashes, presence state and message history. It is ignored by Git. The JSON store is an alpha implementation, not the final storage architecture.

## Message model

Direct messages are delivered only to sockets belonging to sender and recipient. Room messages are broadcast in the current alpha while clients display only their selected room. Proper room membership/authorization is a planned production feature.

History responses are bounded, and local JSON stores are capped to avoid unlimited growth.

## Safe defaults

- server bind: `127.0.0.1`;
- client endpoint: `ws://localhost:8080/ws`;
- LAN binding requires explicit `OUIJI_HOST` configuration;
- machine-specific endpoints belong in ignored `config.local.json`;
- Electron sandbox and context isolation remain enabled;
- unmanaged navigation/popups are denied;
- renderer pages use CSP and external JavaScript files.

## Future architecture

Planned structural improvements include:

- SQLite/PostgreSQL storage adapter;
- account provisioning and password rotation;
- room membership/authorization;
- delivery/read receipts;
- TLS/WSS reference deployment;
- optional Groundstate Control Center identity integration;
- attachment service isolated from message transport with strict quotas and validation.
