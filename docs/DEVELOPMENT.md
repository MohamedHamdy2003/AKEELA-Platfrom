# Local Development

## Prerequisites and setup

- Node.js 24 LTS, npm 11, PostgreSQL 17 (local default). Dependency versions are pinned in `package.json` and `package-lock.json`.
- Local Compose starts PostgreSQL on localhost:15432 and Mailpit on SMTP 11025 / UI 18025. Sample credentials are for local development only.

```sh
npm ci
```

Generate an ignored `.env` with independent random auth secrets (existing files are preserved). In PowerShell:

```powershell
npm run setup:local
docker compose up -d postgres mailpit
npm run migration:run
npm run start:dev
```

Run from the repository root. Use an existing PostgreSQL server by changing DATABASE_URL instead of starting Compose. Run the reviewed Feature 01 migration explicitly; never enable automatic schema changes.

## Settings

| Variable       | Meaning                                                   | Default / requirement                           |
| -------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `NODE_ENV`     | development, test, production                             | development                                     |
| `PORT`         | HTTP port, 1–65535                                        | 3000                                            |
| `DATABASE_URL` | PostgreSQL URL including database name; no query/fragment | required                                        |
| `DATABASE_SSL` | verified TLS connection                                   | false; set true when your provider requires TLS |
| `CORS_ORIGINS` | comma-separated exact HTTP(S) browser origins             | blank disables cross-origin browser access      |

Use `DATABASE_SSL` instead of URL SSL query parameters. A custom TLS CA is not configured in this foundation; document and implement provider-specific trust configuration when required. External environment values take precedence over `.env`; tests ignore `.env` when `NODE_ENV=test`.

The project-local `.npm-cache/` avoids relying on a writable user-global cache. It is ignored by Git. `.env` and generated outputs are ignored too.

## Commands

Manual API testing uses [Bruno](BRUNO.md). Real Gmail setup uses [GMAIL.md](GMAIL.md); run `npm run smtp:check` after privately configuring credentials. `npm run bruno:check` validates all numbered collection folders and is included in `npm run check`.

| Command                | Purpose                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run start:dev`    | Start with file watching; requires PostgreSQL                          |
| `npm run build`        | Compile application to `dist/`                                         |
| `npm run start:prod`   | Run compiled application; build first                                  |
| `npm run typecheck`    | Strict application TypeScript check                                    |
| `npm run lint`         | ESLint without auto-fixes                                              |
| `npm run format`       | Format foundation code/docs; excludes the four original specifications |
| `npm run format:check` | Check formatting without changing files                                |
| `npm test`             | Compile tests to `dist-test/`, then run Node test runner               |
| `npm run docs:check`   | Check API route parity, JSON examples, and local doc links             |
| `npm run check`        | All local foundation checks                                            |

Unit/bootstrap tests do not open a database. `npm run test:integration` uses the actual Auth APIs with a dedicated local PostgreSQL database and Mailpit. Read `AUTH.md` first: tests intentionally truncate that test database and roll back/reapply migrations. Auth secrets and SMTP/token/OTP/rate-limit settings are described in `AUTH.md` and `.env.example`.

## Migration workflow

The CLI uses `src/database/data-source.ts`, with the same validated configuration as the Nest connection. Migrations run as an explicit release step, never during application boot.

```sh
npm run migration:show
npm run migration:generate -- src/database/migrations/DescribeChange
```

Inspect generated SQL and verify documented constraints and reversibility before applying it to an authorized development database:

```sh
npm run migration:run
npm run migration:revert
```

Development commands use TypeScript and dev dependencies. Production uses `npm run migration:run:prod` to run compiled migrations. Never use development ts-node in a production-only install. Additional schema changes and seeds require authorization.

## Future feature workflow

1. Obtain authorization for the feature; Features 01-16 are already implemented.
2. Read AGENTS and relevant docs; resolve only decisions that block that feature.
3. Add minimal DTO/service/controller/entity files within the owning module.
4. Implement database constraints and tested transaction boundaries when schema work is authorized.
5. Verify contract, permissions, and success/failure behavior. Update docs and status in the same change.

## Production target

Production is planned on one Hostinger VPS using Docker and Caddy, with backend, database, and primary image files on the same server. Read [DEPLOYMENT.md](DEPLOYMENT.md). Local compose.yml provides PostgreSQL and Mailpit only; never reuse its sample credentials or published database port as production configuration. No production services are started by local setup.
