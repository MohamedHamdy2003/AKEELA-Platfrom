#!/usr/bin/env bash
set -euo pipefail
image="${1:?Image digest required}"; sha="${2:?Commit SHA required}"
[[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ && "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid immutable release reference.' >&2; exit 1; }
root=/opt/akeela; release="$root/releases/$sha"
[[ -f "$root/.env.production" && -f "$release/compose.production.yml" ]] || { echo 'Production environment/release assets are missing.' >&2; exit 1; }
exec 9>"$root/deploy.lock"; flock -w 120 9
chmod 600 "$root/.env.production"
export API_IMAGE="$image"
compose=(docker compose -p akeela --env-file "$root/.env.production" -f "$release/compose.production.yml")
"${compose[@]}" config --quiet
"${compose[@]}" pull api
"${compose[@]}" up -d --wait --wait-timeout 90 postgres
"${compose[@]}" run --rm --no-deps api npm run migration:run:prod
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api
"${compose[@]}" up -d --no-deps caddy
base="$("${compose[@]}" exec -T api node -p 'process.env.PUBLIC_BASE_URL')"
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 "$base/api/v1/health/ready" -o /dev/null
if [[ -f "$root/current-release" ]]; then cp "$root/current-release" "$root/previous-release"; fi
printf '%s\n%s\n' "$sha" "$image" > "$root/current-release"
printf 'Release %s passed HTTPS readiness.\n' "$sha"
