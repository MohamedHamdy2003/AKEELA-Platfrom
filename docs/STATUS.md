# Project Status

## Authorization and current scope

The user approved the foundation, authorized Feature 01 (Authentication and My Profile), local PostgreSQL preparation, and deployment-ready templates. Other business features, seeds, and actual VPS provisioning/deployment still require authorization.

## Implemented

- Twelve Feature 01 routes: customer/restaurant registration, email OTP verification/resend, email/password login, JWT refresh/logout, forgot/reset password, GET/PATCH me, and password change.
- Seven identity/profile/auth table mappings and one reviewed reversible migration. Local application database initialized; no fake users seeded there.
- Separate owning-module services, user-first transaction locks, persistent OTP attempts/expiry/cooldown, hashed credentials/codes/tokens, and session revocation checked on protected requests.
- String BIGINT IDs, explicit response/error envelopes, strict DTO allowlists, role-aware profile updates, and current restaurant activation checks.
- Local PostgreSQL and Mailpit, environment validation, setup script generating independent ignored local secrets, and integration tests against actual PostgreSQL/SMTP.
- Dockerfile, production Compose/Caddy templates, production environment example, compiled migration command, non-root runtime, and reserved persistent image storage.

## Not implemented

Features 02–14, including Admin activation/provisioning APIs, restaurant dashboard/profile APIs, addresses, menu management, public catalog, cart, orders, delivery operations, image upload/serving, seeds, OpenAPI, health endpoints, CI/CD, backup automation, or live VPS deployment. Pending restaurant status is available through GET /me; no frontend dashboard is built.

## Decisions confirmed by the user

- PostgreSQL BIGINT IDs are decimal strings in API payloads and JWT subjects.
- Real Gmail SMTP with encrypted connections and Google App Passwords; Mailpit remains isolated automated test mail. Real Gmail connection verification awaits privately supplied credentials.
- Access JWT 15 minutes, refresh session 30 days, OTP six digits for ten minutes, five attempts, resend after 60 seconds. Lifetimes/limits are configurable.
- Passwords are 8–128 characters with at least one letter and one digit; refresh tokens use JSON for now.
- Restaurant registration requires title/address/coordinates/opening hours as in the specification.
- Hostinger VPS hosts backend, database, and primary images through separate Docker containers, with Caddy as public HTTPS entry point.

## Verification

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
- Added a Git-managed Bruno collection containing the 12 implemented APIs in the Feature 01 folder, Local/Production templates, private dotenv values, runtime-only tokens, and route/syntax checks.
- Owner requested a single checkout: open `G:\AKEELA\bruno\AKEELA` in Bruno. The separate testing checkout was removed; collection changes follow the backend branch and normal PR flow.
- Owner explicitly approved promotion of the complete Auth + Bruno release to main. This does not authorize VPS deployment or future main promotions. Future models should read BRUNO.md and GMAIL.md alongside AUTH.md and update only relevant specifications/contracts.

- Current verification: password policy tests cover signup/reset/change inputs, including the eight-character boundary and letter/digit requirements. Real PostgreSQL/Mailpit integration passed using eight-character password change/reset values. Bruno syntax/route parity passed for all 12 requests. Live Gmail credentials were explicitly deferred by the owner; only local SMTP connectivity can be checked now.
