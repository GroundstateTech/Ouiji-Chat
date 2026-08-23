# Ouiji v3.1 Alpha

Working internal communications build.

## Features
- AIM-style buddy list window
- Separate pop-out DM windows
- Separate room chat windows
- Employee card windows
- Department directory
- Project rooms
- Online/offline presence
- Local JSON storage
- Four replaceable sounds

## Install
```powershell
npm install
```

## Run
Terminal 1:
```powershell
npm run server
```

Terminal 2:
```powershell
npm start
```

## Test Accounts
All passwords are `password`.

- michael
- sarah
- kevin
- lisa
- steve
- amanda

## LAN Setup
Edit `config.json` on each client:

```json
{
  "companyName": "Groundstate",
  "serverUrl": "ws://192.168.1.50:8080/ws"
}
```

Replace `192.168.1.50` with the server machine IP.

## Sounds
Replace these files:
- `sounds/send.wav`
- `sounds/incoming.wav`
- `sounds/online.wav`
- `sounds/offline.wav`

## Reset Data
Stop the server and delete files in:
`server/data/`
