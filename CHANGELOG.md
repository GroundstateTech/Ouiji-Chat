# Changelog

All notable Ouiji changes should be recorded here. Ouiji is pre-1.0/alpha software, so interfaces may change between releases.

## [Unreleased]

### Delivery/read-state pass

#### Direct messages

- Added persistent message IDs to direct messages.
- Added `Sent`, `Delivered`, and `Read` state beneath outgoing direct messages.
- Messages sent to offline users transition to `Delivered` when that user reconnects.
- Opening/focusing a direct-message window marks unread incoming messages as read server-side and updates the sender's open chat window.
- Older alpha DM records are migrated in place with IDs and receipt fields when the server starts.

#### Notifications

- Electron now tracks open DM and room windows and reuses/focuses an existing conversation instead of opening duplicates.
- Buddy-list unread badges, receive sounds, and native desktop notifications are suppressed when the exact DM or room is already open.
- Notification context is validated through the sandboxed preload bridge before reaching Electron's main process.

### Messaging UX pass

#### Notifications

- Added unread counters for direct-message contacts and rooms in the buddy-list window.
- Added total unread count to the Ouiji window title/header.
- Opening a DM or room now clears its unread counter.
- Added incoming-message sound handling to the main buddy-list window so messages are noticeable even when their chat window is closed.
- Added native desktop notifications for incoming DMs, room messages, and buddy sign-ons.
- Native notification payloads are length-limited and sanitized across the Electron preload bridge.

#### Presence

- Preserved the existing sign-on/sign-off sounds while making sign-on events visible as desktop notifications.
- Presence events continue to distinguish a user's first active socket and final disconnected socket, preventing extra pop-out windows from creating false sign-on/off events.

### v3.2 public-hardening cycle

#### Security

- Replaced username-trust child-window registration with server-issued session tokens.
- Added salted scrypt password hashing and migration from older plaintext alpha credentials.
- Added authenticated server-side authorization for directory, profile, history, direct-message and room operations.
- Added WebSocket payload limits, request/login rate limits and dead-connection heartbeat cleanup.
- Added bounded message persistence and bounded history responses.
- Changed server default binding to `127.0.0.1`; LAN binding is now explicit.
- Enabled Electron application-wide renderer sandboxing.
- Kept context isolation enabled and Node integration disabled.
- Added narrow/validated IPC payloads and navigation/popup restrictions.
- Added renderer Content Security Policy.
- Removed inline renderer scripts from the primary screens.
- Changed chat/profile rendering to safe DOM text operations.
- Added `.gitignore` coverage for runtime data, local config, environment files and build output.

#### Usability

- Added automatic reconnect behavior.
- Added connection-state indicators.
- Added searchable employee directory.
- Added message timestamps and clearer message bubbles.
- Added visible online count and cleaner presence/status display.
- Added explicit sign-out control.
- Made the buddy-list window resizable with sensible minimum dimensions.

#### Developer experience

- Upgraded to current Electron 43 and `ws` 8.21.
- Added `@electron/packager` for Windows x64 test builds.
- Added reproducible `package-lock.json`.
- Added project doctor, syntax checks, security regression tests and `npm run verify`.
- Added Windows/Linux CI and Windows package-artifact workflow.
- Expanded README, security, contribution, architecture and deployment documentation.

## [3.1.0-alpha]

Initial canonical GitHub import of the Ouiji InHouse alpha: buddy list, departments, direct-message windows, project/department rooms, presence, employee cards, replaceable sounds and JSON-backed local demo persistence.
