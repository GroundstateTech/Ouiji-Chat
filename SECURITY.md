# Security Policy

Ouiji InHouse v3.2 Alpha is a private-first internal communications project. The repository is intended to be safe to inspect and experiment with, but the project is still pre-production and should not yet be treated as a hardened public-internet messenger.

## Current protections

The v3.2 hardening pass includes:

- salted scrypt password hashes instead of plaintext credential storage;
- one-time migration of older v3.1 plaintext alpha credentials;
- cryptographically random server-issued session tokens;
- authenticated child windows through session resume rather than username trust;
- server-side authorization for directory, profile, conversation and send operations;
- WebSocket message-size limits and per-connection request/login rate limits;
- bounded message/history retention in the JSON alpha store;
- heartbeat termination for dead WebSocket connections;
- localhost-only server binding by default;
- Electron renderer sandboxing, context isolation and disabled Node integration;
- narrow/validated preload IPC methods;
- blocked renderer navigation and denied unmanaged popup creation;
- Content Security Policy on renderer pages;
- DOM/text-node rendering for messages and employee data instead of trusting server strings as HTML;
- automated security regression tests and project diagnostics.

## Important limitations

The checked-in demo accounts are intentionally easy to try. Fresh demo data uses the initial password `password`, although it is stored as a salted hash. Change/remove demo credentials before meaningful deployment.

The alpha JSON datastore is not designed for multi-server concurrency, tamper-evident audit history, enterprise retention policy, or large message volumes. TLS is also not terminated by the built-in development server.

Do **not** expose the built-in plain `ws://` server directly to the public internet. For use outside a fully trusted local machine/network, put Ouiji behind a properly configured TLS reverse proxy and use `wss://` while additional production controls are developed.

## Deployment boundary

By default the server binds to `127.0.0.1`. LAN exposure must be explicit via `OUIJI_HOST=0.0.0.0` (or another chosen interface). This is intentional.

Machine-specific client endpoints should go in ignored `config.local.json`, not committed `config.json`.

## Reporting a vulnerability

Please avoid publishing exploit details in a public issue before a fix is available. Contact the repository owner privately through an available GitHub contact channel with:

- affected version/commit;
- reproduction steps;
- impact;
- relevant logs or screenshots with secrets removed;
- suggested mitigation if known.

Do not include real passwords, session tokens, private message contents, or other people's personal information in reports.

## Before production use

Production readiness still requires, at minimum:

- first-class account provisioning, password change/reset and removal workflows;
- administrative session revocation;
- authorization-aware room membership;
- TLS/WSS reference deployment and certificate handling;
- durable database-backed storage and backups;
- explicit audit/retention/privacy policy;
- dependency and release-signing process;
- threat modeling and independent security review.
