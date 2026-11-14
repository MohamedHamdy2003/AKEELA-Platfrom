# AKEELA Restaurant

Arabic-first React + Vite + TypeScript client for the Restaurant role. Planned origin: `https://vendor.akeela.com`.

Read the root [AGENTS.md](../../AGENTS.md), local [app instructions](AGENTS.md) and [Restaurant design guide](../../docs/frontend/AKEELA-Restaurant-App.md) before work.

Read the [design system](../../docs/DESIGN-SYSTEM.md) for shared tokens, typography, references and component rules.

## Run and verify

From the root, Node 24/npm 11:

```sh
npm ci
npm run dev:restaurant
npm run check:restaurant
npx playwright install chromium
npm run test:e2e --workspace @akeela/restaurant
```

Local URL: `http://127.0.0.1:5173`. Root check also includes Restaurant checks. Browser tests use isolated contract fixtures, never real accounts/database writes; this is not proof of a live authenticated backend journey.

Public `VITE_API_BASE_URL` must include `/api/v1`. Default `/api/v1` uses the development Vite proxy to `http://127.0.0.1:3000`. API startup, migrations, credentials and SMTP remain separate. Production needs an approved HTTPS API/CORS origin or separately configured same-origin proxy. Never put API runtime secrets in browser variables.

## Implemented

Registration, email OTP/resend, login, password recovery/reset, activation, recent and filtered orders/details, accept/reject, paginated categories/products/addons/offers, product-addon links, images, restaurant profile/service hours and owner account/password/logout. Hash routes need no SPA rewrite.

Pending/Suspended owners can read own account/profile/status and use password security. Management stays locked until Active. Stopped service still permits existing-order handling. Refresh is manual; no revenue, staff, branches or customer-phone functionality is invented.

Tokens stay in memory only, per owner choice. Reload requires login. Refresh coordinates concurrent requests in the same page and retries once. No persistent storage, cookies or SSO. Wrong-role login never opens the workspace; password change ends login. The server remains authoritative.

`src/features` owns auth/home/orders/catalog/settings. `components/ui.tsx` provides primitives; `lib` owns HTTP, API response types, Cairo/decimal formatting and cancellable reads. `@akeela/brand` owns reusable tokens/assets; no backend internals are imported.

## Packaging

```sh
docker build -f apps/restaurant/Dockerfile -t akeela-restaurant:local .
```

The image serves static assets on 8080. Use `--build-arg VITE_API_BASE_URL=https://your-approved-api-origin/api/v1` for a separate API host; relative paths require a separately configured proxy. The independent Restaurant workflow checks/types/tests/builds and publishes a commit-tagged GHCR image on future owner-approved main changes. It does not deploy or enable Caddy sites. DNS, certificates, production Compose and backend configuration are unchanged.

## Registration map

Leaflet 1.9.4 is bundled locally; OpenStreetMap tiles load directly over HTTPS when registration opens. Automatic device fixes appear on the map. Clicking/tapping, dragging the pin, arrow-key movement and the manual coordinate fields stay synchronized. Manual selection stops acquisition until explicit retry. This does not correct an inaccurate OS/browser location provider.

The standard public tile service requires visible attribution, normal browser caching and a valid referrer, with no prefetch/bulk download; it has no availability guarantee. See [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). Optional public build-time `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` select an alternative tile provider and its required attribution HTML. Both are accepted as Docker build arguments, like `VITE_API_BASE_URL`; they are not runtime secrets. No Google account/key/billing is required. Existing manual fields remain available when tiles fail.

Browser tests mock tile images and location/API responses; a separate production smoke checks actual tile loading with fixture coordinates, never the owner's real location.
