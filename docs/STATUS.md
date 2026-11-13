# Project Status

## Authorized scope

Features 01-14, production fixes, images, health, CI/CD and Hostinger preparation are authorized. The owner requested promotion of this complete change to main. The VPS has not been purchased; real provisioning, DNS, certificates and deployment remain pending. Backup automation is deferred by the owner.

## Implemented

| Scope                                                                 | State                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 01-04: Auth, Admin, customer addresses, restaurant profile/activation | Implemented                                                                                            |
| 05-10: Catalog, addons, offers, public menu, company/drivers          | Implemented                                                                                            |
| 11-14: Cart, checkout/history, restaurant order handling/delivery     | Implemented                                                                                            |
| 15: Customer/restaurant/product/offer images and public URLs          | Implemented                                                                                            |
| 16: Public liveness/readiness                                         | Implemented                                                                                            |
| PostgreSQL                                                            | Twenty table mappings, one history view, eight reversible migrations; no schema change in this release |
| API collection                                                        | 81 routes in specifications and matching Bruno folders                                                 |
| Docker/Caddy                                                          | Persistent images/database/certificates, private API/database; local TLS smoke verified                |
| CI/CD                                                                 | PR checks, main GHCR publication, optional pinned-SSH deployment; deployment disabled until configured |

## Current rules

- IDs/money are decimal strings. Passwords: 8-128 characters, a letter and digit. Auth settings: [AUTH.md](AUTH.md).
- One CLI-created Admin and one always-active company. DEFAULT_DELIVERY_COMPANY_ID is optional at startup but required to accept orders.
- EGP, initial delivery fee 30.00. No quote tokens, price comparisons, checkout keys/hashes or cart business caps. Checkout uses current prices.
- Pending/Suspended restaurants may authenticate and read account/profile/dashboard, but cannot modify account/profile/catalog/images or handle orders. Password security operations remain available. Service is_active=false stops new sales only while activation stays Active.
- Catalog writes recheck activation under transaction locks. Nested profile arrays are rejected before business work. Offer timestamps require explicit Z/offset and valid calendar dates.
- PostgreSQL stores UTC instants; API timestamps use Africa/Cairo and its current offset. Restaurant hours are Cairo times. Over-limit repriced carts remain readable/removable; checkout/additions/edits enforce numeric storage limits.
- Gmail authentication was verified earlier. Tests use Mailpit; production inbox delivery needs server verification.

## Pending

- Buy/provision VPS, choose domain, configure DNS/private environment/SSH secrets and DEPLOY_ENABLED, then verify real HTTPS/Gmail.
- Backup/restore automation explicitly deferred. OpenAPI, future delivery-fee Admin API, image cleanup, load testing and client token storage remain unimplemented.
- No application-database migrations/seeds run in this task. Tests truncate only the dedicated local `_test` database.

## Verification

Docker smoke passed trusted local TLS, HTTP redirect, reverse proxy readiness, WebP serving and image persistence after API recreation. `npm run check` passed (27 unit tests, lint, formatting, types, build, docs and 81 Bruno requests). The full PostgreSQL/Mailpit suite passed 111 tests; the final changed cart/image/profile cases passed another targeted run of 28 tests. Runtime audit reports zero vulnerabilities. Workflow validation (actionlint), Bash syntax and production Caddy validation passed. See [REVIEW.md](REVIEW.md).
