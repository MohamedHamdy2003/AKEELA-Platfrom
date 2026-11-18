# Agent Instructions

Read this file before work. It applies across the repository; app-level `AGENTS.md` files add scoped instructions. Documentation is the source of truth, not previous chats. Current explicit user instructions take precedence.

## Start with the smallest useful context

1. Run `git status --short`; preserve existing changes. Identify the requested app and feature before reading source.
2. Check [STATUS](docs/STATUS.md) for current implementation, rules and pending decisions; historical verification details are optional.
3. Read the target app's `AGENTS.md` and its linked design guide. For cross-app work, read only the affected app instructions.
4. Read the relevant contract sections listed by that guide, including common response/error formats and the response models actually used. Then inspect only the matching controller/DTO if needed to verify behavior.
5. Read additional docs from the table below only when that work needs them. Do not load the entire repository or every document first.

## Project map

| Path                                        | Purpose                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/api`                                  | Implemented NestJS modular monolith, PostgreSQL, TypeORM; Features 01-17       |
| `apps/restaurant`                           | Implemented React/Vite Restaurant frontend; `restaurant.akeelaonline.tech`     |
| `apps/admin`                                | Implemented Admin frontend; `admin.akeelaonline.tech`                          |
| `apps/delivery`                             | Implemented Delivery_Company dispatcher frontend; `delivery.akeelaonline.tech` |
| `docs/frontend`                             | Per-app screens, APIs, permissions and unsupported features                    |
| `AKEELA-*.md` at root                       | Canonical data, features, request/response and role-flow specifications        |
| `bruno/AKEELA`                              | Implemented API request collection                                             |
| `deploy`, root Compose, `.github/workflows` | Docker/Caddy, VPS preparation and CI/CD                                        |

Restaurant is implemented locally; Admin and Delivery are implemented React/Vite dashboards with distinct visual identities. Implement only the app/features authorized by the current task. One Git repository, npm workspaces, one root lockfile; no nested repositories or per-app lockfiles.

## Read on demand

| Work                                                | Read                                                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New app/workspace, install/build commands, paths    | [MONOREPO](docs/MONOREPO.md), root `package.json`, target app manifest if it exists                                                                                                                    |
| HTTP integration                                    | Common rules + relevant numbered sections in [Features](AKEELA-Features.md), matching sections/models in [Requests/Responses](AKEELA-Responses-Requests.md), relevant role in [Flows](AKEELA-Flows.md) |
| Backend changes                                     | `apps/api/AGENTS.md`, [ARCHITECTURE](docs/ARCHITECTURE.md), [CONVENTIONS](docs/CONVENTIONS.md), owning module in [MODULES](docs/MODULES.md)                                                            |
| Auth/session handling                               | [AUTH](docs/AUTH.md), approved decisions in [DECISIONS](docs/DECISIONS.md); [GMAIL](docs/GMAIL.md) only for real SMTP work                                                                             |
| Order actions/delivery                              | [ORDER-DELIVERY](docs/ORDER-DELIVERY.md); [DELIVERY](docs/DELIVERY.md) for company/drivers; [CART-ORDERS](docs/CART-ORDERS.md) for checkout/cart                                                       |
| Uploads                                             | [IMAGES](docs/IMAGES.md); deployment guide if changing storage/serving                                                                                                                                 |
| Schema/constraints                                  | Relevant tables in [DB design](AKEELA-DB-Design.md), [DECISIONS](docs/DECISIONS.md)                                                                                                                    |
| Docker, Caddy, CI/CD, database connections, hosting | [DEPLOYMENT](docs/DEPLOYMENT.md), [MONOREPO](docs/MONOREPO.md), [DECISIONS](docs/DECISIONS.md)                                                                                                         |
| Branch/commit/push/PR                               | [GITHUB-FLOW](docs/GITHUB-FLOW.md)                                                                                                                                                                     |
| API collection edits                                | [BRUNO](docs/BRUNO.md)                                                                                                                                                                                 |
| Need another document                               | Use [docs index](docs/README.md) as a directory, not a mandatory full reading list                                                                                                                     |

## Frontend implementation boundaries

- Follow the owning app guide. Do not invent endpoints, payload fields, statuses, permissions or backend features. Mocks may support tests; do not ship a fake backend or claim fixture-driven screens are integrated. If contract and implementation disagree, record the exact discrepancy and ask before implementing that behavior; do not silently rewrite specs.
- Keep app code inside its directory. Share existing contracts/docs; do not add a shared UI library or framework abstraction before a real need. Frontends call HTTP APIs, never backend repositories/entities or the database.
- Reuse decisions already approved in the current task/docs. Resolve missing framework, language/RTL and browser-session choices when they affect implementation; continue independent work while awaiting answers. JSON refresh tokens are the current API contract; cookies, cross-subdomain SSO and persistent browser storage are not approved defaults.
- Use a configurable API base URL including `/api/v1`. IDs, money and coordinates remain strings; currency is EGP, display time is Africa/Cairo. Backend role/ownership/activation checks remain authoritative.
- Add the workspace, its actual lint/type/test/build scripts, CI coverage and appropriate Docker/static-build integration with the first implementation. Inspect existing manifests/workflows rather than guessing command names. Frontend sites stay disabled until application, DNS and release configuration are ready.
- Existing root build/test shortcuts target the API. Root lint currently covers API/scripts. Passing root checks alone does not prove a frontend works; add/run its own checks and verify key UI flows and responsive/error states.
- Shared manifests/lockfile, docs, Caddy and workflows need coordinated review across app tasks. Do not switch a shared checkout underneath another active task or overwrite another app's changes.

## Safety and change control

- Preserve the four root specs unless the authorized change requires an update. Update affected guides/conventions and [STATUS](docs/STATUS.md) when behavior or architecture changes; avoid copying whole specifications into new docs.
- Never read/dump private `.env` values for orientation, log tokens/passwords/OTPs, or commit secrets. API local configuration is `apps/api/.env`; frontend public settings must not contain API signing, SMTP or database credentials. Read committed examples for setting names.
- Never run migrations, provision accounts, deploy infrastructure, delete persistent volumes or enable sites without task authorization. Backups are deferred. Never enable TypeORM synchronize/dropSchema/automatic migrations.
- Start feature branches from dev and target PRs to dev. Main promotion requires an explicit owner request. Old task approvals in status/history are not blanket permission for a new release.
- `work/` is non-authoritative local scratch material. Do not use scratch outputs to overwrite maintained documentation.

## Efficient reads and verification

- Use `rg --files <app-path>` to locate files, then `rg -n` for specific routes/symbols. In large specs, search headings first (`rg -n '^## |^### ' <file>`) and read bounded sections. Expand only to resolve a concrete question; do not repeatedly reload unchanged files.
- Skip `node_modules`, generated `dist`/`dist-test`, caches, full lockfile dumps, unrelated apps and old Git/chat history during orientation. Inspect lockfile diffs only for dependency work. Follow imports only as far as necessary to understand the use case.
- Install with `npm ci` at root for a fresh checkout or changed dependencies; use the committed lockfile. Do not reinstall on every inspection.
- Docs-only edits: `npm run docs:check` and formatting checks for changed files; run `npm run bruno:check` when API tables/collection change. No database/container tests for prose-only edits.
- Code changes: run `npm run check` plus the changed app's checks. Backend database behavior needs the dedicated PostgreSQL integration suite, not SQLite. Deployment changes need appropriate Compose/Caddy/container verification; see its guide.
- Handoff briefly: scope/app, changed files, checks/results, remaining decisions and implementation limits. Do not claim unimplemented or untested behavior. A continuation note should name the next step and references, not repeat the full project history.

## Dashboard/realtime additions

Admin and Delivery use React/Vite/TypeScript, Arabic RTL and memory-only sessions. Read [portal design](docs/PORTAL-DESIGN.md) for shared packages/portal and [realtime](docs/REALTIME.md) for order notifications. All four production hostnames use akeelaonline.tech. Current VPS details and idempotent migration/Admin startup are in [deployment](docs/DEPLOYMENT.md).
