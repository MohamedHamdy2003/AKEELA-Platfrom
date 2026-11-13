# AKEELA Ordering Platform

Restaurant ordering backend using NestJS, PostgreSQL and TypeORM. One modular monolith, one database and four roles: Customer, Restaurant, Delivery_Company and Admin.

Features 01-14 cover authentication, restaurant approval, catalog/addons/offers, customer addresses/cart/checkout, history and delivery. Features 15-16 add image uploads and health probes. Includes 81 Bruno requests, PostgreSQL integration tests, Docker/Caddy and GitHub CI/CD.

## Start locally

Use Node.js 24, npm 11 and Docker with Compose.

```sh
npm ci
npm run setup:local
docker compose up -d
npm run migration:run
npm run start:dev
```

Review private local configuration before migrations. API: `http://localhost:3000/api/v1`. Health: `/api/v1/health/ready`. Images: `http://localhost:3000/images/<filename>`. Mailpit: `http://localhost:18025`.

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
