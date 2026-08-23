# Ouiji InHouse

![Ouiji InHouse / Groundstate](assets/ouiji-groundstate-logo.png)

**Ouiji InHouse v3.1 Alpha** is a lightweight internal communications client for the Groundstate ecosystem. It keeps the compact feel of classic AIM-style desktop messaging while organizing coworkers by department and work by project room.

## Current Alpha

- Compact buddy-list desktop window
- Department-based employee directory
- Separate direct-message windows
- Department and project chat rooms
- Online/offline presence
- Minimal employee cards
- Replaceable sent/received/sign-on/sign-off sounds
- Configurable LAN server address
- Persistent local alpha message storage
- No social-network profile clutter
- No administrative controls inside Ouiji

Ouiji is intentionally the **communications layer**. Identity, permissions, organization structure, and administrative authority are separated into the Groundstate Control Center.

## Quick Start

```powershell
npm install
npm run server
```

Leave that terminal open. In a second terminal:

```powershell
npm start
```

Default endpoint:

```text
ws://localhost:8080/ws
```

## Demo Accounts

All demo accounts use password `password`.

| Username | Department | Role |
|---|---|---|
| michael | Administration | Director |
| sarah | Administration | Coordinator |
| kevin | IT | Technician |
| lisa | Engineering | Engineer |
| steve | Operations | Operator |
| amanda | Research | Researcher |

## Office / LAN Setup

Edit `config.json` on each client:

```json
{
  "companyName": "Groundstate",
  "serverUrl": "ws://192.168.1.50:8080/ws"
}
```

Replace the address with the server computer's LAN IP. Windows Firewall may need to allow Node.js/TCP port 8080.

## Sounds

Replace these while keeping the filenames:

```text
sounds/send.wav
sounds/incoming.wav
sounds/online.wav
sounds/offline.wav
```

## Repository Layout

```text
client/       Electron buddy list, chat windows, employee cards
server/       WebSocket server
sounds/       Replaceable application sounds
assets/       Branding
docs/         Architecture notes
config.json   Server connection configuration
```

## Security Status

This is an **alpha/demo build**. The simple demo credentials and local storage are for testing the communications workflow. It is not production-ready or intended for direct public-internet exposure. See `SECURITY.md`.

## Roadmap

- Groundstate Control Center identity integration
- Unread indicators
- Delivery/read state
- File and image sharing
- Search
- Room membership controls
- Production database storage
- TLS/WSS deployment
- Installers

## Design Principle

**Directory → Presence → Messages → Rooms → Files**

Administrative authority stays outside Ouiji so Groundstate applications can eventually share one identity system.
