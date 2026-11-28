# Architecture Decisions

Consolidated record of approved architecture, security, domain, and deployment decisions across the AKEELA platform.

## Core Platform & Monorepo

| ID  | Choice                                                                                   | Reason / consequence                                                                                                              |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Single NestJS modular monolith + single PostgreSQL 17 database + TypeORM 1.1.3           | Atomic transactions across features, simple single-VPS operations, and clean peer compatibility                                   |
| A02 | Eleven domain-oriented modules (`apps/api/src/modules`); no Admin megamodule             | Role-prefixed routes stay with the domain module that owns their behavior; see [MODULES.md](MODULES.md)                           |
| A03 | Controllers → services → owning-module TypeORM repositories                              | Clear separation without generic repository wrappers                                                                              |
| A04 | Export services for module collaboration; explicit `EntityManager` for transactions      | Preserves table ownership while keeping checkout, registration, and acceptance atomic                                             |
| A05 | Root business specs (`AKEELA-*.md`) stay canonical; `docs/` links to them                | Single source of truth without duplicating specifications                                                                         |
| A06 | Reviewed migrations only; `synchronize`, `dropSchema`, and `migrationsRun` always false  | Predictable schema evolution; migrations run explicitly via `init` / CLI                                                          |
| A07 | Express adapter, Node 24 LTS, strict TypeScript, npm workspaces with one root lockfile   | Reproducible builds across `apps/{api,restaurant,admin,delivery}` and `packages/{brand,portal}` without Nx/Turborepo              |
| A08 | Shared validated config for app and CLI; verified TLS when enabled                       | Prevents environment drift and unsafe TLS bypasses                                                                                |
| A09 | Node test runner + Supertest + real PostgreSQL/Mailpit integration + Playwright browser  | Real constraint/transaction/race testing without SQLite substitutes                                                               |
| A10 | OpenAPI/Swagger with four role-scoped views (`SWAGGER_ENABLED` opt-in in production)     | Accurate interactive contract for mobile/web clients without separate API docs tooling; see [SWAGGER.md](SWAGGER.md)              |
| A11 | Git-managed Bruno collection (`bruno/AKEELA`) checked by CI (`npm run bruno:check`)      | Requests stay synchronized with feature branches; secrets and runtime tokens remain outside Git                                   |
| A12 | Single Hostinger KVM 2 VPS (`2.25.12.243`, Ubuntu 26.04.1 LTS) with Docker + Caddy HTTPS | Isolates API, PostgreSQL, Caddy, and three static Nginx frontends on `*.akeelaonline.tech`; off-server backup automation deferred |

## Authentication, Sessions & Messaging

- **Tokens & sessions**: HS256 JWT access tokens (`900s` default) validated against live PostgreSQL `auth_sessions` and `users`; `30d` opaque SHA-256 hashed refresh tokens rotated atomically under lock.
- **Passwords & OTP**: New passwords require `8–128` characters with at least one letter and one digit (salted `scrypt`). Email OTPs are 6 random digits, `600s` TTL, max 5 attempts, `60s` resend cooldown.
- **Browser storage**: All three React/Vite/TypeScript Arabic RTL dashboards persist session tokens in tab-scoped `sessionStorage` so page reloads restore login after `/me` verification (no `localStorage`, cookies, or cross-subdomain SSO). Concurrent 401 refreshes coalesce into one rotation.
- **Email & push**: Multi-provider TLS SMTP failover (`MailProvider` — Resend primary + Brevo fallback on `mail.akeelaonline.tech`) with branded RTL HTML + inline CID OTP templates ([GMAIL.md](GMAIL.md)). Realtime order updates use single-instance Socket.IO `/orders` ([REALTIME.md](REALTIME.md)); mobile push uses FCM HTTP v1 ([NOTIFICATIONS.md](NOTIFICATIONS.md)).

## Domain & Business Rules

- **Market timezone & currency**: `Africa/Cairo` for all API timestamp offsets, restaurant opening hours, and operational day filters; `EGP` decimal strings; initial general delivery fee `30.00` (admin-managed delivery fees remain future work).
- **Accounts & activation**: Exactly one CLI-provisioned Admin (`create:admin` / idempotent `init`, never disabled). Pending/Suspended restaurant owners may read account/profile/dashboard and manage passwords, but cannot edit profiles/catalog/images or operate orders. Restaurant service `is_active = false` stops new sales only; existing orders remain manageable while activation is `Active`.
- **Cart & checkout**: Accepts either an owned saved `address_id` or a one-time address (never both). Quotes are informational only (no quote tokens or `checkout_key`); checkout calculates current server prices atomically. Empty carts auto-clear when switching restaurants; repriced overflow carts stay readable/removable.
- **Orders & delivery**: Single always-active delivery company (`DEFAULT_DELIVERY_COMPANY_ID`); missing/unavailable company rejects acceptance (`409`) and keeps `Pending`. Assigning an active owned driver immediately transitions `Accepted → Picked_Up`; driver reassignment is allowed while `Accepted` or `Picked_Up`, and `Picked_Up` orders auto-deliver after 90 minutes.
- **Images**: JPEG/PNG/WebP up to 5 MB, Sharp byte validation/re-encoding to WebP, persistent local volume served via Caddy `/images/*`, plus 24h orphan `.webp` cleanup ([IMAGES.md](IMAGES.md)).
- **Frontend UI & maps**: Shared CSS tokens and brand assets live in `packages/brand`; shared portal client, realtime, session, date-field, error-message, detail-workspace, and logout-confirmation helpers live in `packages/portal`. Restaurant registration/profile use bundled Leaflet + OpenStreetMap tiles with manual coordinate fallback ([DESIGN-SYSTEM.md](DESIGN-SYSTEM.md), [PORTAL-DESIGN.md](PORTAL-DESIGN.md)).
- **Release governance**: Feature PRs target `dev`; `main` promotion and VPS deployments require explicit owner approval and deploy immutable GHCR image digests across all 4 services ([GITHUB-FLOW.md](GITHUB-FLOW.md), [DEPLOYMENT.md](DEPLOYMENT.md)).
