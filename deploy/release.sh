#!/usr/bin/env bash
set -euo pipefail
image="${1:?Image digest required}"; sha="${2:?Commit SHA required}"
export ADMIN_IMAGE="${3:?Admin image digest required}"
export RESTAURANT_IMAGE="${4:?Restaurant image digest required}"
export DELIVERY_IMAGE="${5:?Delivery image digest required}"
for frontend_image in "$ADMIN_IMAGE" "$RESTAURANT_IMAGE" "$DELIVERY_IMAGE"; do
 [[ "$frontend_image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid frontend image reference.' >&2; exit 1; }
done
[[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ && "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid immutable release reference.' >&2; exit 1; }
root=/opt/akeela; release="$root/releases/$sha"
[[ -f "$root/.env.production" && -f "$release/compose.production.yml" ]] || { echo 'Production environment/release assets are missing.' >&2; exit 1; }
exec 9>"$root/deploy.lock"; flock -w 120 9
chmod 600 "$root/.env.production"
export API_IMAGE="$image"
compose=(docker compose -p akeela --env-file "$root/.env.production" -f "$release/compose.production.yml")
"${compose[@]}" config --quiet
"${compose[@]}" pull api admin restaurant delivery
# Validate Caddy configuration BEFORE mutating the production database schema.
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
"${compose[@]}" up -d --wait --wait-timeout 90 postgres
install -d -m 0700 "$root/backups"
backup_ts="$(date -u +%Y%m%dT%H%M%SZ)"
backup_tmp="$root/backups/.pre-migration-$backup_ts-$sha.sql.gz.tmp"
backup_final="$root/backups/pre-migration-$backup_ts-$sha.sql.gz"
(umask 077 && "${compose[@]}" exec -T postgres pg_dump -U akeela -d akeela | gzip -c > "$backup_tmp")
mv "$backup_tmp" "$backup_final"
ls -1dt "$root/backups"/pre-migration-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
"${compose[@]}" run --rm --no-deps init
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 admin restaurant delivery
"${compose[@]}" up -d --no-deps caddy
base="$("${compose[@]}" exec -T api node -p 'process.env.PUBLIC_BASE_URL')"
[[ "$base" =~ ^https://[a-zA-Z0-9.-]+$ ]] || { echo 'Invalid PUBLIC_BASE_URL.' >&2; exit 1; }
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 "$base/api/v1/health/ready" -o /dev/null
while IFS= read -r frontend_domain; do
 [[ "$frontend_domain" =~ ^[a-zA-Z0-9.-]+$ ]] || exit 1
 curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 "https://$frontend_domain/" -o /dev/null
done < <("${compose[@]}" exec -T caddy printenv ADMIN_DOMAIN VENDOR_DOMAIN DELIVERY_DOMAIN)
current_sha=""
if [[ -f "$root/current-release" ]]; then
 current_sha="$(head -n 1 "$root/current-release" || true)"
 if [[ "$current_sha" != "$sha" ]]; then
  cp "$root/current-release" "$root/previous-release"
  if [[ -f "$root/images.env" ]]; then cp "$root/images.env" "$root/previous-images.env"; fi
 fi
fi
printf '%s\n%s\n' "$sha" "$image" > "$root/current-release"
printf 'API_IMAGE=%s\nADMIN_IMAGE=%s\nRESTAURANT_IMAGE=%s\nDELIVERY_IMAGE=%s\n' "$image" "$ADMIN_IMAGE" "$RESTAURANT_IMAGE" "$DELIVERY_IMAGE" | tee "$release/images.env" > "$root/images.env"
prev_sha=""
if [[ -f "$root/previous-release" ]]; then prev_sha="$(head -n 1 "$root/previous-release" || true)"; fi
while IFS= read -r old_dir; do
 old_name="$(basename "$old_dir")"
 if [[ "$old_name" == "$sha" || ( -n "$prev_sha" && "$old_name" == "$prev_sha" ) ]]; then continue; fi
 rm -rf "$old_dir"
done < <(ls -1dt "$root/releases"/* 2>/dev/null | tail -n +6)
docker image prune -f >/dev/null 2>&1 || true
printf 'Release %s passed HTTPS readiness.\n' "$sha"
