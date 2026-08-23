# Contributing to Ouiji InHouse

Ouiji is community-buildable open-source software under **GPL-3.0-or-later**. Contributions are welcome when they keep the application understandable, secure by default, and focused on team communication.

By submitting a contribution, you represent that you have the right to submit it and agree that your contribution is provided under GPL-3.0-or-later. You retain copyright in your contribution; no copyright assignment to Groundstate is required by this policy.

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

## Security invariants

Changes must not casually weaken renderer isolation, IPC validation, authentication, payload bounds, safe rendering, credential handling, or localhost-safe defaults. Security-sensitive changes should include regression coverage.

## Good contribution areas

Messaging UX, presence, rooms, notifications, accessibility, safe search, deployment reliability, tests, documentation, storage, and well-scoped security work are welcome.

## Pull requests

Keep PRs focused. Explain what changed, why, how it was tested, security/privacy implications, and include screenshots for meaningful UI changes when useful. Maintainers may request changes or decline work that conflicts with scope, safety, maintainability, or licensing.

## Forks and project identity

Forks are welcome under the GPL. Do not represent a fork as an official Groundstate/Ouiji release or imply endorsement without permission. The GPL covers source code; project names, logos, and branding are separate from the code license.
