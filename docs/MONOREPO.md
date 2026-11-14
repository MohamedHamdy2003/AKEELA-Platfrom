# Monorepo Guide

One Git repository contains the API and reserved locations for three frontends. The backend remains one NestJS modular monolith with one PostgreSQL database. This is a source-layout change, not new business logic or microservices.

```text
AKEELA/
  apps/
    api/                   # NestJS source, tests, package.json, Dockerfile, env examples
    restaurant/            # reserved; vendor.akeela.com
    admin/                 # reserved; admin.akeela.com
    delivery/              # reserved; delivery.akeela.com
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

- Run `npm ci` at the root. Only `apps/api` is an implemented npm workspace. The frontend folders contain README files, no scaffold/dependencies.
- Keep each implemented app's dependencies in its own package.json, and shared repository tools at the root. Do not add nested Git repositories or app lockfiles.
- Existing root commands such as `npm run start:dev`, `npm run build`, `npm test`, `npm run migration:show` and `npm run smtp:check` forward to the API workspace. It runs with `apps/api` as its working directory.
- API local secrets and Gmail values are in `apps/api/.env`. `setup:local` creates it only if missing. The current checkout's existing private API environment was moved without printing/committing it. Other checkouts must move their private root `.env` manually if they have one; never overwrite an existing destination.
- API local image storage defaults to `apps/api/storage/images`; if an old checkout has root storage files, move them there or configure the original absolute IMAGE_STORAGE_PATH. Production volumes and `/app/storage/images` are unchanged.
- Production `.env.production.example` stays at the root because Compose configures several services. The actual server file remains `/opt/akeela/.env.production`. Frontend browser configuration must never include API signing, database or SMTP secrets.
- Bruno stays at `bruno/AKEELA`; its private `.env` is separate. Unit/build/test output moves under `apps/api`; relative TypeScript imports and migrations remain unchanged.

## Checks and releases

- `npm run check` runs repository lint/format/docs/Bruno/tool tests plus API typecheck/unit/build. `npm run test:integration` runs the real PostgreSQL/Mailpit suite.
- CI always checks repository quality and audits production dependencies. API integration and Docker smoke run when `apps/api`, shared manifests/tooling, deployment files or unclassified paths change. Frontend/docs-only changes skip that API build path. Missing Git history runs the API checks conservatively.
- Main releases publish/deploy the API only when that path is affected. Image package naming remains compatible with existing GHCR releases. Deployment still needs explicit server configuration and DEPLOY_ENABLED.
- There are no frontend build/release jobs yet. The first implementation of each frontend must add its npm workspace, checks, Docker/static build and independent release flow in the same PR. A README-only folder is not a deployable application.
- Feature PRs target dev; main promotion still requires the owner's explicit instruction. This task authorizes pushing the monorepo change, not a new production/main release.

## Docker and Caddy

- Build context is the repository root; API Dockerfile is `apps/api/Dockerfile`. Docker copies only the API/manifests and installs production workspace dependencies for runtime. It never copies private environment files or future frontend code.
- Production Compose runs prebuilt images and never builds on the VPS. API, database, image and Caddy volume identities remain stable across this move.
- Caddy serves the API and public images. It imports `deploy/sites-enabled/*.caddy`; initially no frontend sites are enabled, so it does not request certificates for unfinished apps.
- `deploy/templates/frontends.caddy` reserves the three domain configurations with explicit 503 responses only. It is validated but not imported or deployed as a frontend. Once an application and DNS are ready, enable only its tested site; replace its response with a static-file or reverse-proxy configuration appropriate to the chosen framework.
- ADMIN_DOMAIN, VENDOR_DOMAIN and DELIVERY_DOMAIN are configurable. API CORS uses the exact three origins from `.env.production.example`; change the allowlist with the real origins. Domain variables alone do not configure DNS or change CORS.
- No frontend services, SSR ports, static-output directories or frameworks are guessed during this migration. Actual Hostinger provisioning, public TLS and frontend deployment remain pending; backups remain deferred.

References: [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/), [Docker build context](https://docs.docker.com/build/concepts/context/), [Caddy imports](https://caddyserver.com/docs/caddyfile/directives/import).
