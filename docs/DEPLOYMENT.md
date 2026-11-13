# Deployment Plan

**Approved target: one Hostinger VPS for the backend, PostgreSQL, and image files, using Docker and Caddy.** This is a documented deployment decision, not a running deployment or permission to provision infrastructure.

## Layout

```text
Internet
   |
   v
Caddy container — HTTPS and reverse proxy
   |
   v
NestJS container — one modular monolith
   |
   v
PostgreSQL container — one database

Persistent storage on the same VPS:
- PostgreSQL data
- Uploaded image files
- Caddy certificate data and state

Backups: stored outside this VPS
```

## Service boundaries

| Component        | Responsibility                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Hostinger VPS    | Host all application services and primary image/database storage.                                                  |
| Docker / Compose | Run and connect separate Caddy, backend, and PostgreSQL containers on one host.                                    |
| Caddy            | Public HTTP/HTTPS entry point, request routing, TLS certificate issuance and renewal, and HTTP-to-HTTPS redirects. |
| NestJS           | Business APIs and future authorized image-upload handling.                                                         |
| PostgreSQL       | Application data; accessible to the backend over the private Docker network.                                       |
| Image volume     | Persistent image files; database URL fields reference served images, not binary database content.                  |

## Persistence and networking

- PostgreSQL data, image files, and Caddy state must survive container recreation through persistent volumes.
- Do not store uploaded files in the application image or a container's disposable writable layer.
- Only Caddy publishes application HTTP/HTTPS ports. Do not expose the backend or PostgreSQL directly to the public internet. SSH administration is configured separately.
- Connect containers using Docker service names, not fixed container IP addresses. A container's `localhost` refers to itself, not another service.
- Public HTTPS needs an actual domain, correct DNS, reachable challenge ports, and persistent Caddy certificate storage. Certificate issuance is not assumed to work before these are configured.
- Caddy terminates public HTTPS; PostgreSQL TLS remains a separate database-connection decision. Do not disable certificate verification to make a connection work.
- Keep production credentials and signing keys outside the repository and container image. Supply them through server-side runtime configuration.

## Images

- Store primary image files locally on the VPS in a persistent volume.
- Keep filesystem paths separate from public URLs, and build URLs from a configured public base URL rather than hard-coded hostnames.
- Image upload endpoints, allowed formats/sizes, ownership checks, deletion policy, and URL paths are not specified yet. Do not invent or implement them during foundation work.
- Whether Caddy serves approved public image files directly through a read-only mount or proxies image requests to NestJS will be decided before image handling is implemented. Private/unapproved files must not become public through a static file route.

## Backup and release expectations

- Back up the database and image files outside the VPS; same-host volumes are persistence, not disaster recovery.
- Use database-consistent backups and document a restore procedure. Confirm retention, schedule, destination, access, and restore testing before production.
- Rebuild/replace containers without deleting persistent volumes. Do not run volume-removal or destructive reset commands against production data.
- Run reviewed migrations as an explicit authorized release step; never enable TypeORM automatic schema changes.
- Follow [GitHub flow](GITHUB-FLOW.md): feature PRs go to `dev`; promotion to `main` requires the owner's explicit instruction. A push or merge does not itself authorize deployment.

## Current implementation and remaining inputs

Local Compose provides PostgreSQL and Mailpit. Dockerfile, compose.production.yml, deploy/Caddyfile, and .env.production.example now provide deployment-ready templates for Feature 01. The runtime uses a non-root user and production dependencies only. Backend and database have no published production ports. Image storage is reserved in a volume, without an upload API or public static route. No backup jobs, real DNS/certificates, CI/CD, or VPS resources have been configured.

## Production preparation — templates only

Copy .env.production.example to an ignored server-side .env.production and set the real domain, Gmail SMTP values, independent random keys, and database password. Follow GMAIL.md and run smtp:check:prod inside the configured runtime before accepting OTP traffic. DATABASE_URL uses hostname `postgres`, not localhost; URL-encode its password consistently with POSTGRES_PASSWORD. Caddy reads APP_DOMAIN and ACME_EMAIL; Express trusts one proxy hop only in this private topology.

After explicit deployment authorization, the release order is: build the API image; start PostgreSQL and wait for health; run a one-off API container with `npm run migration:run:prod`; start API and Caddy. Use compose.production.yml with the server-side environment file for each step. Never use example credentials in production.

Public image serving remains undecided and is not enabled in the Caddyfile. Profile image fields store HTTP(S) URLs, not server filesystem paths. Define upload validation and public base URL handling when that feature is authorized. Container checks do not test live TLS/DNS, backups, or VPS capacity and are not production deployment approval.

Before deployment, confirm the domain, VPS operating system/resources, image-serving approach, production PostgreSQL version, backup destination/policy, and release procedure. The single VPS is a shared failure point; this plan does not claim high availability.

References: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Docker volumes](https://docs.docker.com/engine/storage/volumes/), and [Compose networking](https://docs.docker.com/compose/how-tos/networking/).

Order assignment: production Compose passes DEFAULT_DELIVERY_COMPANY_ID. Set the real company profile ID (not user ID), verify its account email, and keep service/account active. Empty configuration does not prevent startup, but restaurant acceptance returns 409 and keeps Pending until configured. No actual company is provisioned or selected by deployment templates.
