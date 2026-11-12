# Architecture Decisions

Status: foundation choices below are implemented for review; business choices are deferred. Update this file when changing an architectural convention, with the reason and consequences.

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

- Entity classes, initial migrations, seeds, and every business endpoint.
- Response/error adapters and OpenAPI generation: implement from the API contract with the first approved feature, not by inferring routes from empty modules.
- Email provider, OTP hashing configuration, JWT signing approach, token lifetimes, rate limits, refresh-token transport/storage, and browser security details.
- Quote format: signed opaque token is proposed in the request/response document; final design and expiry still require confirmation before Cart/Checkout.
- Delivery fee, currency, and default delivery company settings: requirements exist but values are not specified.
- Image storage location is approved: a persistent volume on the Hostinger VPS. Upload APIs, validation, permissions, image-serving method, and URL conventions still need specifications before implementation.
- Source hosting is GitHub (`MohamedHamdy2003/AKEELA-Platfrom`). Feature PRs target `dev`; release PRs from `dev` to `main` require explicit owner instruction. See `GITHUB-FLOW.md`. CI workflows, branch protection, and deployment are not configured yet.

Official references used for foundation choices: [Nest modules](https://docs.nestjs.com/modules), [configuration](https://docs.nestjs.com/techniques/configuration), [validation](https://docs.nestjs.com/techniques/validation), and [TypeORM DataSource options](https://typeorm.io/docs/data-source/data-source-options/). Installed versions and lockfile are authoritative for the APIs available in this project; avoid copying incompatible newer examples.
