# Code and Production Review

Scope: source, API contracts, authorization, migrations, decimal handling, public visibility, concurrency, and PostgreSQL integration tests. Review is not a guarantee that software has no defects.

## Fixed

- Public restaurants now require an active, email-verified owner. Public products hide inactive categories, including product details.
- Public restaurant persistence moved into Restaurants; Catalog uses its exported service.
- Customer address writes lock the customer profile so concurrent requests cannot exceed two addresses or race when selecting a default.
- Category writes lock the owning restaurant before checking normalized title uniqueness.
- Product-addon PUT locks its product so simultaneous first-link requests are idempotent.
- Catalog money stays in decimal strings. Offer comparisons use integer cents; DTOs bound amounts to numeric(12,2).
- Route IDs reject malformed and overflowing BIGINT values before PostgreSQL queries.
- Opening status uses Africa/Cairo explicitly, independent of the server timezone. No per-restaurant timezone field was added.
- CLI Admin creation is serialized. Owner confirmed exactly one CLI-created Admin; API creation and disabling of this account remain blocked.
- Migration rollback tests discover all applied migrations rather than assuming a fixed count.
- Updated stale implementation docs and added Feature 10 routes, schema, tests, and Bruno requests.

## Limits

Features 01-16 are implemented and reviewed. Actual VPS deployment, backups and load testing remain pending. SMTP integration tests use Mailpit. Gmail connection/authentication was verified separately; that does not prove inbox delivery.

Public restaurant listing currently obtains eligible owner IDs through Users before querying Restaurants. This preserves ownership boundaries; revisit query performance if the restaurant count grows substantially.

PostgreSQL input-format/range errors return a safe 422 instead of an internal error, without exposing SQL or input values.

## Production fixes

- UTC storage with explicit Africa/Cairo API offsets and timezone-aware offer input; reject impossible calendar dates.
- Pending/Suspended profile edits blocked. Catalog writes lock/recheck activation so a concurrent suspension wins before mutation.
- Nested registration/Admin profile arrays produce 422 before persistence.
- Overflow caused by later catalog price increases no longer traps cart reads/removals. Checkout and additions/edits still reject storage overflow.
- Real byte-validated uploads, metadata removal, safe UUID filenames and domain ownership checks; no schema change.
- Caddy TLS/proxy/images/persistence verified with isolated Docker smoke. Production liveness/readiness and time-bounded database probes added.
- CI/CD and immutable releases prepared. Live ACME/SSH/Hostinger setup awaits real infrastructure. Image cleanup and backup automation are not implemented.
