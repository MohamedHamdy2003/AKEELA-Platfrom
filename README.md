# AKEELA Ordering Platform

Three React/Vite/TypeScript dashboards are implemented: Restaurant, Admin and Delivery Company, with Arabic RTL and tab-scoped sessionStorage sessions. Admin and Delivery have separate visual identities. [Run guides](docs/MONOREPO.md) · [Portal design](docs/PORTAL-DESIGN.md).

AKEELA monorepo with a restaurant ordering backend using NestJS, PostgreSQL and TypeORM. One modular monolith, one database and four roles: Customer, Restaurant, Delivery_Company and Admin.

Features 01-14 cover authentication, restaurant approval, catalog/addons/offers, customer addresses/cart/checkout, history and delivery. Features 15-16 add image uploads and health probes. Feature 17 adds authorized Socket.IO order notifications. Includes 81 Bruno requests, PostgreSQL integration tests, Docker/Caddy and GitHub CI/CD.

## Repository layout

```text
apps/api/          NestJS API, tests and Dockerfile
apps/restaurant/   Restaurant dashboard
apps/admin/        Admin dashboard
apps/delivery/     Company dispatcher dashboard
docs/              Shared architecture and frontend specifications
deploy/            Caddy, VPS preparation and release assets
bruno/AKEELA/      Maintained API collection
```

API and all three browser applications are implemented. Use npm workspaces and the single root lockfile; read [MONOREPO.md](docs/MONOREPO.md).

## Start locally

Use Node.js 24, npm 11 and Docker with Compose.

```sh
npm ci
npm run setup:local
docker compose up -d
npm run migration:run
npm run start:dev
# Separate terminals: dev:restaurant (5173), dev:admin (5174), dev:delivery (5175)
```

Run these commands from the repository root. Local API secrets live in `apps/api/.env`; setup preserves an existing file. Review configuration before migrations. API: `http://localhost:3000/api/v1`. Health: `/api/v1/health/ready`. Images: `http://localhost:3000/images/<filename>`. Mailpit: `http://localhost:18025`.

Open `bruno/AKEELA` in Bruno and select Local; see [BRUNO.md](docs/BRUNO.md). Keep credentials/tokens outside Git. Provision the only Admin using `npm run create:admin` with private CLI inputs from [AUTH.md](docs/AUTH.md). Restaurants register themselves and need Admin activation before modifications/operations.

For the local demo catalog, run `npm run seed:demo-restaurants` after migrations. The command creates five active sample restaurants directly in the local `akeela` database. Their dishes and neighborhoods are based on the [Rico prototype](https://rico-ui-cyan.vercel.app/). Coordinates and opening hours are demo values.

The command prints the path to a private local CSV with every account's role, email and status. That first export records the generated passwords for newly created demo accounts. Save it privately. Use `npm run seed:demo-restaurants -- --report-only` to refresh the account list without changing any accounts. Existing passwords stay hashed, and repeat seeding preserves existing accounts.

Use `npm run seed:demo-restaurants -- --refresh-demo-names` to replace only the five original demo owner labels with natural sample names. Custom names, credentials and profile states stay unchanged. This command is local-only and creates no accounts. Sample contacts remain synthetic to avoid using real people's contact information.

Swagger: `http://localhost:3000/api/v1/docs`. OpenAPI JSON: `http://localhost:3000/api/v1/docs-json`. All 81 REST endpoints include input/response schemas, examples, JWT authorization and mobile integration rules. See [SWAGGER.md](docs/SWAGGER.md). Try it out sends real requests to the selected API.

Swagger has four role views: Customer, Restaurant, Admin and Delivery Company, each with its own feature groups. Use the top selector or `/api/v1/docs/customer`, `/restaurant`, `/admin` and `/delivery-company` under the same docs prefix. The full JSON remains unchanged for existing imports.

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
| [Realtime orders](docs/REALTIME.md)                | Socket.IO contract and mobile integration     |
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

Target: purchased Hostinger KVM 2 VPS (2.25.12.243), Ubuntu 26.04.1 LTS with Caddy HTTPS, non-root API and private PostgreSQL containers. Volumes preserve database, images and certificates. CI checks PRs; main releases publish GHCR images and optionally deploy immutable digests through pinned SSH.

Domain: akeelaonline.tech, with api/admin/restaurant/delivery subdomains. Docker/private configuration and public DNS are ready. The first production rollout is live with verified public HTTPS, Admin login/WSS and Gmail SMTP authentication. DEPLOY_ENABLED is configured; subsequent main releases use the same pinned deployment flow. OTP inbox delivery remains a real user-flow check. Backup automation is deferred.

Build images from root using each apps/<app>/Dockerfile. Production Compose starts PostgreSQL, migrations/idempotent Admin initialization, API, three static frontends and Caddy in one command; see [deployment](docs/DEPLOYMENT.md). Restart never resets an existing Admin.

Live applications: [Admin](https://admin.akeelaonline.tech), [Restaurant](https://restaurant.akeelaonline.tech), [Delivery](https://delivery.akeelaonline.tech), [API readiness](https://api.akeelaonline.tech/api/v1/health/ready). The real company account is created by Admin, verified, then configured with its company profile ID before accepting orders. See [status](docs/STATUS.md).
