# AKEELA Ordering Platform

AKEELA monorepo with a restaurant ordering backend using NestJS, PostgreSQL and TypeORM. One modular monolith, one database and four roles: Customer, Restaurant, Delivery_Company and Admin.

Features 01-14 cover authentication, restaurant approval, catalog/addons/offers, customer addresses/cart/checkout, history and delivery. Features 15-16 add image uploads and health probes. Includes 81 Bruno requests, PostgreSQL integration tests, Docker/Caddy and GitHub CI/CD.

## Repository layout

```text
apps/api/          NestJS API, tests and Dockerfile
apps/restaurant/   Reserved vendor frontend
apps/admin/        Reserved Admin frontend
apps/delivery/     Reserved company frontend
docs/              Shared architecture and frontend specifications
deploy/            Caddy, VPS preparation and release assets
bruno/AKEELA/      Maintained API collection
```

Only the API is implemented. Frontend folders contain README instructions, with no application scaffold or frontend deployment. Use npm workspaces and the single root lockfile; read [MONOREPO.md](docs/MONOREPO.md).

## Start locally

Use Node.js 24, npm 11 and Docker with Compose.

```sh
npm ci
npm run setup:local
docker compose up -d
npm run migration:run
npm run start:dev
```

Run these commands from the repository root. Local API secrets live in `apps/api/.env`; setup preserves an existing file. Review configuration before migrations. API: `http://localhost:3000/api/v1`. Health: `/api/v1/health/ready`. Images: `http://localhost:3000/images/<filename>`. Mailpit: `http://localhost:18025`.

Open `bruno/AKEELA` in Bruno and select Local; see [BRUNO.md](docs/BRUNO.md). Keep credentials/tokens outside Git. Provision the only Admin using `npm run create:admin` with private CLI inputs from [AUTH.md](docs/AUTH.md). Restaurants register themselves and need Admin activation before modifications/operations.

## Documentation

Every agent/developer must read [AGENTS.md](AGENTS.md) and relevant documentation first. Documentation is the source of truth.

| Document                                           | Content                                       |
| -------------------------------------------------- | --------------------------------------------- |
| [Index](docs/README.md)                            | Architecture, conventions and guides          |
| [Status](docs/STATUS.md)                           | Implemented and remaining work                |
| [DB design](AKEELA-DB-Design.md)                   | Tables/constraints                            |
| [Features](AKEELA-Features.md)                     | Scope, rules and routes                       |
| [Requests/Responses](AKEELA-Responses-Requests.md) | API payloads/results                          |
| [Flows](AKEELA-Flows.md)                           | Role journeys                                 |
| [Images](docs/IMAGES.md)                           | Uploads, URLs and persistence                 |
| [Hostinger deployment](docs/DEPLOYMENT.md)         | VPS setup, Docker/Caddy, secrets and recovery |
| [GitHub flow](docs/GITHUB-FLOW.md)                 | Feature PR → dev → owner-approved main        |

## Checks

```sh
npm run check
npm run test:integration
npm run smoke:production
```

Integration tests require dedicated local PostgreSQL TEST_DATABASE_URL ending in `_test` and Mailpit. They truncate test data and test migrations; never use the application database. Docker smoke creates and removes only its own random test project.

## Deployment

Target: one Hostinger Ubuntu 24.04 VPS with Caddy HTTPS, non-root API and private PostgreSQL containers. Volumes preserve database, images and certificates. CI checks PRs; main releases publish GHCR images and optionally deploy immutable digests through pinned SSH.

VPS/domain are not configured yet. Deployment stays disabled until DEPLOY_ENABLED and server settings are added. Local TLS/persistence are tested; public certificates and production email need server verification. Backup automation is deferred.

API image builds use `docker build -f apps/api/Dockerfile -t akeela-api:local .` from the root. Caddy frontend site templates are disabled until their applications and DNS are ready. API CI/build/publication responds to API/shared-file changes; future frontend build/release jobs must be added with their applications.
