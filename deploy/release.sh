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
"${compose[@]}" up -d --wait --wait-timeout 90 postgres
mkdir -p "$root/backups"
"${compose[@]}" exec -T postgres pg_dump -U akeela -d akeela | gzip -c > "$root/backups/pre-migration-$sha.sql.gz"
ls -1dt "$root/backups"/pre-migration-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
"${compose[@]}" run --rm --no-deps init
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 admin restaurant delivery
"${compose[@]}" up -d --no-deps caddy
base="$("${compose[@]}" exec -T api node -p 'process.env.PUBLIC_BASE_URL')"
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 "$base/api/v1/health/ready" -o /dev/null
while IFS= read -r frontend_domain; do
 [[ "$frontend_domain" =~ ^[a-zA-Z0-9.-]+$ ]] || exit 1
 curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 "https://$frontend_domain/" -o /dev/null
done < <("${compose[@]}" exec -T caddy printenv ADMIN_DOMAIN VENDOR_DOMAIN DELIVERY_DOMAIN)
if [[ -f "$root/current-release" ]]; then cp "$root/current-release" "$root/previous-release"; fi
if [[ -f "$root/images.env" ]]; then cp "$root/images.env" "$root/previous-images.env"; fi
printf '%s\n%s\n' "$sha" "$image" > "$root/current-release"
printf 'API_IMAGE=%s\nADMIN_IMAGE=%s\nRESTAURANT_IMAGE=%s\nDELIVERY_IMAGE=%s\n' "$image" "$ADMIN_IMAGE" "$RESTAURANT_IMAGE" "$DELIVERY_IMAGE" | tee "$release/images.env" > "$root/images.env"
ls -1dt "$root/releases"/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
docker image prune -f >/dev/null 2>&1 || true
printf 'Release %s passed HTTPS readiness.\n' "$sha"
