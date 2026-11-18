# Monorepo Guide

One Git repository contains the NestJS API, three React/Vite browser clients, shared brand assets and small portal components. The backend remains one modular monolith with one PostgreSQL database. See the [Restaurant run guide](../apps/restaurant/README.md).

```text
AKEELA/
  apps/
    api/                   # NestJS source, tests, package.json, Dockerfile, env examples
    restaurant/            # React/Vite client; restaurant.akeelaonline.tech
    admin/                 # implemented; admin.akeelaonline.tech
    delivery/              # implemented; delivery.akeelaonline.tech
  packages/brand/          # shared brand tokens and assets
  docs/                    # architecture and frontend design guides
  bruno/AKEELA/            # existing API collection
  deploy/                  # Caddy, server/release scripts and templates
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

- `npm run check` runs repository lint/format/docs/Bruno/tool tests, API typecheck/unit/build and Restaurant lint/types/unit/build. Restaurant browser flows run with `npm run test:e2e --workspace @akeela/restaurant`. `npm run test:integration` runs the real PostgreSQL/Mailpit suite.
- CI always checks repository quality and audits production dependencies. API integration and Docker smoke run when `apps/api`, shared manifests/tooling, deployment files or unclassified paths change. Frontend/docs-only changes skip that API build path. Missing Git history runs the API checks conservatively.
- Main releases publish/deploy the API only when that path is affected. Image package naming remains compatible with existing GHCR releases. Deployment still needs explicit server configuration and DEPLOY_ENABLED.
- The consolidated CI/release workflows verify all three frontend workspaces and publish four images from one commit. Each app has its own check, browser tests and static Docker image.
- Feature PRs target dev; pushing, merging and main promotion follow the current owner's explicit instruction and GitHub flow.

## Docker and Caddy

- Build context is the repository root; API Dockerfile is `apps/api/Dockerfile`. Docker copies only the API/manifests and installs production workspace dependencies for runtime. It never copies private environment files or future frontend code.
- Production Compose runs prebuilt images and never builds on the VPS. API, database, image and Caddy volume identities remain stable across this move.
- Caddy explicitly serves API/admin/vendor/delivery hostnames, with same-origin HTTP/socket proxies and public images. The old sites-enabled/templates files are not imported; see DEPLOYMENT.md.
- `deploy/templates/frontends.caddy` reserves the three domain configurations with explicit 503 responses only. It is validated but not imported or deployed as a frontend. Once an application and DNS are ready, enable only its tested site; replace its response with a static-file or reverse-proxy configuration appropriate to the chosen framework.
- ADMIN_DOMAIN, VENDOR_DOMAIN and DELIVERY_DOMAIN are configurable. API CORS uses the exact three origins from `.env.production.example`; change the allowlist with the real origins. Domain variables alone do not configure DNS or change CORS.
- Restaurant builds static assets in apps/restaurant/dist and its Docker image serves port 8080. It is not enabled in production Compose/Caddy. Actual Hostinger provisioning, public TLS and frontend deployment remain pending; backups remain deferred.

References: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/), [Docker build context](https://docs.docker.com/build/concepts/context/), [Caddy imports](https://caddyserver.com/docs/caddyfile/directives/import).

## Dashboards, realtime and deployment — 2026-11-18

Admin and Delivery are implemented React/Vite/TypeScript workspaces, Arabic RTL and tab-scoped sessionStorage sessions. Their visual identities differ; shared HTTP/layout/order components live in packages/portal for these two consumers. Restaurant shares the realtime, session-storage, bootstrap and logout-confirmation helpers while keeping its own HTTP client and remaining UI. Root check and consolidated CI cover all workspaces.

Socket.IO runs inside the single API process. Events invalidate authorized REST reads after order commits; no schema, microservice, Redis or durable event log is added. See [REALTIME](REALTIME.md) and [portal design](PORTAL-DESIGN.md).

The owner purchased Hostinger KVM 2 at 2.25.12.243, France. SSH confirmed Ubuntu 26.04.1 LTS. Domain: akeelaonline.tech; API/admin/vendor/delivery subdomains. Production Compose includes all services plus one-off migrations and idempotent Admin initialization. Existing Admin values are never reset. See [DEPLOYMENT](DEPLOYMENT.md).
