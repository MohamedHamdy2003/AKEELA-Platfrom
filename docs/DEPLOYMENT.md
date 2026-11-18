# Deployment

## Target and services

Hostinger KVM 2, France; hostname akeela-prod, IPv4 2.25.12.243. Read-only SSH confirmed Ubuntu **26.04.1 LTS** (the earlier 24.04 description was incorrect). Initial access uses root/port 22 and the owner's existing trusted Ed25519 key. Never commit private keys or production environments.

| Service                                      | Public hostname              | Internal port |
| -------------------------------------------- | ---------------------------- | ------------- |
| API, mobile REST/Socket.IO and public images | api.akeelaonline.tech        | 3000          |
| Admin                                        | admin.akeelaonline.tech      | 8080          |
| Restaurant                                   | restaurant.akeelaonline.tech | 8080          |
| Delivery Company                             | delivery.akeelaonline.tech   | 8080          |
| PostgreSQL                                   | Private Docker network only  | 5432          |

One API process, one database, three static Nginx frontends and Caddy. Only Caddy publishes TCP 80/443 and UDP 443. PostgreSQL, images and Caddy certificates use persistent named volumes. Backups are deferred; volumes are not backups.

## First server setup

1. Point all four hostname A records to 2.25.12.243. Use AAAA only with working IPv6. Confirm public DNS and provider firewall access for SSH and web ports before starting ACME. The bare domain is not an application in this release.
2. Review/run deploy/bootstrap-vps.sh as root. It supports Ubuntu 24.04/26.04, installs Docker from its official repository, sets Africa/Cairo and creates trusted deploy user akeela with /opt/akeela/releases. Docker group access is root-equivalent. The script does not change SSH/firewall rules.
3. Install the approved deployment public key for akeela, with a private .ssh directory and mode 600 authorized_keys. Verify a fresh connection before changing administrative access. Do not disable root access automatically.
4. Run npm run prepare:production locally to validate the ignored configuration, populate only missing SMTP fields from apps/api/.env, and quote values safely for Compose without printing secrets. Prepare /opt/akeela/.env.production (mode 600, owner akeela). Locally, .env.production.local is ignored and contains independently generated JWT/OTP/database secrets. The owner fills ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_PHONE and ACME_EMAIL. Gmail settings come from the approved private API configuration. Never print docker compose config or environment values; use config --quiet.
5. Use the same database password in POSTGRES_PASSWORD and the URL-encoded DATABASE_URL. Host is postgres. See [Gmail](GMAIL.md) and [images](IMAGES.md). Never reuse smoke-test credentials.

## One-command startup

From a prepared release directory, with four built/pulled image references and private configuration:

```bash
docker compose -p akeela --env-file /opt/akeela/.env.production --env-file /opt/akeela/images.env -f compose.production.yml up -d --wait --wait-timeout 180
```

Compose waits for PostgreSQL health, runs the one-off init service (all pending migrations, then Admin bootstrap), starts the API after successful init, and starts Caddy after the API and three frontend healthchecks pass. Do not use --wait for public certificate proof; check public HTTPS separately. No synchronize/dropSchema/automatic TypeORM startup migrations are enabled.

Admin bootstrap is idempotent and transactional, guarded by an advisory lock. If any Admin already exists it leaves that account/password/verification untouched, even if provisioning values change or are removed. Only a missing Admin requires valid ADMIN_* values. Init failure prevents API startup. Password reset remains the supported account recovery flow. No company, driver, menu or sample account is seeded.

After Admin login, create the real company, verify its email and set DEFAULT_DELIVERY_COMPANY_ID to its **company profile ID**, then recreate the API. Missing company configuration prevents restaurant acceptance while leaving the order Pending. Do not guess an ID.

Local compose.yml remains the developer PostgreSQL/Mailpit setup. Production uses compose.production.yml; do not expose local Mailpit in production. Build images from the repository root with apps/<app>/Dockerfile. Frontend VITE_API_BASE_URL defaults to /api/v1 and contains no secret.

## Caddy and realtime

Production Caddy explicitly serves the four domains. Each frontend proxies /api/* and /socket.io/* to the API, serves /images/* from the read-only image volume, and sends remaining requests to its static frontend. The API domain proxies the API/socket paths directly. Caddy handles WebSocket upgrades and automatic HTTPS. Frontend CSP allows its own WebSocket host. No DNS record, live certificate or deployment is implied by a validated Caddyfile.

The old sites-enabled/templates files are legacy preparation, not production imports. See [realtime](REALTIME.md) for mobile/browser connections, session expiry and REST recovery. Run one API instance; no Redis adapter or event replay exists.

## CI/CD and release

Feature PRs target dev; main promotion needs the owner's explicit current approval. CI installs once from the root lockfile, checks repository/docs/Bruno, API and all three frontend workspaces, runs PostgreSQL integration and Chromium browser suites, audits runtime packages, and verifies the Docker/Caddy smoke stack for API/shared changes.

A main release publishes four images from the same commit to GHCR: the API repository plus -admin, -restaurant and -delivery suffixes. Deployment uses all four immutable digests together. The consolidated release workflow replaces the former independent Restaurant publish workflow.

| GitHub production setting                | Purpose                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| DEPLOY_ENABLED variable                  | true enables SSH deployment; keep unset before setup |
| VPS_HOST / VPS_USER / VPS_PORT variables | 2.25.12.243 / akeela / 22                            |
| VPS_SSH_KEY secret                       | Dedicated private deployment key                     |
| VPS_KNOWN_HOSTS secret                   | Verified pinned server host-key lines                |

Workflow secrets belong to the production environment. Configuration/credentials stay on the VPS. deploy/release.sh locks releases, validates all digest arguments, pulls images, runs init, validates Caddy, replaces services, and verifies public API HTTPS readiness before recording current/previous release. It records all image references in /opt/akeela/images.env. Deploy assets live in /opt/akeela/releases/<commit>. Failed releases never delete data or automatically revert schema.

## Verify and recover

- npm run smoke:production uses a random disposable Docker project/test database. It builds all images and checks migrations/idempotent Admin bootstrap, local trusted TLS, redirects, static frontends, readiness, public images and image persistence after API recreation. Local CA tests do not prove public ACME issuance.
- Run smtp:check:prod without revealing credentials, then verify inbox delivery with the owner's account. DNS, public TLS and real account flows must be verified after the release.
- For code rollback, inspect schema compatibility and use the previous release with its four recorded image digests. No automatic migration rollback. Preserve persistent volumes; never use production down --volumes.
- Future migrations must remain compatible with the previous running API. Breaking/data-heavy schema changes require a separate plan. No backups, restore tests, load tests or high availability are implemented.

References: [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/), [Caddy HTTPS](https://caddyserver.com/docs/automatic-https).

Current verification: all four A records resolve to 2.25.12.243. Docker/Compose and a dedicated deploy user/key are installed; the owner's existing root SSH settings were preserved. Private configuration is installed mode 600. Application startup, public ACME and Gmail connectivity from the VPS will be recorded in STATUS.md after rollout.
