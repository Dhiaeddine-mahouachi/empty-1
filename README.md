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

- `/` — AuraPops Studio
- `/p/:slug` — public activated AuraPop
- `/admin` — private activation dashboard
- `/api/*` — standalone AuraPops API

## Cloudflare

Worker name: `aurapops`

Current D1 binding uses the existing Cloudflare D1 database during the migration so data can be preserved. After the standalone deployment is verified, AuraPops can be moved to its own D1 database without changing the frontend API.

Required Worker secret:

```
AURAPOPS_ADMIN_PASSWORD
```

Recommended custom domain:

```
aurapops.auradigitalworks.com
```

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
npx wrangler secret put AURAPOPS_ADMIN_PASSWORD
npm run deploy
```
