# AuraPops

Status: standalone codebase.

Standalone AuraPops application.

This repository is intentionally independent from AuraDigital. It contains its own:

- Cloudflare Worker API
- static builder frontend
- public popup viewer
- Snake and Tetris mini games
- admin/payment activation dashboard
- D1 schema
- security headers and owner-token workflow

## Routes

- `/aurapops` — AuraPops Studio
- `/pops/:slug` — public activated AuraPop
- `/aurapops/admin` — private activation dashboard
- `/api/aurapops/*` — standalone AuraPops API

## Cloudflare

Worker name: `aurapops`

Current D1 binding uses the existing AuraDigital D1 database so AuraPops data remains compatible while the application code stays fully separate. The AuraPops dashboard now supports its own HttpOnly password session, while an existing AuraDigital admin session is still accepted as a fallback.


Run locally:

```bash
npm install
npx wrangler dev
```

Validate:

```bash
npm run check
npm run deploy:check
```

Deploy:

```bash
npm run deploy
```
