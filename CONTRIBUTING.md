# Contributing to Ouiji Chat

Ouiji Chat is a Groundstate Technology LLC product developed in the open with community participation.

We welcome code, documentation, design, testing, accessibility work, deployment improvements and security research. The official product must remain legally and technically coherent, so accepted contributions are subject to the Groundstate contributor agreement.

## Contributor agreement

Before a contribution can be merged into the official repository, the contributor must agree to `CONTRIBUTOR_AGREEMENT.md`.

The agreement assigns copyright in the accepted contribution to Groundstate Technology LLC while preserving a broad license back to the contributor. This lets Groundstate maintain one coherent rights holder for the official product, enforce the license and branding consistently, operate the hosted service, support independent-server deployments, and offer additional licensing models in the future without chasing every past contributor for permission.

A pull request should include the statement:

`I have read and agree to CONTRIBUTOR_AGREEMENT.md for this contribution.`

Do not submit code you do not have the right to contribute.

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

## Product scope

Ouiji is a modern AIM-style instant messenger, not a social-media feed. Changes should reinforce direct communication, presence, buddy lists, rooms, reliable messaging and the ability to connect to either Groundstate-hosted or independently operated servers.

## Security invariants

Changes must not casually weaken renderer isolation, IPC validation, authentication, payload bounds, safe rendering, credential handling, or localhost-safe defaults. Security-sensitive changes should include regression coverage.

## Good contribution areas

Messaging UX, presence, buddy-list behavior, rooms, notifications, accessibility, safe search, deployment reliability, private-server administration, tests, documentation, storage and well-scoped security work are welcome.

## Pull requests

Keep PRs focused. Explain what changed, why, how it was tested, security/privacy implications, and include screenshots for meaningful UI changes when useful. Maintainers may request changes or decline work that conflicts with product scope, safety, maintainability, ownership policy or licensing.

## Forks and project identity

The repository's software license governs code reuse. It does not grant rights to the **Ouiji**, **Ouiji Chat**, or **Groundstate Technology** names, logos, official artwork, hosted-service identity, domains, signing keys or other brand identifiers.

Forks must use distinct branding unless Groundstate Technology LLC gives written permission. A fork may not present itself as the official Ouiji product, service or release.
