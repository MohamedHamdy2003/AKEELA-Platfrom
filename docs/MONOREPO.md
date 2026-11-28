# Monorepo Guide

One Git repository contains the NestJS API, three React/Vite browser clients, shared brand assets and small portal components. The backend remains one modular monolith with one PostgreSQL database. See the [Restaurant run guide](../apps/restaurant/README.md).

```text
AKEELA/
  apps/
    api/                   # NestJS source, tests, package.json, Dockerfile, env examples
    restaurant/            # React/Vite client; restaurant.akeelaonline.tech
    admin/                 # implemented; admin.akeelaonline.tech
    delivery/              # implemented; delivery.akeelaonline.tech
  packages/
    brand/                 # shared brand tokens, forms/sidebar CSS, and assets
    portal/                # shared HTTP/session/realtime/dialog/portal helpers
  docs/                    # architecture, API, and frontend guides
  bruno/AKEELA/            # maintained API collection
  deploy/                  # Caddy and VPS/release scripts
  scripts/                 # repository checks, setup and smoke testing
  .github/workflows/       # CI and approved main releases
  package.json             # private npm workspace root and command shortcuts
  package-lock.json        # the only dependency lockfile
  compose.yml              # local PostgreSQL/Mailpit
  compose.production.yml   # production API/PostgreSQL/Caddy
  AGENTS.md
  AKEELA-*.md              # the four canonical API/data/flow specifications
```

## npm and local environments

- Run `npm ci` at the root. Workspaces: apps/api, apps/restaurant, apps/admin, apps/delivery, packages/brand and packages/portal.
- Keep each implemented app's dependencies in its own package.json, and shared repository tools at the root. Do not add nested Git repositories or app lockfiles.
- Existing root commands such as `npm run start:dev`, `npm run build`, `npm test`, `npm run migration:show` and `npm run smtp:check` forward to the API workspace. It runs with `apps/api` as its working directory.
- API local secrets and Gmail values are in `apps/api/.env`. `setup:local` creates it only if missing. The current checkout's existing private API environment was moved without printing/committing it. Other checkouts must move their private root `.env` manually if they have one; never overwrite an existing destination.
- API local image storage defaults to `apps/api/storage/images`; if an old checkout has root storage files, move them there or configure the original absolute IMAGE_STORAGE_PATH. Production volumes and `/app/storage/images` are unchanged.
- Production `.env.production.example` stays at the root because Compose configures several services. The actual server file remains `/opt/akeela/.env.production`. Frontend browser configuration must never include API signing, database or SMTP secrets.
- Bruno stays at `bruno/AKEELA`; its private `.env` is separate. Unit/build/test output moves under `apps/api`; relative TypeScript imports and migrations remain unchanged.

## Checks and releases

- `npm run check` runs `check:repo` (ESLint, Prettier, docs, Bruno, tool tests), `check:api` (typecheck, unit tests, NestJS build), and `check:restaurant`, `check:admin`, and `check:delivery`. Browser flows run via `npm run test:e2e --workspace @akeela/<app>`; `npm run test:integration` runs the real PostgreSQL/Mailpit suite.
- CI checks repository quality, audits runtime dependencies, tests affected workspaces, runs Playwright E2E, and verifies the Docker/Caddy production smoke stack.
- Consolidated `main` releases verify and publish all four GHCR images (`api`, `-admin`, `-restaurant`, `-delivery`) from one commit and deploy immutable digests when `DEPLOY_ENABLED=true`.
- Feature PRs target `dev`; pushing, merging, and `main` promotion follow the current owner's explicit instruction and [GITHUB-FLOW.md](GITHUB-FLOW.md).

## Docker and Caddy

- Build context is the repository root with per-app Dockerfiles (`apps/<app>/Dockerfile`). Production Compose runs prebuilt GHCR images and never builds on the VPS.
- Caddy (`deploy/Caddyfile`, `deploy/routes.caddy`, `deploy/frontend-routes.caddy`) serves `api`, `admin`, `restaurant`, and `delivery` under `akeelaonline.tech`, with same-origin `/api/*` and `/socket.io/*` proxies and public `/images/*`.
- `ADMIN_DOMAIN`, `VENDOR_DOMAIN` (value `restaurant.akeelaonline.tech`), and `DELIVERY_DOMAIN` are configured in `/opt/akeela/.env.production`; `CORS_ORIGINS` must list the exact three frontend HTTPS origins. See [DEPLOYMENT.md](DEPLOYMENT.md).

References: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/), [Docker build context](https://docs.docker.com/build/concepts/context/), [Caddy imports](https://caddyserver.com/docs/caddyfile/directives/import).
