# Contributing to Ouiji InHouse

Ouiji is a pre-1.0 communications project. Contributions are welcome when they keep the application small, understandable, secure by default and focused on team communication.

## Development setup

```powershell
npm install
npm run verify
npm run server
```

In a second terminal:

```powershell
npm start
```

The default server is loopback-only at `ws://localhost:8080/ws`.

## Before opening a pull request

Run:

```powershell
npm run verify
```

A change should not weaken these invariants:

- no renderer Node integration;
- context isolation and renderer sandboxing remain enabled;
- no arbitrary IPC surface exposed through preload;
- no authentication based only on a claimed username;
- no unbounded WebSocket payloads/messages;
- no user/server-provided strings inserted as trusted HTML;
- no credentials, runtime message history, `.env` data or `config.local.json` committed;
- localhost remains the default server bind unless a deployment change explicitly justifies otherwise.

Security changes should add or update regression tests.

## Scope

Good Ouiji contributions include messaging UX, presence, rooms, notifications, accessibility, safe search, deployment reliability, tests, documentation and well-scoped security work.

Organization-wide identity, employee authority, payroll/HR data and central permissions belong in the separate Groundstate Control Center rather than being reimplemented inside the chat client.

## Pull request style

Keep PRs focused. Explain:

1. what changed;
2. why it changed;
3. how it was tested;
4. any security/privacy implications;
5. screenshots for meaningful UI changes when useful.

## Licensing note

No open-source license has been selected yet. Do not assume that contribution automatically changes the repository's copyright or licensing posture. Substantial external-code contributions should wait until explicit contributor/licensing terms are adopted.
