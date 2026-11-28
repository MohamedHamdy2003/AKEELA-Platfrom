# Project Status

## Policy and Release Control

Current owner policy: integrate completed changes into `dev` only. Promotion to `main` and VPS deployment require a fresh explicit owner request; earlier release records below do not authorize future deployments.

## Implemented Scope

- **Backend API (`apps/api`)**: NestJS modular monolith, PostgreSQL 17, TypeORM (`11` domain modules, `21` entity tables, `1` history view, `14+` reviewed migrations, `96` REST endpoints across Features `01–18` plus public search `GET /api/v1/search` and smart-ranked home offers feed `GET /api/v1/offers`).
  - Features `01–10`: Auth/OTP/JWT sessions, Admin users & restaurant review, Customer addresses, Restaurant profile/dashboard, Catalog (categories with contiguous `1..N` swap ordering, unlinked product/addon pool & permanent deletions, offers with automatic expiration), Public restaurant menu & global search/offers feed, Delivery Company & drivers.
  - Features `11–14`: Cart/quote/checkout (`EGP`, `30.00` delivery fee), order history, Restaurant accept/reject, Delivery Company driver assignment (immediately transitions `Accepted → Picked_Up`, allows driver reassignment while `Picked_Up`), idempotent pickup, delivery, 90-minute auto-deliver scheduler, Admin failure, single-query order status counts, and Cairo-windowed analytics dashboards for Admin, Delivery Company, and Restaurant (with 20s coalescing cache).
  - Features `15–18`: Sharp WebP image uploads with 24h orphan cleanup, public health probes, room-scoped Socket.IO realtime order notifications (`/orders`), and Firebase Cloud Messaging (FCM HTTP v1) device token management & push notifications.
  - Operational tooling: Multi-provider SMTP failover (`MailProvider` + `SMTP_FALLBACK_*`..`5_*`), branded RTL HTML + CID OTP email templates, OpenAPI/Swagger with 4 role views (`Customer`: 41, `Restaurant`: 45, `Admin`: 28, `Delivery Company`: 27), Bruno collection (`96` requests across 17 folders `01–16` and `18`), and local demo seeder (`npm run seed:demo-restaurants`).
- **Web Dashboards (`apps/admin`, `apps/restaurant`, `apps/delivery`)**: Three React/Vite/TypeScript Arabic RTL dashboards using HTML5 History path routing, tab-scoped `sessionStorage` sessions, Socket.IO realtime order updates, analytics dashboards, shared brand tokens/assets (`packages/brand`), and shared portal/session/realtime/dialog helpers (`packages/portal`).
- **Production Deployment (`deploy/`, `compose.production.yml`, `.github/workflows/`)**:
  - Live on Hostinger KVM 2 (`2.25.12.243`, Ubuntu 26.04.1 LTS) across `api.akeelaonline.tech`, `admin.akeelaonline.tech`, `restaurant.akeelaonline.tech`, and `delivery.akeelaonline.tech` via Docker Compose, Caddy automatic HTTPS, and non-root containers.
  - Automated CI verification (`.github/workflows/ci.yml`), GHCR 4-image immutable-digest release workflow (`.github/workflows/release.yml` + `deploy/release.sh` with pre-migration `pg_dump`), and 15-minute uptime monitoring (`.github/workflows/uptime.yml`).
  - Production email delivery verified on `mail.akeelaonline.tech` with Resend (primary) + Brevo (fallback).
  - `SWAGGER_ENABLED=true` remains active in production during the mobile testing window until the owner requests disabling it.

## Pending / Deferred Decisions

- **Off-server backup automation**: Deferred by the owner; `deploy/release.sh` creates local pre-migration dumps on the VPS, but remote/off-server backup scheduling is not yet configured.
- **Home Offers Feed `sort` parameter**: Intentionally deferred as a future feature; `GET /api/v1/offers` uses the smart composite ranking + restaurant diversity algorithm exclusively.
- **Security dependency exception**: Temporary `picomatch` (`GHSA-fc5q-39xc-vjpf`) exception in `scripts/audit-runtime.mjs` / [SECURITY.md](SECURITY.md) expires `2026-12-18 UTC`.
- **Unpromoted `dev` work**: Global Home Offers Feed (`GET /api/v1/offers`), `docs/SEARCH.md`, and repository cleanup/performance/reliability improvements remain on `dev` awaiting explicit owner approval for `main` promotion and VPS deployment.
