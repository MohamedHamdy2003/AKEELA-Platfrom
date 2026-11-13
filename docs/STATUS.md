# Project Status

## Authorized scope

Features 01-12 are authorized. Features 01-10 were released to main; Features 11-12 are implemented for dev through feature/cart-and-checkout. This change has no authorization to promote to main. No live VPS deployment is authorized.

## Implemented

- 01: email/password signup, email OTP, JWT sessions, password recovery and shared profile.
- 02: Admin account management, restaurant activation and CLI provisioning of the only Admin. API Admin creation and disabling this Admin are blocked.
- 03: owned customer addresses, maximum two, atomic default selection.
- 04: restaurant profile/dashboard; Pending/Suspended owners can correct restaurant details, while operations require Active activation.
- 05-08: owned categories, products, addons/product links and offers.
- 09: public restaurants/menu with visibility and sale-window checks.
- 10: company profile and owned driver management; see [DELIVERY.md](DELIVERY.md).
- Features 11-12 add customer cart, informational totals, current-price checkout, own order queries/history and Pending cancellation; see [CART-ORDERS.md](CART-ORDERS.md).
- 63 API routes, twenty table mappings, one history view, eight reversible migrations and matching Bruno folders.
- Docker/Caddy deployment templates; persistent image storage is reserved, not served.

## Confirmed decisions

- BIGINT IDs are decimal strings. Money remains decimal strings; comparisons use integer cents.
- Passwords: 8-128 characters, including a letter and digit. Configurable defaults: access JWT 15 minutes, refresh 30 days, six-digit OTP 10 minutes/five attempts/60-second resend cooldown.
- One Admin, created by CLI only. Trusted CLI provisions verified email by default; ADMIN_VERIFIED=false uses normal OTP verification.
- Local Gmail connection, TLS and authentication passed. Inbox delivery is not confirmed; automated tests use Mailpit only.
- Single local market: Africa/Cairo. No per-restaurant timezone column.
- Bruno collection stays inside the same project checkout and follows its branch.

- Cart has no business caps; validate INTEGER range and money overflow. No quote tokens, price comparisons, checkout keys or request hashes. Use a saved address or a one-time delivery address.

## Review and verification

See [REVIEW.md](REVIEW.md) for findings, corrections and limits. PostgreSQL integration tests use only a dedicated local database ending in `_test`; they truncate it and roll back/reapply migrations. No application-database migration is applied by this review.

`npm ci` encountered a Windows EPERM directory lock. `npm install --ignore-scripts --no-audit --no-fund` restored dependencies without changing package.json or its lockfile.

## Pending

Features 13-14, uploads, OpenAPI, health endpoints, CI/CD, backup automation and VPS deployment remain unimplemented. The default delivery company remains a Feature 14 decision. EGP and the initial general delivery fee of 30.00 are confirmed; quotes are informational only. Production domain, server sizing, backup retention/restore and client token storage remain open.

Verification: `npm run check` passed (25 tests, lint, formatting, typecheck, build, documentation parity and 63 Bruno requests). The full PostgreSQL/Mailpit suite passed 90 tests, including full migration rollback/reapply and entity/schema agreement. The expanded cart/checkout file separately passed all 13 tests, including quantities above 100, foreign-address ownership, inactive links, and history-preserving constraints. Application database migrations remain unapplied by this task.
