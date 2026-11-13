# Hostinger VPS Deployment

One Hostinger VPS runs Caddy, NestJS and PostgreSQL in separate Docker containers. The VPS has not been purchased or provisioned. Real DNS, certificates, capacity and SMTP delivery need verification on that server. Backup automation is deferred by the owner.

## Layout

```text
Internet :80/:443 -> Caddy -> api:3000 -> postgres:5432
                      |
                  /images/*
                      |
                images volume (read-only for Caddy)
```

Only Caddy publishes application ports. PostgreSQL uses an internal network. Named volumes preserve database data, images and Caddy certificates. Never use `docker compose down --volumes` on production. Only the randomly named smoke-test project removes its own test volumes.

## Prepare the new VPS

1. Buy an x86-64 Ubuntu 24.04 LTS VPS. Size memory for PostgreSQL and the API; confirm capacity with traffic measurements. Build images in GitHub, not on the VPS.
2. Review/copy `deploy/bootstrap-vps.sh`, then run `sudo bash bootstrap-vps.sh akeela` on the new server. It installs Docker from the official repository, creates the deploy user and `/opt/akeela/releases`, and sets Africa/Cairo. It does not deploy an application, change SSH authentication or enable a firewall.
3. Add the deployment public key to `/home/akeela/.ssh/authorized_keys` (owner akeela, mode 600). The Docker group grants this trusted user root-equivalent access.
4. Allow SSH from administration/runner sources and TCP 80/443 plus UDP 443 through Hostinger's firewall. Never expose 3000/5432. Docker-published ports need provider/host firewall rules; do not rely on UFW alone.
5. Point the API domain A record to the VPS. Add AAAA only with working IPv6. Public HTTPS needs reachable ports and correct DNS.
6. Copy `.env.production.example` to `/opt/akeela/.env.production`, owned by akeela, mode 600. Enter real values there, never in Git. Use independent random JWT/OTP keys. URL-encode the database password in DATABASE_URL and use the same raw password in POSTGRES_PASSWORD. DATABASE_URL host is `postgres`.
7. Configure Gmail App Password SMTP through [GMAIL.md](GMAIL.md). Set DEFAULT_DELIVERY_COMPANY_ID to the verified company profile ID before accepting orders. Deployment never seeds a company/Admin.

## GitHub CI/CD

[GitHub flow](GITHUB-FLOW.md) keeps feature PRs on dev and requires owner approval for main. CI checks PRs/dev with npm ci, lint/format/types/unit/build/docs/Bruno, actual PostgreSQL/Mailpit integration, runtime dependency audit, shell syntax and Docker/Caddy smoke tests. CI has no production secrets.

Main releases run these checks, build and publish `ghcr.io/mohamedhamdy2003/akeela-platfrom:<commit>`, then optionally deploy its immutable SHA256 digest. Publication requires Actions/package permissions. Configure these after the server is ready:

| Setting         | Location                      | Value                                                       |
| --------------- | ----------------------------- | ----------------------------------------------------------- |
| DEPLOY_ENABLED  | Repository variable           | `true` enables deployment; unset skips it                   |
| VPS_HOST        | Repository variable           | Server hostname or IPv4                                     |
| VPS_USER        | Repository variable           | `akeela`                                                    |
| VPS_PORT        | Repository variable           | SSH port, normally `22`                                     |
| VPS_SSH_KEY     | Production environment secret | Private deployment key                                      |
| VPS_KNOWN_HOSTS | Production environment secret | Verified host-key line; use `[host]:port` for a custom port |

Create GitHub environment `production`; add reviewer protection if desired. Verify the SSH fingerprint through Hostinger's console. The workflow requires a pinned key, never accepts an unknown key automatically, and uses a temporary GitHub token for GHCR over SSH, logging out afterward.

Release assets go to `/opt/akeela/releases/<commit>`. `deploy/release.sh` locks deployments, pulls the immutable image, starts PostgreSQL, explicitly runs migrations, validates Caddy, replaces API/Caddy and checks public HTTPS readiness. It records current/previous successful releases. Credentials stay in `/opt/akeela/.env.production`.

After the first deployment, manually provision the only Admin with `create:admin:prod`; see [AUTH.md](AUTH.md). Run `smtp:check:prod`, then verify inbox delivery with your own account. These are manual tasks, not CI seeds.

## Images and health

Read [IMAGES.md](IMAGES.md). Compose sets PUBLIC_BASE_URL from `https://${APP_DOMAIN}` and IMAGE_STORAGE_PATH to `/app/storage/images`. Caddy serves `/images/*` through its read-only volume; other requests reach the API. Local API serves the same image path. Existing external HTTP(S) image URLs remain supported; no server-side download occurs.

Public `/api/v1/health/live` checks the process. `/api/v1/health/ready` also runs SELECT 1 and returns 503 without database details on failure. Compose and Caddy use readiness.

## Verification and recovery

- `npm run smoke:production` builds an isolated deployment, runs migrations on its own test database, trusts Caddy's local CA, verifies HTTPS/redirect/proxy/images, recreates the API and verifies image persistence. This does not prove public ACME issuance.
- Inspect workflow logs and Compose logs on the VPS. Never publish secrets or environment dumps.
- Failed releases stop without marking success. No automatic migration rollback or data deletion occurs. Inspect the failure before retrying.
- Code rollback: verify schema compatibility, authenticate to GHCR with a temporary read-packages credential if needed, then run the previous release script with its recorded digest/commit. Migration rollback needs a reviewed recovery plan; never revert automatically.
- Backups, restore tests, load tests and high availability are unimplemented. Persistent volumes are not backups; backup work is explicitly deferred.

References: [Caddy HTTPS](https://caddyserver.com/docs/automatic-https), [file serving](https://caddyserver.com/docs/caddyfile/directives/file_server), [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), [GitHub image publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

Schema migrations run before replacing the API. Keep them compatible with the previous running version; plan separate maintenance for any future breaking/data-heavy migration. Database statements have a 10-second timeout and connection acquisition a 5-second timeout; review these for future long-running migrations.
