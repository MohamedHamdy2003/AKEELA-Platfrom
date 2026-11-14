# Monorepo Guide

One Git repository contains the NestJS API, the React/Vite Restaurant client, shared brand assets and reserved folders for Admin/Delivery. The backend remains one modular monolith with one PostgreSQL database. See the [Restaurant run guide](../apps/restaurant/README.md).

```text
AKEELA/
  apps/
    api/                   # NestJS source, tests, package.json, Dockerfile, env examples
    restaurant/            # React/Vite client; vendor.akeela.com
    admin/                 # reserved; admin.akeela.com
    delivery/              # reserved; delivery.akeela.com
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

- Run `npm ci` at the root. The implemented workspaces are `apps/api`, `apps/restaurant` and `packages/brand`; Admin/Delivery are reserved.
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
- Restaurant has an independent check/browser/build/publication workflow and static Docker image. Admin/Delivery must add their own workspaces, checks and packaging when implemented. A README-only folder is not deployable.
- Feature PRs target dev; pushing, merging and main promotion follow the current owner's explicit instruction and GitHub flow.

## Docker and Caddy

- Build context is the repository root; API Dockerfile is `apps/api/Dockerfile`. Docker copies only the API/manifests and installs production workspace dependencies for runtime. It never copies private environment files or future frontend code.
- Production Compose runs prebuilt images and never builds on the VPS. API, database, image and Caddy volume identities remain stable across this move.
- Caddy serves the API and public images. It imports `deploy/sites-enabled/*.caddy`; initially no frontend sites are enabled, so it does not request certificates for unfinished apps.
- `deploy/templates/frontends.caddy` reserves the three domain configurations with explicit 503 responses only. It is validated but not imported or deployed as a frontend. Once an application and DNS are ready, enable only its tested site; replace its response with a static-file or reverse-proxy configuration appropriate to the chosen framework.
- ADMIN_DOMAIN, VENDOR_DOMAIN and DELIVERY_DOMAIN are configurable. API CORS uses the exact three origins from `.env.production.example`; change the allowlist with the real origins. Domain variables alone do not configure DNS or change CORS.
- Restaurant builds static assets in apps/restaurant/dist and its Docker image serves port 8080. It is not enabled in production Compose/Caddy. Actual Hostinger provisioning, public TLS and frontend deployment remain pending; backups remain deferred.

References: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/), [Docker build context](https://docs.docker.com/build/concepts/context/), [Caddy imports](https://caddyserver.com/docs/caddyfile/directives/import).
