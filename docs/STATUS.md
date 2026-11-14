# Project Status

## Authorized scope

Backend Features 01-16 and monorepo preparation are implemented. Historical release approvals do not authorize a new main promotion; follow the current user request and GitHub flow. The VPS has not been purchased; real provisioning, DNS, certificates and deployment remain pending. Backup automation is deferred by the owner.

## Implemented

| Scope                                                                 | State                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 01-04: Auth, Admin, customer addresses, restaurant profile/activation | Implemented                                                                                            |
| 05-10: Catalog, addons, offers, public menu, company/drivers          | Implemented                                                                                            |
| 11-14: Cart, checkout/history, restaurant order handling/delivery     | Implemented                                                                                            |
| 15: Customer/restaurant/product/offer images and public URLs          | Implemented                                                                                            |
| 16: Public liveness/readiness                                         | Implemented                                                                                            |
| PostgreSQL                                                            | Twenty table mappings, one history view, eight reversible migrations; no schema change in this release |
| API collection                                                        | 81 routes in specifications and matching Bruno folders                                                 |
| Docker/Caddy                                                          | Persistent images/database/certificates, private API/database; local TLS smoke verified                |
| CI/CD                                                                 | PR checks, main GHCR publication, optional pinned-SSH deployment; deployment disabled until configured |

## Current rules

- IDs/money are decimal strings. Passwords: 8-128 characters, a letter and digit. Auth settings: [AUTH.md](AUTH.md).
- One CLI-created Admin and one always-active company. DEFAULT_DELIVERY_COMPANY_ID is optional at startup but required to accept orders.
- EGP, initial delivery fee 30.00. No quote tokens, price comparisons, checkout keys/hashes or cart business caps. Checkout uses current prices.
- Pending/Suspended restaurants may authenticate and read account/profile/dashboard, but cannot modify account/profile/catalog/images or handle orders. Password security operations remain available. Service is_active=false stops new sales only while activation stays Active.
- Catalog writes recheck activation under transaction locks. Nested profile arrays are rejected before business work. Offer timestamps require explicit Z/offset and valid calendar dates.
- PostgreSQL stores UTC instants; API timestamps use Africa/Cairo and its current offset. Restaurant hours are Cairo times. Over-limit repriced carts remain readable/removable; checkout/additions/edits enforce numeric storage limits.
- Gmail authentication was verified earlier. Tests use Mailpit; production inbox delivery needs server verification.

## Pending

- Buy/provision VPS, choose domain, configure DNS/private environment/SSH secrets and DEPLOY_ENABLED, then verify real HTTPS/Gmail.
- Backup/restore automation explicitly deferred. OpenAPI, future delivery-fee Admin API, image cleanup, load testing and client token storage remain unimplemented.
- No application-database migrations/seeds run in this task. Tests truncate only the dedicated local `_test` database.

## Frontend planning

Three frontend design guides are available under `docs/frontend`: Restaurant (`vendor.akeela.com`), Admin (`admin.akeela.com`) and Delivery Company (`delivery.akeela.com`). They map existing APIs to screens, forms, permissions and error states. No frontend code, DNS records, Caddy frontend hosting or CORS changes are implemented by this planning task. The repository layout is approved: apps/api, apps/restaurant, apps/admin and apps/delivery. Framework, UI language/RTL and browser token storage remain pending.

## Verification

Docker smoke passed trusted local TLS, HTTP redirect, reverse proxy readiness, WebP serving and image persistence after API recreation. `npm run check` passed (27 unit tests, lint, formatting, types, build, docs and 81 Bruno requests). The full PostgreSQL/Mailpit suite passed 111 tests; the final changed cart/image/profile cases passed another targeted run of 28 tests. Runtime audit reports zero vulnerabilities. Workflow validation (actionlint), Bash syntax and production Caddy validation passed. See [REVIEW.md](REVIEW.md).

## Monorepo migration

- API source/tests/config/Dockerfile and local env examples moved to apps/api. Root npm workspaces and one lockfile preserve existing command shortcuts.
- docs, specifications, Bruno, Compose, Caddy and CI/CD remain shared at root. Frontend folders contain README instructions only; no frontend scaffold/dependencies.
- Docker/runtime paths, API-affected CI/release conditions, optional Caddy site imports and future subdomain templates are prepared. No schema/API behavior, production volume, DNS or live server change.
- This task authorizes pushing/merging the change to dev; main promotion is a separate owner decision.
- Migration validation: root check passed (27 API unit tests, 3 CI path-selection tests, lint/format/types/build, recursive doc links/API references and all 81 Bruno requests). All 111 PostgreSQL/Mailpit integration tests passed. Docker smoke verified the moved API, compiled migrations, trusted local TLS, redirects, public images and persistent storage; production and disabled frontend Caddy configurations validate. Runtime audit reports zero vulnerabilities. The private environment hash is unchanged after setup.
- Windows npm ci encountered the existing EPERM directory lock; npm install --ignore-scripts --no-audit --no-fund restored the workspace installation. Clean Linux npm ci is verified by the Docker build and GitHub CI. No application database migration, new account or real deployment was run.

## Agent handoff

Root AGENTS.md now provides a scoped reading path. Each app has its own AGENTS.md with its feature sections, source-verification pointers and role limits. Frontend work starts with status, the target app guide and relevant contracts, rather than reading the entire backend/docs. Backend architecture rules stay in apps/api/AGENTS.md; no frontend implementation is authorized by this documentation update.
