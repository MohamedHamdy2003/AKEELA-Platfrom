# Documentation Index

Read `../AGENTS.md` first. Documentation, not previous conversations, defines the work.

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

Deployment and image-storage work: read [DEPLOYMENT.md](DEPLOYMENT.md) for the approved Hostinger VPS, Docker, Caddy, persistence, and backup plan.

API testing: [BRUNO.md](BRUNO.md) explains the main-branch collection and private test values. Email setup: [GMAIL.md](GMAIL.md) explains Gmail App Passwords and the real SMTP connectivity check.

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

## Resolving changes

1. Identify the owning module and the relevant specification sections.
2. If rules and examples conflict, record the conflict in `STATUS.md`; ask before implementing affected behavior. Do not silently choose a document to override the others.
3. Update the relevant source document and architecture/conventions when an approved decision changes them.
4. Update implementation status and checks. All unimplemented features must remain labeled as planned.
5. Run `npm run docs:check`; keep endpoint method/path inventories aligned in the two API documents.
