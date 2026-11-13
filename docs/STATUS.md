# Project Status

## Authorized scope

Features 01-10 and their review/corrections are authorized and implemented. The owner requested this release to main. Future business features and main promotions still require authorization. No live VPS deployment is authorized.

## Implemented

- 01: email/password signup, email OTP, JWT sessions, password recovery and shared profile.
- 02: Admin account management, restaurant activation and CLI provisioning of the only Admin. API Admin creation and disabling this Admin are blocked.
- 03: owned customer addresses, maximum two, atomic default selection.
- 04: restaurant profile/dashboard; Pending/Suspended owners can correct restaurant details, while operations require Active activation.
- 05-08: owned categories, products, addons/product links and offers.
- 09: public restaurants/menu with visibility and sale-window checks.
- 10: company profile and owned driver management; see [DELIVERY.md](DELIVERY.md).
- 53 API routes, fourteen table mappings, six reversible migrations and matching Bruno folders.
- Docker/Caddy deployment templates; persistent image storage is reserved, not served.

## Confirmed decisions

- BIGINT IDs are decimal strings. Money remains decimal strings; comparisons use integer cents.
- Passwords: 8-128 characters, including a letter and digit. Configurable defaults: access JWT 15 minutes, refresh 30 days, six-digit OTP 10 minutes/five attempts/60-second resend cooldown.
- One Admin, created by CLI only. Trusted CLI provisions verified email by default; ADMIN_VERIFIED=false uses normal OTP verification.
- Local Gmail connection, TLS and authentication passed. Inbox delivery is not confirmed; automated tests use Mailpit only.
- Single local market: Africa/Cairo. No per-restaurant timezone column.
- Bruno collection stays inside the same project checkout and follows its branch.

## Review and verification

See [REVIEW.md](REVIEW.md) for findings, corrections and limits. PostgreSQL integration tests use only a dedicated local database ending in `_test`; they truncate it and roll back/reapply migrations. No application-database migration is applied by this review.

`npm ci` encountered a Windows EPERM directory lock. `npm install --ignore-scripts --no-audit --no-fund` restored dependencies without changing package.json or its lockfile.

## Pending

Features 11-14, uploads, OpenAPI, health endpoints, CI/CD, backup automation and VPS deployment remain unimplemented. Before cart/checkout, confirm currency, delivery fee, quote format/expiry and default delivery company. Production domain, server sizing, backup retention/restore and client token storage remain open.

Verification: `npm run check` passed (25 tests, lint, formatting, typecheck, build, documentation parity and 53 Bruno requests). The full PostgreSQL/Mailpit suite passed 78 tests; the final category concurrency correction is verified separately.
