# Architecture Decisions

## Restaurant frontend decisions (2026-11-14)

- Owner approved an embedded Leaflet + OpenStreetMap registration picker: automatic browser coordinates are shown directly, and manual map selection updates existing decimal-string fields. Leaflet is bundled; standard OSM tiles load directly with attribution/referrer/caching per provider policy. Public tile URL/attribution can be overridden at build time. The tile service has no availability guarantee. Production img-src permits data: images for Leaflet’s transparent tile-cancellation placeholder; other CSP directives remain unchanged.

- Current owner request authorizes React + Vite + strict TypeScript in apps/restaurant, Arabic-first RTL and the current Fresh Kitchen visual refresh (replacing the initial Garden Kitchen direction). See [design system](DESIGN-SYSTEM.md).
- The owner requires login to survive reload. All three apps implement this with tab-scoped sessionStorage tokens (supersedes the earlier memory-only choice); see [AUTH](AUTH.md). JSON transport stays unchanged; no localStorage/cookies/cross-subdomain SSO. Concurrent refreshes within one page share one rotation with one retry.
- packages/brand contains shared CSS tokens and raster identity assets as requested for the ecosystem. React UI remains app-local until another implemented app needs it.
- Existing REST contracts define the supported screens. No analytics, staff, branches, preparation statuses or backend changes are introduced. Hosting remains disabled pending a separately approved release/configuration.

Status: foundation approved and Feature 01 authorized/implemented. Other business choices remain deferred. Update decisions and reasons with architectural changes.

| ID  | Choice                                                                                   | Reason / consequence                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01 | Single NestJS modular monolith + single PostgreSQL database + TypeORM                    | Required stack; simple deployment and atomic transactions across features                                                                                                                                                |
| A02 | Eight domain-oriented modules; no separate Admin megamodule                              | Role-prefixed routes stay with the feature that owns their behavior                                                                                                                                                      |
| A03 | Controllers → services → owning-module TypeORM repositories                              | Separation of concerns without generic abstractions                                                                                                                                                                      |
| A04 | Export services for module collaboration; explicit EntityManager for shared transactions | Keeps ownership clear while supporting checkout and registration atomically                                                                                                                                              |
| A05 | Root business docs stay in place; `docs/` links to them                                  | One canonical copy; existing links and documents are preserved                                                                                                                                                           |
| A06 | Migrations only, never sync/drop/automatic migration startup                             | Schema review and predictable deployments; no schema objects created now                                                                                                                                                 |
| A07 | Express adapter; Node 24 LTS; strict TypeScript; npm lockfile                            | Standard Nest setup, compatible runtime, reproducible dependencies                                                                                                                                                       |
| A08 | TypeORM 1.1.3 with the compatible Nest TypeORM adapter                                   | Registry peer compatibility was checked; the initial 0.3 candidate had dependency advisories, so the foundation uses the supported 1.x release before any schema or entity exists. Future major upgrades require review. |
| A09 | Shared validated config for app and CLI; verified TLS when enabled                       | Avoid connection configuration drift and unsafe TLS bypasses                                                                                                                                                             |
| A10 | Node test runner + Nest testing utilities + Supertest                                    | Sufficient unit/HTTP testing without another test framework                                                                                                                                                              |
| A11 | PostgreSQL 17 for local Compose                                                          | Stable local baseline; hosting/provider version remains to be confirmed                                                                                                                                                  |

## Approved hosting decision

- A12: One Hostinger VPS hosts the NestJS backend, PostgreSQL, and primary image files.
- A13: Docker containers separate the services; Caddy handles public routing and HTTPS/certificate management.
- A14: Persistent volumes hold database data, images, and Caddy state. Backup automation is deferred by the owner; future backups must be outside the VPS.
- These choices do not introduce microservices or approve production provisioning. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Deferred; no implementation permission implied

- Features 01-16 are implemented with twenty entity tables, one history view and eight migrations. Future schema/features/seeds require approval.
- Response/error mapping is implemented; OpenAPI generation remains deferred.
- Confirmed auth choices: decimal-string IDs, SMTP with local Mailpit, HS256 JWT/live DB sessions, JSON refresh tokens, 15-minute/30-day token lifetimes, six-digit/10-minute OTP with five attempts and 60-second cooldown, and 8–128 character passwords with at least one letter and one digit. See `AUTH.md`. Production SMTP credentials, browser token storage, and future shared rate-limit storage remain deployment/client decisions.
- Cart quotes are informational only. At checkout use current server prices directly; no quote tokens, expiry, or reviewed-total comparison.
- Currency EGP and initial general delivery fee 30.00 are confirmed. DEFAULT_DELIVERY_COMPANY_ID is an optional validated environment setting; missing/unavailable company rejects acceptance and keeps Pending.
- Image uploads are approved and implemented: JPEG/PNG/WebP up to 5MB, byte validation/re-encoding, public URLs through Caddy and persistent local volume. See IMAGES.md.
- Source hosting is GitHub (`MohamedHamdy2003/AKEELA-Platfrom`). Feature PRs target `dev`; release PRs from `dev` to `main` require explicit owner instruction. See `GITHUB-FLOW.md`. CI/CD workflows are implemented; actual VPS deployment and branch protection need configuration.

Official references used for foundation choices: [Nest modules](https://docs.nestjs.com/modules), [configuration](https://docs.nestjs.com/techniques/configuration), [validation](https://docs.nestjs.com/techniques/validation), and [TypeORM DataSource options](https://typeorm.io/docs/data-source/data-source-options/). Installed versions and lockfile are authoritative for the APIs available in this project; avoid copying incompatible newer examples.

## Auth / testing update

- New password inputs now require 8-128 characters, including a letter and a digit. Existing login/current-password checks remain compatible. Other approved token/OTP defaults are unchanged.
- Gmail uses the existing real SMTP adapter with a Google App Password and TLS. The shared SMTP options also drive the connectivity checker. No credentials are committed; local Gmail authentication was verified; inbox delivery remains unconfirmed.
- Bruno requests live next to code, in numbered feature folders. Use the collection inside the same project checkout; it follows the current branch. Only implemented endpoints appear; secrets stay outside Git and tokens stay in runtime memory.
- This Auth + Bruno release is approved for main by the owner; future releases retain the explicit approval requirement.

- Owner confirmed one Admin created through CLI only; it cannot be disabled. Features 01-10 and this release to main are authorized.
- Public restaurant opening status uses the single local market timezone Africa/Cairo explicitly; no per-restaurant timezone column.

## Confirmed cart and checkout decisions

- Features 11 and 12 are authorized. Currency EGP; initial general delivery fee 30.00. Admin-managed general fees are a future feature.
- Accept either an owned saved address ID or a one-time address; never both.
- Merge matching product/addon choices, combining item and total addon quantities. Different choices remain separate. Switching restaurants requires explicitly clearing the cart first.
- No business caps on cart size or quantities. Validate storage integer range and money overflow.
- Owner rejected checkout_key and checkout_request_hash. Do not implement them.
- Owner rejected signed quotes and reviewed-total comparisons. Checkout calculates current prices and places the order directly.

## Order handling and delivery

- Features 13-14 and their main promotion are authorized. Actual VPS deployment remains pending.
- One always-active company for this version: APIs reject inactive company creation, service deactivation and Delivery_Company account disabling. Defensive database checks remain.
- Active owned drivers are required for assignment, pickup and delivery. Driver changes stop after pickup.
- Acceptance assigns the configured company atomically. Retrying Accepted preserves saved company/driver and does not consult changed configuration.
- Operational date filters use whole Cairo days, including date_to. Delivery pickup fields use the current restaurant profile.
- Owner confirmed restaurant is_active=false stops new sales only; existing order handling stays available while activation remains Active. Admin suspension still blocks restaurant order operations.

## Production preparation decisions

- Owner approved images/health, CI/CD and promotion of all implemented work to main. VPS purchase/provisioning is pending; backups are explicitly deferred.
- Pending/Suspended owners cannot modify account/profile/catalog/images; authentication/password security and own profile/status reads remain available.
- Use Africa/Cairo for Ismailia. Store UTC instants, return Cairo offsets, require explicit Z/offset in offer timestamps and validate real calendar dates.
- Repriced overflow carts remain readable/removable. Additions/edits and checkout still reject money overflow.
- Releases publish GHCR images, deploy immutable digests only after CI, use pinned SSH and explicit migrations, and never delete persistent volumes. Live deployment requires DEPLOY_ENABLED and server settings.

## Monorepo decision

- One Git repository contains `apps/api`, `apps/restaurant`, `apps/admin` and `apps/delivery`, with shared root docs/deployment/Bruno. Only the API is implemented.
- Use npm workspaces with a single root lockfile; API business logic and schema are unchanged. No Nx/Turborepo, shared UI package or new framework is needed.
- Keep API local environment in `apps/api/.env`, production service environment outside Git. Docker builds from the root using `apps/api/Dockerfile`; existing production volumes/image identity remain compatible.
- API checks/publication are affected-path aware. Frontend CI/deployment is added with each actual application, not simulated now. Caddy frontend templates are disabled until their application and DNS are ready.
- The owner authorized GitHub push for this change; feature PRs still target dev and a future main promotion needs explicit approval.

## Dashboards, realtime and deployment — 2026-11-18

Admin and Delivery are implemented React/Vite/TypeScript workspaces, Arabic RTL and tab-scoped sessionStorage sessions. Their visual identities differ; shared HTTP/layout/order components live in packages/portal for these two consumers. Restaurant shares the realtime, session-storage, bootstrap and logout-confirmation helpers while keeping its own HTTP client and remaining UI. Root check and consolidated CI cover all workspaces.

Socket.IO runs inside the single API process. Events invalidate authorized REST reads after order commits; no schema, microservice, Redis or durable event log is added. See [REALTIME](REALTIME.md) and [portal design](PORTAL-DESIGN.md).

The owner purchased Hostinger KVM 2 at 2.25.12.243, France. SSH confirmed Ubuntu 26.04.1 LTS. Domain: akeelaonline.tech; API/admin/vendor/delivery subdomains. Production Compose includes all services plus one-off migrations and idempotent Admin initialization. Existing Admin values are never reset. See [DEPLOYMENT](DEPLOYMENT.md).
