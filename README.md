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

Current D1 binding uses the existing AuraDigital D1 database so existing admin sessions and AuraPops data are shared safely while the application code remains fully separate. AuraPops reuses the existing `__Host-aura_admin` session for `/aurapops/admin`; no second admin password is required.


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
