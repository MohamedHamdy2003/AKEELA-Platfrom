# Architecture Decisions

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

## Approved hosting decision — implementation pending

- A12: One Hostinger VPS hosts the NestJS backend, PostgreSQL, and primary image files.
- A13: Docker containers separate the services; Caddy handles public routing and HTTPS/certificate management.
- A14: Persistent volumes hold database data, images, and Caddy state. Database and image backups must also be kept outside the VPS.
- These choices do not introduce microservices or approve production provisioning. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Deferred; no implementation permission implied

- Feature 01 mappings, initial migration, and 12 endpoints are implemented. Other schema changes, endpoints, and seeds remain deferred.
- Response/error mapping is implemented; OpenAPI generation remains deferred.
- Confirmed auth choices: decimal-string IDs, SMTP with local Mailpit, HS256 JWT/live DB sessions, JSON refresh tokens, 15-minute/30-day token lifetimes, six-digit/10-minute OTP with five attempts and 60-second cooldown, and 8–128 character passwords with at least one letter and one digit. See `AUTH.md`. Production SMTP credentials, browser token storage, and future shared rate-limit storage remain deployment/client decisions.
- Cart quotes are informational only. At checkout use current server prices directly; no quote tokens, expiry, or reviewed-total comparison.
- Currency EGP and initial general delivery fee 30.00 are confirmed. The default delivery company remains a Feature 14 decision.
- Image storage location is approved: a persistent volume on the Hostinger VPS. Upload APIs, validation, permissions, image-serving method, and URL conventions still need specifications before implementation.
- Source hosting is GitHub (`MohamedHamdy2003/AKEELA-Platfrom`). Feature PRs target `dev`; release PRs from `dev` to `main` require explicit owner instruction. See `GITHUB-FLOW.md`. CI workflows, branch protection, and deployment are not configured yet.

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
