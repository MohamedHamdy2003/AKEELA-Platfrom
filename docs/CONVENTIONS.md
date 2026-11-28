# Development Conventions

## Frontend additions

Restaurant, Admin, and Delivery use React/Vite/strict TypeScript in `apps/{restaurant,admin,delivery}`, shared brand tokens/assets in `packages/brand`, and shared HTTP/session/realtime/dialog helpers in `packages/portal`. Keep feature components focused, API types independent of backend internals, and Arabic labels/RTL native. Use npm workspaces and the single root lockfile. Run `npm run check` and each changed app's Playwright flows. Browser screenshots/reports stay outside source. See [design system](DESIGN-SYSTEM.md) and [portal design](PORTAL-DESIGN.md).

## Code

- Strict TypeScript; kebab-case filenames, PascalCase classes, camelCase internal variables. Keep API/database snake_case names from the specifications; map them explicitly.
- Prefer constructor injection, named focused services, and small methods. No service locators or static business helpers.
- Use explicit DTO classes with validation for HTTP input. Do not bind request bodies to entities or accept arbitrary partial entities.
- Services return explicit data; controllers map output. Never serialize entities containing secrets directly.
- Do not add interfaces that simply mirror one concrete service, generic repositories, or speculative extension points.
- Add dependencies only when needed. Use npm workspaces, exact dependency versions and the single root lockfile; document runtime changes.

## HTTP contracts

- Follow the existing `/api/v1` routes, methods, request names, status codes, envelopes, and pagination from the API specifications.
- Keep Swagger in sync with each HTTP contract change: DTO annotations, operation metadata, public response schemas and synthetic examples. See [SWAGGER.md](SWAGGER.md). Never expose persistence entities or secrets in schemas/examples.
- Unknown DTO fields produce 422; convert query values explicitly, not with broad implicit conversion. Define limits when the relevant feature is authorized.
- Write simple English validation messages that explain how to fix the input. Set explicit DTO validator messages; never expose regular expressions or validator internals. Keep field keys, error codes, and status codes unchanged.
- Preserve decimal money/coordinate values as strings in JSON; use decimal-safe arithmetic or PostgreSQL numeric operations, never binary floating point for prices.
- Do not silently implement every editable field merely because it appears in an example. Apply role-specific allowlists and document ambiguity first.
- Use 401 for unauthenticated, 403 for role/account/activation denial, and the documented 404/409/422/429 cases. Do not expose SQL, stack traces, hashes, or secrets to clients.
- Shared HTTP exception handling and explicit success envelopes follow the API contract. Unknown routes use the error envelope too. Features 01–18 are implemented.

## Persistence

- PostgreSQL only; TypeORM entity registration is by feature-owned `*.entity.ts` files, with compiled `*.entity.js` files used in production. Do not scan both at once.
- Use explicit snake_case table/column/constraint names in future mappings. The logical document's title case is descriptive; do not create mixed-case quoted PostgreSQL names by accident.
- All schema changes use reviewed migrations. Keep `synchronize`, `dropSchema`, and `migrationsRun` false in every environment.
- Register feature repositories using `TypeOrmModule.forFeature` only after approved entities exist. Do not access another module's repositories.
- Timestamps use timezone-aware PostgreSQL timestamps (`timestamptz`) for UTC instants; restaurant opening/closing hours remain local `time` values. API timestamps use Africa/Cairo offsets; require Z/offset in offer inputs, never server-local parsing.
- PostgreSQL partial unique indexes support one default customer address. Composite FKs/checks, item XOR, and history-preserving delete behavior must be implemented as documented, not reduced to application validation alone.
- BIGINT IDs use decimal strings in API payloads, application objects, and JWT subjects. Never cast them to JavaScript numbers or use a lossy global pg parser.
- Monetary snapshots stay fixed after checkout. Catalog availability uses existing `is_active`; no speculative `is_available` column.
- `invalidWhereValuesBehavior` throws for null/undefined filters to prevent accidentally broad queries. Explicit SQL NULL checks use TypeORM `IsNull()`.

## Security and boundaries

- Email/password, emailed OTP, JWT access tokens, and rotating refresh sessions are implemented for Feature 01; follow `AUTH.md`.
- Distinguish account `is_active`, restaurant service `is_active`, and Admin-controlled restaurant activation. Never trust a role or owner ID supplied in a body.
- Pending/Suspended restaurant owners may view their status after email verification; Pending/Suspended profile edits are blocked too. Recheck activation inside locked write transactions, including existing sessions.
- No secrets in docs/examples beyond obvious placeholders. Future email, JWT, OTP keys, token lifetimes, and shared rate-limit storage require deliberate configuration.
- Do not log request bodies, passwords, OTPs, raw tokens, authorization headers, or database URLs. Production uses verified TLS where required; never set `rejectUnauthorized: false`.

## Tests and documentation

- Unit/bootstrap tests use Node's test runner, Nest testing utilities, and Supertest. Auth integration tests use the actual AppModule with PostgreSQL and local Mailpit; no SQLite or fake persistence.
- For features, add focused service tests and HTTP tests for documented behavior, permissions, ownership, failures, and state transitions. Database constraints, transactions, and races require real PostgreSQL tests; do not use SQLite as a substitute.
- Do not add tests that merely mirror empty module declarations. Check business behavior only after it is authorized.
- Run `npm run check` and record what passed and what was not tested. Keep the four business specs unchanged unless needed; update architecture/status alongside technical changes.

Image operations follow [IMAGES.md](IMAGES.md) (including 24-hour orphan WebP cleanup). Production readiness includes actual PostgreSQL and isolated Caddy TLS/persistence tests, not only Compose syntax.

## Monorepo paths

API code and tests live in `apps/api`; dashboards live in `apps/{restaurant,admin,delivery}`; shared packages live in `packages/{brand,portal}`. Root scripts delegate with the correct working directory. Add dependencies to the owning workspace, shared checks at root. Keep local secrets per app and do not create nested repositories or lockfiles. Follow [MONOREPO.md](MONOREPO.md).
