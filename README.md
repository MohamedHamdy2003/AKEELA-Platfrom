# AKEELA Ordering Platform

Backend for a local restaurant ordering platform: customer ordering, restaurant management, and delivery company workflows.

NestJS modular monolith with PostgreSQL and TypeORM. **Features 01–03 implemented**:

- **01. Authentication & My Profile** (12 routes): Customer & restaurant signup, email OTP verification/resend, login, JWT refresh/logout, password reset, profile reads/updates, and password changes.
- **02. Admin — Accounts** (6 routes): List accounts with pagination/filtering, read account & profile, create delivery companies, enable/disable login activity with sole-Admin protection, review restaurants, and activate/suspend restaurants.
- **03. Customer Addresses** (5 routes): List saved addresses (at most 2 saved per customer), save address with coordinates, update owned address, atomically swap default address, and delete owned address.

Start with [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md). Canonical business specifications are in the root directory.

## Specifications

- [Database design](AKEELA-DB-Design.md)
- [API features](AKEELA-Features.md)
- [Requests and responses](AKEELA-Responses-Requests.md)
- [Role flows](AKEELA-Flows.md)

## Local Setup Flow

Use Node.js 24 LTS and npm 11. Ensure Docker Desktop is installed and running.

### 1. Install dependencies

```sh
npm ci
```

### 2. Generate local environment configuration

```sh
npm run setup:local
```

This generates a `.env` file populated with local development settings, random cryptographic secrets (`JWT_SECRET`, `OTP_SECRET`), and local PostgreSQL/Mailpit URLs.

### 3. Configure the Admin account credentials

In your local `.env` file, specify the bootstrap Admin account credentials:

```env
ADMIN_EMAIL=admin2003@akeela.com
ADMIN_PASSWORD=admin2003
ADMIN_FULL_NAME=eslam
ADMIN_PHONE=+201001936962
```

> **Note**: The application has only one Admin account, bootstrapped via CLI. No second Admin can be created via the API.

### 4. Start local Docker services

```sh
docker compose up -d postgres mailpit
```

- **PostgreSQL**: available on `localhost:15432` (`akeela` database, `akeela_auth_test` database for integration tests).
- **Mailpit**: SMTP server on port `11025`, web UI at [http://localhost:18025](http://localhost:18025) to view OTP emails.

### 5. Run database migrations

```sh
npm run migration:run
```

Applies all reviewed TypeORM migrations (`CreateIdentity`, `CreateCustomerAddresses`) to the local PostgreSQL database.

### 6. Create the Admin account

```sh
npm run create:admin
```

Creates the sole Admin account and matching admin profile in PostgreSQL using the `ADMIN_*` credentials from `.env`. The Admin's email is automatically verified.

### 7. Start the development server

```sh
npm run start:dev
```

The API starts on [http://localhost:3000/api/v1](http://localhost:3000/api/v1).

## Testing and API Exploration

### Bruno Collection

Open the collection in [bruno/AKEELA](bruno/AKEELA/README.md) following [BRUNO.md](docs/BRUNO.md). It contains the 23 implemented APIs across 3 feature folders:

- `01 - Authentication and My Profile`
- `02 - Admin - Accounts`
- `03 - Customer Addresses`

### Running Checks & Tests

Run full codebase quality and consistency checks:

```sh
npm run check
```

This runs:

- ESLint checks (`npm run lint`)
- Prettier code style check (`npm run format:check`)
- TypeScript typecheck (`npm run typecheck`)
- Unit and security tests (`npm run test`)
- NestJS application build (`npm run build`)
- Documentation route and contract parity check (`npm run docs:check`)
- Bruno API collection parity check (`npm run bruno:check`)

Run end-to-end integration tests against actual PostgreSQL and SMTP:

```sh
npm run test:integration
```

All 36 integration tests run sequentially against the dedicated `akeela_auth_test` database, testing real transactions, constraints, tokens, and role boundaries.

## Branches and Contributions

- `main`: release baseline; updated after complete feature flows are verified.
- `dev`: active integration branch.
- `feature/<name>`: feature branches branched from `dev` and merged into `dev`.

See [docs/GITHUB-FLOW.md](docs/GITHUB-FLOW.md) for details.

## Repository Map

| Location           | Contents                                                                              |
| ------------------ | ------------------------------------------------------------------------------------- |
| `src/modules/`     | Feature modules: auth, users, customers, restaurants, delivery, catalog, cart, orders |
| `src/commands/`    | CLI commands (`create:admin`, `check-smtp`)                                           |
| `src/config/`      | Validated environment configuration                                                   |
| `src/database/`    | TypeORM migrations, entity mappings, and DataSource configuration                     |
| `src/bootstrap.ts` | Global validation, CORS, error envelopes, lifecycle hooks                             |
| `test/`            | Unit, security, and PostgreSQL/SMTP integration tests                                 |
| `bruno/AKEELA/`    | Complete runnable API collection for Bruno                                            |
| `docs/`            | Architecture, status, decisions, deployment, and guide documents                      |
| `AKEELA-*.md`      | Four canonical business specifications                                                |
