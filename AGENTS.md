# Agent Instructions

Read this file before changing any code or documentation.

## Read before work

1. Read `docs/README.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, and `docs/CONVENTIONS.md`.
2. Read `docs/MODULES.md` and the relevant sections of the four root specifications:
   - `AKEELA-DB-Design.md`: data and constraints.
   - `AKEELA-Features.md`: scope, routes, permissions, and implementation order.
   - `AKEELA-Responses-Requests.md`: request and response contracts.
   - `AKEELA-Flows.md`: role journeys.
3. Read `docs/DECISIONS.md` before schema, authentication, or infrastructure work. Also read `docs/DEPLOYMENT.md` before infrastructure, Docker, Caddy, database connection, or image-storage work.
4. Read `docs/GITHUB-FLOW.md` before branch, commit, push, or pull-request work.

## Authority and scope

- Documentation is the source of truth. Do not rely on earlier chats.
- Follow the current user's explicit instructions. If specifications disagree or omit a business decision, record the issue and ask before implementing the affected behavior.
- The architecture foundation is **awaiting user review**. Do not implement business features, entities, migrations, views, tables, or seeds until the user approves the foundation and authorizes that work.
- Preserve the four root specifications unless the requested change requires updating them. Do not silently rewrite them to match an implementation.
- When a convention or architectural decision changes, update its documentation in the same change. Record progress and unresolved issues in `docs/STATUS.md`.

## Architecture boundaries

- One NestJS application, one PostgreSQL database, TypeORM, feature modules.
- Approved deployment target: one Hostinger VPS with separate Docker containers for Caddy, backend, and PostgreSQL; persistent image/database/Caddy storage and off-VPS backups. Follow `docs/DEPLOYMENT.md`. This does not authorize provisioning or deployment.
- Controllers handle HTTP; services handle use cases; TypeORM repositories handle persistence within the owning module.
- Import exported services through Nest module imports. Do not access another module's repository or internal files.
- Keep cross-module transactions in the owning use-case service; pass the transaction EntityManager explicitly to participating services.
- No microservices, CQRS, event buses, generic repositories, base services, or speculative abstractions.
- Add DTOs, services, entities, and exports only when an authorized feature needs them.
- Never enable TypeORM `synchronize`, `dropSchema`, or automatic migration execution.
- Never run migrations, seed users, or change external infrastructure without task authorization.

## Checks and handoff

- Use npm and the committed lockfile. Run `npm ci` for an existing checkout.
- Run `npm run check` after code changes. Use PostgreSQL integration tests for database behavior once entities exist; do not substitute SQLite.
- Report what changed, checks run, limitations, and pending decisions. Do not claim business endpoints or database behavior exist when they are only documented.
- Never commit `.env`, passwords, OTPs, raw tokens, or database credentials. Do not log secrets.
- `work/` is scratch material, not authoritative documentation. Do not run its legacy API generator over the maintained documents.
- Start feature branches from `dev` and target feature PRs to `dev`. Do not merge or push feature changes directly to `main`; promotion from `dev` to `main` requires the user's explicit instruction after the full flow is complete.
