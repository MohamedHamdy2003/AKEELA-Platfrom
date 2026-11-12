# Feature 01 — Authentication and My Profile

Implemented scope: the 12 routes in Feature 01 of the root API documents. Admin provisioning/activation APIs, addresses, catalog, cart, orders, and image upload remain unimplemented.

## Approved decisions

| Item              | Implementation                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| IDs               | PostgreSQL BIGINT and decimal-string API IDs; UUID session IDs                                              |
| Registration      | Customer or Restaurant only; one transaction creates the user, matching profile, and verification challenge |
| Restaurant fields | Required title, address, coordinates, opens_at, closes_at; optional description/mobile image URL            |
| Email             | Generic SMTP from environment; Mailpit captures local mail; no phone OTP                                    |
| Password          | 12–128 characters; salted scrypt N=65536, r=8, p=2; no truncation                                           |
| Access token      | HS256 JWT; 900-second default; issuer, audience, signature, expiry, account and live session checked        |
| Refresh session   | 30-day absolute expiry; opaque random token, SHA-256 hash only in DB; rotate once under lock                |
| OTP               | 6 random digits, purpose/user-bound keyed hash; 600 seconds, 5 attempts, 60-second resend cooldown          |
| Rate limits       | 60 requests/IP and 10/account per 900 seconds on auth routes; configurable, bounded in-memory counters      |
| Images            | Customer avatar and restaurant mobile-image URLs only; no file upload or static storage route               |

Lifetimes and request/OTP limits are environment settings. Password length and six-digit OTP format are part of the API contract. Refresh tokens are currently JSON request/response values, not cookies. Browser storage/CSRF design must be revisited before changing that transport.

Rate limits apply across auth actions and across IPs for the same normalized email. The counters are process-local and reset on restart; this is an explicit single-process initial deployment choice. Persistent OTP attempt/cooldown checks remain in PostgreSQL. Multiple API instances require shared rate-limit storage before scaling. Never log codes or raw tokens.

Auth uses a global APP_GUARD with a common PublicRoute opt-out and CurrentActor decorator. Request context contains only user/session IDs; protected routes do not need reverse module imports or carry password hashes.

## Persistence and transaction behavior

The initial migration creates only seven business/auth tables: users, customer_profiles, restaurant_profiles, delivery_company_profiles, admin_profiles, auth_challenges, and auth_sessions, plus TypeORM's migration tracking table. Company/Admin profiles support the shared `/me` response; their public creation endpoints do not exist.

Owning modules expose services, and Auth orchestrates their calls with an explicit transaction EntityManager. User-row locks come before challenge/session locks. Password changes/resets revoke all sessions under the same user lock used by login/refresh. Failed OTP attempts commit before the API returns an error; successful verification/reset consumes the code atomically. Sending mail happens after commit, outside database locks.

If registration email delivery fails, the account stays saved and the 201 response asks the user to resend after cooldown. Forgot-password and resend return the same generic message for unknown/ineligible accounts. No code is returned in JSON. New OTPs replace the previous challenge and differ from the previous code.

Logout revokes the current session immediately, including existing access JWTs. Refresh uses the remaining absolute session lifetime. Concurrent use of one refresh token has one winner; the other request receives 401. Password change also invalidates pending password-reset challenges.

Pending/Suspended restaurant owners with verified email and active accounts may log in and GET `/me`. PATCH `/me` is denied unless activation is Active, checked from PostgreSQL even for old sessions. Other restaurant dashboard/profile/activation routes belong to later features.

## Local setup

```sh
npm ci
npm run setup:local
docker compose up -d postgres mailpit
npm run migration:run
npm run start:dev
```

`setup:local` generates separate local secrets and never overwrites an existing `.env`. PostgreSQL is on localhost:15432 (override `LOCAL_POSTGRES_PORT` and DATABASE_URL together). SMTP is localhost:11025; Mailpit UI is [localhost:18025](http://localhost:18025). Mailpit is for local testing only.

Register a customer through `POST /api/v1/auth/register`, read its code in Mailpit, verify through `/auth/verify-email`, then log in through `/auth/login`. Use `Authorization: Bearer <access_token>` for `/me`. See the root request/response file for payloads; do not store tokens in documentation.

## Tests

```sh
npm run check
docker compose exec -T postgres createdb -U akeela akeela_auth_test
npm run test:integration
```

Create the test database once; `createdb` reports an error if it already exists. `TEST_DATABASE_URL` must name a dedicated local database ending in `_test`. Integration tests truncate/recreate only that database's auth tables, verify rollback/reapply, and use actual SMTP delivery to local Mailpit. They override SMTP to localhost and never send through production SMTP. Do not run concurrent integration suites against the same database.

Tests cover validation, roles/profiles, duplicate rollback, OTP expiry/attempts/reuse, concurrent verification/refresh, JWT checks, logout, password change/reset, account/restaurant activation checks, BIGINT precision, database constraints, SMTP failure, and migration reversibility.

## Deployment readiness

- Dockerfile builds a compiled, non-root runtime with production dependencies only. No secrets or image files are baked into it.
- Production Compose connects API and PostgreSQL privately, exposes only Caddy HTTP/HTTPS, and persists PostgreSQL/images/Caddy state. Image storage is reserved but not publicly served.
- `TRUST_PROXY=true` trusts exactly one Caddy hop; keep the API unpublished so clients cannot bypass the proxy or spoof rate-limit IPs.
- Production SMTP requires TLS. JWT and OTP keys must be different random secrets of at least 32 characters. No built-in production fallback secrets exist.
- `npm run migration:run:prod` runs compiled migrations explicitly. Application startup never runs them.
- These templates have not been deployed to a VPS; domain, actual SMTP settings, backups, server sizing, and release authorization are still required. See [DEPLOYMENT.md](DEPLOYMENT.md).
