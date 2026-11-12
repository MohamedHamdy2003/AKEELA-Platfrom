# AKEELA Ordering Platform

Backend for a local restaurant ordering platform: customer ordering, restaurant management, and delivery company workflows.

NestJS modular monolith with PostgreSQL and TypeORM. **Feature 01 implemented: Authentication and My Profile.** Customer/restaurant signup, email OTP, JWT sessions, password recovery, and shared profile APIs are available. Other business features and production deployment remain pending.

Start with [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md). The four root specifications remain canonical; approved auth decisions and string-ID examples are aligned with implementation.

## Specifications

- [Database design](AKEELA-DB-Design.md)
- [API features](AKEELA-Features.md)
- [Requests and responses](AKEELA-Responses-Requests.md)
- [Role flows](AKEELA-Flows.md)

## Branches and contributions

- `main`: release baseline; merge into it only when the project owner explicitly requests it after a complete flow is ready.
- `dev`: integration branch for completed features.
- `feature/<short-name>`: start from `dev`, implement one feature, run checks, then open a PR into `dev`.

See the short [GitHub PR flow](docs/GITHUB-FLOW.md). The initial foundation is the shared baseline of `main` and `dev`; it does not mean business implementation has been approved.

## Local setup

Use Node.js 24 LTS and npm 11:

```sh
npm ci
npm run setup:local
docker compose up -d postgres mailpit
npm run migration:run
npm run start:dev
```

An existing PostgreSQL server may be used instead; set `DATABASE_URL` accordingly. No schema is created on application startup. The app needs PostgreSQL to boot; no database bypass exists in runtime configuration.

The HTTP prefix is `/api/v1`. The 12 Feature 01 routes are implemented; other documented business APIs remain planned. See [Auth setup and tests](docs/AUTH.md). Mailpit at http://localhost:18025 captures local OTP mail.

## Checks

```sh
npm run check
```

This runs lint, formatting, TypeScript checks, foundation tests, build, and documentation consistency checks. Read [development instructions](docs/DEVELOPMENT.md) for commands, database limitations, and migration safety.

## Repository map

| Location           | Contents                                                         |
| ------------------ | ---------------------------------------------------------------- |
| `src/modules/`     | Auth/account/profile services; catalog/cart/order module shells  |
| `src/config/`      | Validated environment configuration                              |
| `src/database/`    | Shared TypeORM configuration, auth migration, and CLI DataSource |
| `src/bootstrap.ts` | HTTP prefix, strict DTO validation, CORS, shutdown hooks         |
| `test/`            | Unit/bootstrap checks and PostgreSQL/SMTP auth integration tests |
| `docs/`            | Architecture, ownership, conventions, decisions, current status  |
| `AKEELA-*.md`      | Four canonical business specifications                           |
| `work/`            | Ignored scratch material; not a source of truth                  |

Feature 01 is authorized and implemented. Additional features and actual VPS deployment require further authorization. Deployment-ready Docker/Caddy templates are described in [DEPLOYMENT.md](docs/DEPLOYMENT.md).
