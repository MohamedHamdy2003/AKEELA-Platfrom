# AKEELA Ordering Platform

Backend for a local restaurant ordering platform: customer ordering, restaurant management, and delivery company workflows.

NestJS modular monolith with PostgreSQL and TypeORM. **Foundation only — awaiting architecture review.** No business endpoints, entities, migrations, tables, seeds, or authentication are implemented.

Start with [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md). The four root specifications remain the canonical business documents; they have not been edited during foundation setup.

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

Use Node.js 24 LTS and npm 11. Copy `.env.example` to `.env`, then:

```sh
npm ci
docker compose up -d postgres
npm run start:dev
```

An existing PostgreSQL server may be used instead; set `DATABASE_URL` accordingly. No schema is created on application startup. The app needs PostgreSQL to boot; no database bypass exists in runtime configuration.

The HTTP prefix is `/api/v1`. There are currently no registered routes, so requests return 404. This is intentional; documented business APIs are not yet implemented.

## Checks

```sh
npm run check
```

This runs lint, formatting, TypeScript checks, foundation tests, build, and documentation consistency checks. Read [development instructions](docs/DEVELOPMENT.md) for commands, database limitations, and migration safety.

## Repository map

| Location           | Contents                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| `src/modules/`     | Eight empty feature module boundaries                                   |
| `src/config/`      | Validated environment configuration                                     |
| `src/database/`    | Shared TypeORM configuration and CLI DataSource; no entities/migrations |
| `src/bootstrap.ts` | HTTP prefix, strict DTO validation, CORS, shutdown hooks                |
| `test/`            | Foundation configuration and application composition tests              |
| `docs/`            | Architecture, ownership, conventions, decisions, current status         |
| `AKEELA-*.md`      | Four canonical business specifications                                  |
| `work/`            | Ignored scratch material; not a source of truth                         |

Business implementation may begin only after the user reviews and approves this foundation and authorizes the next feature.
