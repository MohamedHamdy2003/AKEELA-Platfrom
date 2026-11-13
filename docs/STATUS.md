# Project Status

## Authorization and current scope

The user approved the foundation, authorized Feature 01 (Authentication and My Profile), Feature 02 (Admin Accounts), Feature 03 (Customer Addresses), and Feature 04 (Restaurant Profile), local PostgreSQL preparation, and deployment-ready templates. Other business features, seeds, and actual VPS provisioning/deployment still require authorization.

## Implemented

- Twelve Feature 01 routes: customer/restaurant registration, email OTP verification/resend, email/password login, JWT refresh/logout, forgot/reset password, GET/PATCH me, and password change.
- Six Feature 02 routes: list accounts with pagination/filtering (`GET /admin/users`), read account and profile (`GET /admin/users/{user_id}`), create Delivery_Company account and profile in one transaction (`POST /admin/users`), toggle account login activity with sole Admin guard (`PATCH /admin/users/{user_id}/activity`), list restaurants for review (`GET /admin/restaurants`), and activate/suspend/reactivate restaurant profile (`PATCH /admin/restaurants/{rest_id}/activation`).
- Five Feature 03 routes: list saved addresses with pagination/ownership (`GET /customer/addresses`), save customer address with coordinates and default address management (`POST /customer/addresses`), update owned address (`PATCH /customer/addresses/{address_id}`), atomically make owned address default (`PUT /customer/addresses/{address_id}/default`), and remove owned saved address (`DELETE /customer/addresses/{address_id}`).
- Three Feature 04 routes: read own restaurant profile (`GET /restaurant/profile`), read restaurant dashboard with activation status and management permission (`GET /restaurant/dashboard`), and update restaurant details and service activity (`PATCH /restaurant/profile`).
- CLI command `npm run create:admin` to bootstrap the sole Admin account.
- Eight identity/profile/auth/address table mappings and two reviewed reversible migrations (`CreateIdentity`, `CreateCustomerAddresses`). Local application database initialized; no fake users seeded there.
- Separate owning-module services, user-first transaction locks, persistent OTP attempts/expiry/cooldown, hashed credentials/codes/tokens, and session revocation checked on protected requests.
- String BIGINT IDs, explicit response/error envelopes, strict DTO allowlists, role-aware profile updates, and current restaurant activation checks.
- Local PostgreSQL and Mailpit, environment validation, setup script generating independent ignored local secrets, and integration tests against actual PostgreSQL/SMTP.
- Dockerfile, production Compose/Caddy templates, production environment example, compiled migration command, non-root runtime, and reserved persistent image storage.

## Not implemented

Features 05–14, including menu categories, products, addons, offers, public catalog, cart, orders, delivery operations, image upload/serving, seeds, OpenAPI, health endpoints, CI/CD, backup automation, or live VPS deployment.

## Decisions confirmed by the user

- PostgreSQL BIGINT IDs are decimal strings in API payloads and JWT subjects.
- Real Gmail SMTP with encrypted connections and Google App Passwords; Mailpit remains isolated automated test mail. Real Gmail connection verification awaits privately supplied credentials.
- Access JWT 15 minutes, refresh session 30 days, OTP six digits for ten minutes, five attempts, resend after 60 seconds. Lifetimes/limits are configurable.
- Passwords are 8–128 characters with at least one letter and one digit; refresh tokens use JSON for now.
- Restaurant registration requires title/address/coordinates/opening hours as in the specification.
- Customer saved addresses are limited to at most 2 per customer (409 Conflict if exceeded). In ordering/checkout, customers may choose one of their saved addresses or specify a one-time delivery address without saving it.
- Restaurant owners can edit their restaurant profile details via `PATCH /restaurant/profile` while Pending or Suspended so they can correct mistakes or address information before or during Admin review. Operational business APIs (categories, products, addons, offers, orders) and shared profile edits (`PATCH /me`) remain blocked with `403 RESTAURANT_NOT_ACTIVE` until the restaurant is Active.
- `GET /restaurant/dashboard` provides `can_manage` (true only when Active, account is active, and email is verified) along with tailored status messages for Pending, Suspended, and Active states.
- Hostinger VPS hosts backend, database, and primary images through separate Docker containers, with Caddy as public HTTPS entry point.

## Verification

- Validation errors now use simple English instructions for phone numbers, passwords, email, OTPs, restaurant details, coordinates, hours, image links, and session refresh. Validation rules and response structure are unchanged.
- Validation-message update: `npm run check` passed, including 24 tests and an HTTP regression test for nested field messages and unknown fields. No database behavior changed.

- PostgreSQL migration applied locally and auth HTTP/SMTP integration flow passed, including concurrent refresh/verification and rollback/reapply in a dedicated test database.
- Local port 5432 was unavailable on Windows; local Compose now defaults to 15432, configurable through LOCAL_POSTGRES_PORT.
- npm run check passed (23 unit/bootstrap/security/password/Gmail configuration tests, lint, formatting, TypeScript, build, and API documentation consistency). All 18 reported PostgreSQL/SMTP integration tests passed, including migration rollback/reapply and entity-versus-schema agreement.
- Docker image built and ran as non-root; container HTTP checks, compiled migration command, writable future image storage, and absence of development CLI passed. Production Compose and Caddy configuration validation passed. These do not test real DNS, certificates, backups, or VPS operation.
- Runtime dependency audit reported zero known advisories at feature verification time.
- The full dependency audit retains previously noted development-tooling advisories. No forced upgrades or unverified dependency overrides are applied.

## GitHub workflow

Remote: https://github.com/MohamedHamdy2003/AKEELA-Platfrom.git. Deployment documentation was merged through its own PR into dev. Feature 01 is developed on feature/email-auth; completed feature PRs target dev. Main receives a release only at the owner's explicit request after a full flow is ready. Merging a PR is not deployment permission.

## Remaining decisions for later features/deployment

- Single currency, constant delivery fee amount, and default company after provisioning.
- Quote-token format/expiry and decimal-safe price calculations before Cart/Checkout.
- Actual SMTP credentials/sender, domain, VPS OS/sizing, production database version and trust settings, and backup destination/retention/restore procedure.
- Upload validation, image access/deletion policy, public URL base, and Caddy-versus-API image serving. Current APIs store image URLs only.
- Browser token storage/transport requirements; shared rate-limit storage before running multiple API instances. Current counters are bounded and process-local for one instance; OTP limits persist in PostgreSQL.

Read AUTH.md for local setup, security choices, testing safety, and implementation boundaries. The four root specifications remain canonical and were updated only where the approved auth decisions required it.

## Auth / Gmail / Bruno release update

- Owner changed new passwords to 8�128 characters with at least one letter and one digit. JWT, refresh, and OTP settings remain unchanged and configurable.
- Added Gmail-specific configuration validation and a real SMTP verification command without sending email. Owner will add credentials later; do not claim real Gmail authentication/delivery was tested yet.
- Added a Git-managed Bruno collection containing the 12 implemented APIs in the Feature 01 folder and 6 APIs in the Feature 02 folder, Local/Production templates, private dotenv values, runtime-only tokens, and route/syntax checks.
- Owner requested a single checkout: open `G:\AKEELA\bruno\AKEELA` in Bruno. The separate testing checkout was removed; collection changes follow the backend branch and normal PR flow.
- Owner explicitly approved promotion of the complete Auth + Bruno release to main. This does not authorize VPS deployment or future main promotions. Future models should read BRUNO.md and GMAIL.md alongside AUTH.md and update only relevant specifications/contracts.

- Current verification: password policy tests cover signup/reset/change inputs, including the eight-character boundary and letter/digit requirements. Real PostgreSQL/Mailpit integration passed using eight-character password change/reset values. All 26 integration tests passed (covering both Feature 01 and Feature 02). Bruno syntax/route parity passed for all 18 requests across Feature 01 and Feature 02. Live Gmail credentials were explicitly deferred by the owner; only local SMTP connectivity can be checked now.
