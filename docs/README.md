# Documentation Index

Read [root AGENTS.md](../AGENTS.md) first, then the target app instructions below. Use this index to find needed references, not as a requirement to read all documentation.

Monorepo work: read [MONOREPO.md](MONOREPO.md) for app directories, workspace commands, local environment migration and independent build/release boundaries.

## Scoped agent entry points

| App              | Instructions                                              |
| ---------------- | --------------------------------------------------------- |
| Restaurant       | [apps/restaurant/AGENTS.md](../apps/restaurant/AGENTS.md) |
| Admin            | [apps/admin/AGENTS.md](../apps/admin/AGENTS.md)           |
| Delivery company | [apps/delivery/AGENTS.md](../apps/delivery/AGENTS.md)     |
| API              | [apps/api/AGENTS.md](../apps/api/AGENTS.md)               |

App instructions point to the relevant feature sections and controller/DTO locations. Read extra architecture, schema or infrastructure details only when the task needs them.

## Foundation documentation

| Document                           | Read for                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| [STATUS.md](STATUS.md)             | Current implementation, approval gate, unresolved questions, verification |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, runtime, boundaries, transaction design                        |
| [MODULES.md](MODULES.md)           | Feature ownership, table ownership, dependency direction                  |
| [CONVENTIONS.md](CONVENTIONS.md)   | Coding, HTTP, database, security, testing conventions                     |
| [DEVELOPMENT.md](DEVELOPMENT.md)   | Setup, commands, environment, migrations, checks                          |
| [DECISIONS.md](DECISIONS.md)       | Architectural decisions and items deferred to feature work                |

Git operations: read [GITHUB-FLOW.md](GITHUB-FLOW.md) for feature branches, PR targets, and owner-approved releases.

Deployment and image-storage work: read [DEPLOYMENT.md](DEPLOYMENT.md) for the approved Hostinger VPS, Docker, Caddy, persistence and CI/CD; backups are deferred. Image work also requires [IMAGES.md](IMAGES.md).

API testing: [BRUNO.md](BRUNO.md) explains the collection inside this repository and private test values. Email setup: [GMAIL.md](GMAIL.md) explains Gmail App Passwords and the real SMTP connectivity check.

Interactive API reference: [SWAGGER.md](SWAGGER.md) explains UI/OpenAPI JSON, mobile usage and keeping every endpoint documented.

Features 13-14: [ORDER-DELIVERY.md](ORDER-DELIVERY.md). Features 11-12: [CART-ORDERS.md](CART-ORDERS.md). Feature 10: [DELIVERY.md](DELIVERY.md). Review findings: [REVIEW.md](REVIEW.md).

## Canonical business specifications

Authentication implementation: read [AUTH.md](AUTH.md) for approved settings, setup, test safety, and the implemented Feature 01 scope.

These four existing files are included by reference, not duplicated or moved. Edit only when an authorized change requires it.

| Document                                                        | Authority                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| [AKEELA-DB-Design.md](../AKEELA-DB-Design.md)                   | Logical schema, relationships, constraints; not generated SQL |
| [AKEELA-Features.md](../AKEELA-Features.md)                     | Feature order, endpoint inventory, access and business rules  |
| [AKEELA-Responses-Requests.md](../AKEELA-Responses-Requests.md) | Draft request/response examples and payload names             |
| [AKEELA-Flows.md](../AKEELA-Flows.md)                           | Short role journeys and order state transitions               |

The legacy `Rico` title inside the database document refers to AKEELA; it does not name a second product. Payload examples are drafts, not permission to add requirements. Architecture documents describe technical implementation, not new product features.

## Frontend application guides

Restaurant is now implemented locally; see its [run guide](../apps/restaurant/README.md) and the shared [design system](DESIGN-SYSTEM.md). The planning table remains the screen/API guide inventory. Admin and Delivery are not implemented; no public frontend hosting is enabled.

These screen/feature guides describe clients of the existing API. Restaurant is implemented; Admin and Delivery remain planned. The four root specifications remain authoritative for API contracts.

| Application      | Planned frontend origin       | Design guide                                                |
| ---------------- | ----------------------------- | ----------------------------------------------------------- |
| Restaurant       | `https://vendor.akeela.com`   | [Restaurant application](frontend/AKEELA-Restaurant-App.md) |
| Admin            | `https://admin.akeela.com`    | [Admin application](frontend/AKEELA-Admin-App.md)           |
| Delivery company | `https://delivery.akeela.com` | [Delivery application](frontend/AKEELA-Delivery-App.md)     |

The agreed repository layout is `apps/restaurant`, `apps/admin`, `apps/delivery` alongside `apps/api`. Restaurant uses React/Vite, Arabic RTL and tab-scoped sessionStorage sessions. Admin and Delivery use the same stack and session policy. Subdomain DNS/hosting/CORS configuration remains deployment work.

## Resolving changes

1. Identify the owning module and the relevant specification sections.
2. If rules and examples conflict, record the conflict in `STATUS.md`; ask before implementing affected behavior. Do not silently choose a document to override the others.
3. Update the relevant source document and architecture/conventions when an approved decision changes them.
4. Update implementation status and checks. All unimplemented features must remain labeled as planned.
5. Run `npm run docs:check`; keep endpoint method/path inventories aligned in the two API documents.

- [Realtime orders](REALTIME.md): Socket.IO connection, permissions, payload and REST recovery.
- [Admin/Delivery design](PORTAL-DESIGN.md): identity, shared components and checks.

- [Security maintenance](SECURITY.md): reviewed dependency exception and expiry.
