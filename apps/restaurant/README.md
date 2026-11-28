# AKEELA Restaurant

Arabic-first React + Vite + TypeScript client for the Restaurant role. Production origin: `https://restaurant.akeelaonline.tech`.

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

Registration, email OTP/resend, login, password recovery/reset, activation, kitchen analytics (`GET /restaurant/analytics`), realtime Socket.IO order updates, recent and filtered orders/details, accept/reject, paginated categories/products/addons/offers (including swap ordering and unlinked pool deletions), product-addon links, WebP image uploads, restaurant profile/service hours and owner account/password/logout. Uses HTML5 History path routing with Nginx `try_files` SPA fallback.

Pending/Suspended owners can read own account/profile/status and use password security. Management stays locked until Active. Stopped service still permits existing-order handling.

Tokens use tab-scoped sessionStorage, per the current owner request. Reload checks /me and restores login. Refresh coordinates concurrent requests in the same page and retries once. No localStorage tokens, cookies or SSO. Wrong-role login never opens the workspace; password change ends login. The server remains authoritative.

`src/features` owns auth/analytics/orders/catalog/settings. `components/` provides primitives and lazy-loaded Leaflet map; `lib` owns HTTP, API response types, Cairo/decimal formatting and cancellable reads. `@akeela/brand` owns reusable tokens/assets and `@akeela/portal` provides shared realtime, session-storage, date-field, error-message, and logout-confirmation helpers; no backend internals are imported.

## Packaging

```sh
docker build -f apps/restaurant/Dockerfile -t akeela-restaurant:local .
```

The image serves static assets on port `8080`. Use `--build-arg VITE_API_BASE_URL=https://your-approved-api-origin/api/v1` for a separate API host; the default relative `/api/v1` works behind Caddy's same-origin proxy. The consolidated CI/release workflows verify and publish all four images (`api`, `admin`, `restaurant`, `delivery`) together on owner-approved `main` releases.

## Registration map

Leaflet 1.9.4 is bundled locally; OpenStreetMap tiles load directly over HTTPS when registration opens. Automatic device fixes appear on the map. Clicking/tapping, dragging the pin, arrow-key movement and the manual coordinate fields stay synchronized. Manual selection stops acquisition until explicit retry. This does not correct an inaccurate OS/browser location provider.

The standard public tile service requires visible attribution, normal browser caching and a valid referrer, with no prefetch/bulk download; it has no availability guarantee. See [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). Optional public build-time `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` select an alternative tile provider and its required attribution HTML. Both are accepted as Docker build arguments, like `VITE_API_BASE_URL`; they are not runtime secrets. No Google account/key/billing is required. Existing manual fields remain available when tiles fail.

Browser tests mock tile images and location/API responses; a separate production smoke checks actual tile loading with fixture coordinates, never the owner's real location.
