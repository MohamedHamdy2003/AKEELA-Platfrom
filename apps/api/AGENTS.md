# API Agent Instructions

Follow the root [AGENTS.md](../../AGENTS.md). Backend source/tests/config are in this workspace. Before backend edits, read [ARCHITECTURE](../../docs/ARCHITECTURE.md), [CONVENTIONS](../../docs/CONVENTIONS.md), the owning module in [MODULES](../../docs/MODULES.md), and relevant specification sections. Read DECISIONS before schema/auth/infrastructure work and DEPLOYMENT for connection/storage/container changes.

- One NestJS application, one PostgreSQL database and TypeORM feature modules. Controllers handle HTTP, services use cases, repositories persistence within their owning module.
- Import another module's exported services through its Nest module, never its repositories/internal queries. The owning use-case service coordinates transactions and passes EntityManager explicitly to collaborators.
- No microservices, CQRS, event buses, generic repositories/base services, speculative entities or automatic schema changes. Add DTOs/services/entities only for an authorized use case.
- Preserve API contracts, ownership/activation checks, string IDs/money, existing order snapshots and transaction lock order. If behavior must change, update specifications and tests in the same feature.
- Backend changes require root `npm run check`; database behavior additionally requires `npm run test:integration` against a dedicated local PostgreSQL database ending in `_test`. Tests truncate that database; never substitute the application database or SQLite.
- Do not run migrations, seed real users, send real email or deploy without authorization. Integration tests use Mailpit; real Gmail work requires its guide.
- Keep matching Bruno requests and concise docs updated with implemented API changes. Read [BRUNO](../../docs/BRUNO.md) before collection changes. No secrets or runtime tokens in committed requests.
- Local .env is private to this workspace. Root command shortcuts set the API working directory; compiled output stays here. See [MONOREPO](../../docs/MONOREPO.md).
