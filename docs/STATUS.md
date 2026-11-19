# Project Status

## Authorized scope

Current owner policy: completed changes go to dev only. Main promotion and VPS deployment need a new explicit request; historical approvals below do not apply to future work.

Current one-time authorization: publish Swagger for the mobile developer on the VPS after successful CI, promoting the reviewed Swagger changes from dev to main. `SWAGGER_ENABLED` makes production access temporary and removable without deleting code or data; disable it only when the owner finishes testing and asks. This is not standing permission for later main releases.

Release scope is Swagger only. Dev also contains unreleased UI/asset improvements, so this one-time release uses a branch from current main with only the reviewed Swagger commits; those frontend changes remain on dev. Review the scoped main PR rather than promoting all dev changes.

Current release: the owner requested clean URL path-based routing (HTML5 History API) across all three portals, replacing hash-based routing (#/route → /route), with matching nginx SPA fallback and browser Back/Forward support. Owner explicitly authorized promotion to main and VPS deployment. This is a one-time release authorization after successful checks; later work returns to the dev-only default. Actual rollout state is recorded by the Release workflow, not inferred from authorization.

Current one-time release authorization: the owner requested the icon-only verification indicators, narrower user ID column and collapsible sidebars in all dashboards, then VPS deployment. This authorizes promoting the completed dev changes (including earlier unreleased tab, Arabic-field and session fixes) to main and deploying after successful checks. Later work returns to the dev-only default. Actual rollout state is recorded by the [Release workflow](https://github.com/MohamedHamdy2003/AKEELA-Platfrom/actions/workflows/release.yml), not inferred from authorization.

Backend Features 01-17, three browser dashboards and Compose initialization are implemented. Historical release approvals do not authorize a new main promotion; follow the current user request and GitHub flow. The owner purchased a Hostinger VPS at public IPv4 2.25.12.243. Read-only SSH confirmed Ubuntu 26.04.1 LTS; domain is akeelaonline.tech. Docker provisioning and public DNS resolution are complete. Public HTTPS and the first application rollout are verified. Backup automation is deferred by the owner.

## Implemented

- Swagger role views: `/api/v1/docs` has a four-role selector, plus direct `customer`, `restaurant`, `admin` and `delivery-company` pages with client-specific Authentication/Profile/Products/Orders/etc. groups and role JSON. Shared auth/health are repeated; Customer/Restaurant registration is shown only in its own view. All 81 unique REST operations remain covered, with the full JSON URL preserved. Non-Customer PATCH `/me` excludes the avatar field/example. No business routes, guards, schema or dependencies changed. New work returns to dev-only policy; previous Swagger publication approval does not authorize this UI update on main/VPS. See [SWAGGER.md](SWAGGER.md).
- Role-view checks: root `npm run check`, final API tests (32), OpenAPI/reference validation and actual HTTP UI/JSON/assets checks passed. Isolated Chromium QA covered all four dropdown choices/direct pages, reload, JWT dialog and desktop/mobile layout at 1440×1000 and 390×844; no console errors, external requests or business mutations. Browser plugin not available; existing Playwright used. Role operation counts are Customer 36, Restaurant 38, Admin 21 and Delivery Company 22; shared operations are intentionally repeated. No production change.

- Temporary Swagger switch: validated `SWAGGER_ENABLED`, enabled by default outside production and disabled by default in production/Compose. False registers no UI, JSON or Swagger asset routes; ordinary APIs remain active. Tests cover both switch values, invalid configuration and disabled HTTP routes. The owner approved publishing this Swagger release; actual live verification is recorded by the Release workflow and release handoff.

- Swagger/OpenAPI covers all 81 implemented REST endpoints at `/api/v1/docs` and `/api/v1/docs-json`, grouped by the 16 HTTP features. Includes validated DTO inputs, synthetic request/response examples, public response models, nullability/enums, JWT Authorize, role/activation/ownership rules, pagination, errors, uploads, Cairo time and mobile token/checkout/Socket.IO guidance. Documentation assets are self-hosted; authorization is not persisted. No business logic, entity, migration or deployment change. See [SWAGGER.md](SWAGGER.md).
- Swagger verification: root `npm run check` passed; API tests include controller/spec/OpenAPI inventory parity, actual DTO validation, auth metadata, local references, conditional requests and served UI/JSON/assets. Isolated Chromium QA passed at 1440×1000 and 390×844 (Browser plugin not available; Playwright fallback): feature/endpoint expansion, request editor, Authorize dialog, reload and zero console errors, external validator or business requests. Runtime audit passed. PostgreSQL/SMTP were not used for documentation tests; CI owns the existing integration checks. Initially delivered on dev; see the current one-time Swagger release authorization above.

- Admin login header icon: In the Admin login page (`AuthPage`), the generic shield icon above 'مرحبًا بعودتك' was replaced with `UserRoundCog` (person silhouette with gear/cog), styled inside a translucent green tinted badge with soft glow matching the Admin brand identity. Verified with Playwright tests.

- Cross-dashboard brand image and logo optimization: All logo and brand icon assets across Admin, Delivery, and Restaurant dashboards were fully optimized. In `packages/brand/assets`, `logo.webp` was reduced from 44.8KB to 18.2KB (lossless), `icon.webp` from 31.5KB to 10.8KB (lossless), `logo.png` from 24.9KB to 20.4KB, `icon.png` from 12.7KB to 11.8KB, `botanical.png` from 189KB to 133KB, and `botanical.webp` to 52KB. UI components across Admin and Delivery (`@akeela/portal` AuthPage & Shell sidebar) and Restaurant (sidebar & mobile header) now render `<picture>` elements with WebP and async decoding, eliminating layout shift and speeding up asset load times. Verified with root check and 66 Playwright scenarios.

- Clean URL path-based routing: All three dashboards (Admin, Restaurant, Delivery) now use HTML5 History API (`pushState`) instead of hash-based routing. URLs are clean (e.g. `/orders`, `/home`) with no `#`. Each nginx container serves an SPA fallback (`try_files $uri $uri/ /index.html`) so direct URL access and browser refresh work without 404. Browser Back/Forward buttons work correctly. Old bookmarked hash URLs (`#/route`) auto-redirect to their clean equivalent on first visit. Verified across 66 Chromium Playwright scenarios (21 Admin, 10 Delivery, 35 Restaurant).

- Restaurant register sticky brand panel & asset optimization: The left brand visual panel on the restaurant register page is fixed/sticky to the full viewport height (`position: sticky; top: 0; height: 100dvh`) without page scrolling, matching the login experience. Asset load times on auth pages were optimized by generating modern WebP variants and 8-bit palette-reduced PNGs (`botanical.png` reduced from 1.64MB to 189KB / 55KB WebP, `logo.png` from 462KB to 24KB / 16KB WebP, `icon.png` from 579KB to 12KB), served via `<picture>` elements with asynchronous decoding, reducing image network payload by >90%.
- Admin restaurant activation confirmation dialog & status badges: Clicking "تفعيل المطعم" or "تعليق المطعم" in Admin opens a modern confirmation dialog modal explaining the action and its operational impact before proceeding. Restaurant activation statuses in the Admin list and detail views are displayed as translucent badges: green for active (`مفعّل`), orange for pending (`بانتظار التفعيل`), and red for suspended (`معلّق`). Verified across unit and Playwright test suites (56 Chromium scenarios passed).

- Logout confirmation is shared by Admin, Delivery and Restaurant: native rounded dialog, default Cancel focus, keyboard/mobile focus return, reduced motion, pending guards and stable button dimensions. Opening/canceling is read-only; confirmation alone calls the existing logout route. Network/5xx failure keeps the session and allows retry. No API/schema/dependency changes.
- Logout UI verification: root npm run check and all 66 Chromium scenarios passed (21 Admin, 10 Delivery, 35 Restaurant). Coverage includes cancel/Escape without requests, focus/body-scroll restoration, current-session logout and reload, duplicate/pending guards, failure/retry, stable button sizing, desktop/mobile and reduced motion. Screenshots were reviewed. Browser plugin not available; existing Playwright used with isolated API fixtures and locally bounded worker counts.

- Admin company verification: company account shields open a status/send/OTP dialog using the existing public auth routes through the configured API base. The login email stays fixed; success refetches the list/details, keeps the Admin session and does not create a company login session. Other roles retain static shields. Resend deadlines, Retry-After, pending guards, error recovery, native focus and reduced motion are handled. No API/schema change or real SMTP test is part of this task.
- Company verification checks: root npm run check and all 18 Admin Chromium scenarios passed. New flows cover verified/read-only state, fixed account email instead of contact email, public request payloads, invalid OTP/network recovery, success/refetch, duplicate/pending guards, Retry-After across reopen and desktop/mobile geometry. Screenshots were reviewed; Browser plugin not available, existing Playwright fixtures used. No production messages, accounts or data were changed.

- Mobile toggle styling, sidebar logout, date hint cleanup & Delivery auth icon: In Admin, Delivery, and Restaurant dashboards, the mobile menu toggle button features a themed translucent tinted surface, matching border, smooth lift, glow shadow on hover, and tactile active-press feedback. The logout action was moved from the topbar to the sidebar foot in Admin and Delivery (replacing the static shield mark) with a translucent red tinted button and hover effect, matched across Restaurant's sidebar logout button. Redundant neutral 'اليوم / الشهر / السنة' date input description text was removed from Admin date filter fields while preserving validation and formatted date feedback. The Delivery login and auth card replaces the generic shield icon with the branded delivery vehicle icon styled in oceanic teal identity colors. Dev-only change; main promotion deferred per owner instruction.

- Current UI: verification is an icon-only green/red shield adjacent to email, with accessible state/hover title and the account-action border shape. User IDs take a compact column. All three desktop sidebars collapse to an 80px icon rail with keyboard-accessible routes, active-state markers and reduced-motion support; mobile keeps its full drawer. No backend/schema changes.
- Current UI verification: root npm run check and all 52 Chromium scenarios passed (13 Admin, 7 Delivery, 32 Restaurant). Tests cover icon-only states/borders, narrow IDs, collapse/expand, keyboard navigation, viewport changes, mobile focus return and reduced motion. Expanded/rail/mobile screenshots were reviewed. Browser plugin not available; existing Playwright fixtures used. Live rollout verification belongs to the owner-authorized release above.

- UI detail update: Admin user/company, restaurant and Delivery driver lists separate IDs from names. Admin verification labels use spaced green/red translucent pills in lists and details. Single-select arrows have a shared RTL/LTR inset across all three apps, including compact date controls; native selection/accessibility remains. Dev-only change, no API or deployment change.
- Detail verification: root npm run check and all 46 Chromium scenarios passed (11 Admin, 5 Delivery, 30 Restaurant). Desktop/phone user lists verify separate IDs, both email states, badge spacing and working filters. Screenshots of those lists, compact dates, Restaurant product forms and Delivery assignment were reviewed. Browser plugin not available; existing Playwright with API fixtures used, without production data writes.

- Browser refresh now restores verified sessions in all three dashboards using per-tab sessionStorage, server /me checks and existing refresh-token rotation. Logout/revocation still end the session. Network failures show retry; see AUTH.md for storage scope and limits. This supersedes the earlier memory-only decision and targets dev only.
- Session verification: root npm run check and all 44 Chromium scenarios passed, including reload/route preservation, token rotation, logout, revoked/corrupt sessions and mobile retry after a temporary bootstrap failure. Unit tests cover all three clients, storage isolation/blocked storage and late-response races. Browser plugin not available; existing Playwright and local API fixtures used. No production sessions or database behavior were changed.

- Browser tabs: all three dashboards have distinct same-origin SVG favicons (Admin shield, Restaurant storefront, Delivery truck) and `AKEELA - <Arabic app name>` titles. Restaurant preserves its current page suffix. These changes target dev only; production needs a separate owner-authorized release.
- Tab verification: root npm run check and all 35 Chromium UI scenarios passed. A local browser check verified all three titles, one SVG favicon per app, correct SVG responses and reload behavior without page errors; icons were visually reviewed at 16/32/64px. Browser plugin not available; existing Playwright used. No VPS changes.

| Scope                                                                 | State                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 01-04: Auth, Admin, customer addresses, restaurant profile/activation | Implemented                                                                                            |
| 05-10: Catalog, addons, offers, public menu, company/drivers          | Implemented                                                                                            |
| 11-14: Cart, checkout/history, restaurant order handling/delivery     | Implemented                                                                                            |
| 15: Customer/restaurant/product/offer images and public URLs          | Implemented                                                                                            |
| 16: Public liveness/readiness                                         | Implemented                                                                                            |
| PostgreSQL                                                            | Twenty table mappings, one history view, eight reversible migrations; no schema change in this release |
| Restaurant frontend                                                   | React/Vite/TypeScript, Arabic RTL, tab-scoped sessionStorage sessions, Leaflet location picker         |
| API collection                                                        | 81 routes in specifications and matching Bruno folders                                                 |
| Docker/Caddy                                                          | Persistent images/database/certificates, private API/database; local TLS smoke verified                |
| CI/CD                                                                 | PR checks, main GHCR publication, optional pinned-SSH deployment; deployment disabled until configured |

## Current rules

- IDs/money are decimal strings. Passwords: 8-128 characters, a letter and digit. Auth settings: [AUTH.md](AUTH.md).
- One CLI-created Admin and one always-active company. DEFAULT_DELIVERY_COMPANY_ID is optional at startup but required to accept orders.
- EGP, initial delivery fee 30.00. No quote tokens, price comparisons, checkout keys/hashes or cart business caps. Checkout uses current prices.
- Pending/Suspended restaurants may authenticate and read account/profile/dashboard, but cannot modify account/profile/catalog/images or handle orders. Password security operations remain available. Service is_active=false stops new sales only while activation stays Active.
- Catalog writes recheck activation under transaction locks. Nested profile arrays are rejected before business work. Offer timestamps require explicit Z/offset and valid calendar dates.
- PostgreSQL stores UTC instants; API timestamps use Africa/Cairo and its current offset. Restaurant hours are Cairo times. Over-limit repriced carts remain readable/removable; checkout/additions/edits enforce numeric storage limits.
- Gmail authentication was verified earlier. Tests use Mailpit; Gmail TLS/authentication also passed inside the production API; inbox delivery still needs a real user flow.

## Pending

- Create/verify the real Delivery_Company account through Admin and set its company profile ID in DEFAULT_DELIVERY_COMPANY_ID before accepting customer orders. No company is seeded automatically.
- Backup/restore automation explicitly deferred. OpenAPI, future delivery-fee Admin API, image cleanup and load testing remain unimplemented. Browser sessions now survive refresh; see AUTH.md.
- The owner-authorized production init applied all eight migrations and provisioned the single Admin. No test/customer/restaurant/company/driver/catalog data was seeded on production. Tests truncate only dedicated test databases.

## Restaurant frontend

- `apps/restaurant` implements the supported Restaurant screens with React/Vite/TypeScript and Arabic RTL. Shared tokens/assets live in `packages/brand`. Admin/Delivery are implemented; see PORTAL-DESIGN.md. See the [app guide](frontend/AKEELA-Restaurant-App.md), [run guide](../apps/restaurant/README.md) and [design system](DESIGN-SYSTEM.md).
- Access/refresh tokens use tab-scoped sessionStorage; reload checks /me before opening the workspace. Refresh coordinates concurrent requests. Activation/role gates, decimal strings, Cairo dates and server ownership checks remain authoritative. No cross-subdomain SSO, invented analytics, preparation statuses or unsupported APIs.
- Registration labels the address “عنوان المطعم”, centers password controls and explains the known duplicate email/phone conflict without clearing input. Automatic browser location retains the best reported fix for up to 25 seconds, displays approximate accuracy and never guarantees true device position. The owner reported a wrong country in both the app and Google Maps on the laptop; the precise provider cause remains unresolved.
- Registration/profile reuse Leaflet + OpenStreetMap. Automatic registration fixes appear directly; map click/tap, pin drag/arrow keys and coordinate inputs stay synchronized. Manual choices cancel acquisition, protecting against late fixes. Profile starts from saved coordinates; Pending/Suspended and in-flight saves disable selection, and failed saves retain the draft. No address search/geocoding or fabricated coordinates.
- Standard OSM tile loading preserves attribution/referrer/caching, with public build-time tile URL/attribution overrides and manual fallback/reload. CSP allows data: images for Leaflet’s transparent tile-cancellation placeholder; script/style restrictions are unchanged. No Google billing/key or public deployment.
- Shared motion tokens support reduced motion. Busy buttons preserve dimensions, real pending tables use skeletons, and dialogs release native focus immediately while an inert visual tail exits. See the design system for current interaction rules.
- Authenticated live API/SMTP/upload/order journeys remain unverified: browser tests use location/API fixtures and no real account/database writes. Actual OSM tiles were checked separately using fixture coordinates. Other browser engines/device performance remain untested.

## Workspace and deployment

- Root npm workspaces use one lockfile. Existing API shortcuts still run in apps/api; `npm run dev:restaurant` starts the frontend. Root check includes both apps; browser tests run separately.
- API, Restaurant and shared brand assets have current source/packaging. Restaurant has its own static Docker image and independent workflow; no production frontend service/site is enabled. Backend/schema, database/image volumes and live infrastructure were not changed by frontend work.
- Specifications, Bruno, Compose/Caddy, deployment scripts and repository checks remain shared. Canonical root specifications and implementation guides stay authoritative; historical task approvals do not grant permission for new Git publication or deployment.

## Verification

- Latest implementation checks passed: root `npm run check` (27 API, 3 tooling and 6 Restaurant unit tests, lint/format/types/build/docs/81 Bruno contracts) and all 26 Chromium browser flows. Browser plugin was unavailable; Playwright verified desktop/phone/tablet, activation guards, auth, map synchronization/save/failure, motion and reduced motion. Screenshots were inspected outside the repository.
- Clean Linux Docker npm ci/build passed for API/Restaurant. Production smoke verified local TLS, proxy readiness, WebP persistence, static assets and real OSM tile loading/referrer with zero runtime/CSP console errors. Disposable smoke containers were removed.
- Last backend integration run passed 111 dedicated PostgreSQL/Mailpit tests, plus 28 targeted cart/image/profile cases. Runtime audit reported zero vulnerabilities; actionlint, Bash syntax and production Caddy checks passed. These are prior verification results, not newly executed database/deployment checks. See [REVIEW.md](REVIEW.md).

## Cleanup — 2026-11-14

- Audited source imports, runtime/CLI/migration entry points, asset references and repository scripts. No unused production source was confirmed; dynamically loaded entities/migrations and CLI entry points are retained.
- Removed 41 obsolete local PR drafts, logs, old audit output and superseded scratch generators/review scripts from ignored work/. These are not tracked source changes. Maintained docs remain linked and useful; consolidated this status page and corrected stale Restaurant/workspace instructions instead of deleting current API/design/deployment guides.
- Cleanup limitation: filesystem access denied removal of 35 obsolete files: 30 files in `work/build-before-github-setup`, plus `work/build_api_contract.py`, `work/spec-hashes.json`, `work/audit-foundation.json`, `work/audit-runtime-final.json` and `work/audit-runtime.json`. Automatic approval review rejected forced removal with “blocked by policy”, without a more specific reason. They remain ignored and are not used by current commands. Private environment files, the local GitHub helper and installed actionlint utility were retained.
- Cleanup verification: root npm run check, a final docs/link check and git diff --check passed. No production source, schema, dependencies or runtime behavior changed; browser/database suites were not rerun for this documentation/local-scratch cleanup.

## Restaurant visual refresh — 2026-11-14

- Owner requested stronger modern interaction/motion, brighter colors, a lighter canvas and smaller type. Applied Fresh Kitchen shared tokens: near-white warm background, emerald/mint surfaces, orange home CTA, compact Arabic page/navigation/table/form typography, smaller logos and refined component radii/depth. Original identity assets, feature routes, API contracts, session/activation/save guards and Leaflet behavior are preserved.
- Image Gen v2 dashboard/login concepts guide the visual system; the owner's compact-type requirement and existing functional copy/assets override generated typography/logo approximations. See DESIGN-SYSTEM.md for tokens, choreography and deliberate differences.
- Added coordinated page/auth/table/menu entrances, active-navigation indicator, hover lift/light sweep/arrow feedback and pending skeleton shimmer. Existing busy-size preservation, immediate dialog focus release and guarded writes remain. Reduced motion disables new effects as well as existing animation.
- Verification passed: root npm run check, all 27 Chromium flows and a production-container smoke. New checks cover the light palette, compact computed type, active-navigation text contrast (at least 4.5:1), hover/arrow feedback, row staggering and reduced motion; existing auth/password geometry, activation, map/save, dialog and pending-write flows still pass. Browser plugin unavailable; Playwright used with isolated fixtures, plus real OSM tiles for screenshots. No real account/database writes.
- Final desktop/mobile screenshots were compared with the v2 concepts using view_image across palette, type, identity, containers, copy and responsive layout; deliberate compact-type/original-asset differences are recorded in DESIGN-SYSTEM.md. Docker build and runtime/CSP console checks passed; the disposable smoke container was removed. A final motion preview and representative screenshots are kept outside the repository. Other browser engines/device performance remain unmeasured.

## Current release authorization — 2026-11-14

- Owner explicitly requested promotion of the completed Restaurant frontend and related documentation/workspace changes to main. Follow feature PR to dev with successful checks, then a merge-commit release PR from dev to main. This request authorizes this release only; actual VPS provisioning/deployment remains outside scope. Private environments and ignored cleanup leftovers are not included in Git.

## Current work: dashboards, realtime and deployment

Owner authorized Admin and Delivery Company dashboards, realtime order updates for all authorized clients, and Compose-managed initialization/startup before deploying to the purchased VPS. Approved: React/Vite/TypeScript, Arabic RTL and tab-scoped sessionStorage sessions; only visual identity differs. Socket.IO notifications are approved. SSH confirmed the server OS; provisioning and the initial application rollout are complete. The Admin CLI is idempotent: existing Admin accounts are preserved, first creation uses private environment values, and concurrent initialization is serialized.

### Current implementation / verification

- Admin: restaurant activation/review, user activity/details, company account creation, order monitoring/failure, own account/auth. Delivery: owned order lists/details, active owned driver assignment, pickup/delivery, driver CRUD without delete, company/account forms. Real REST integration; no fake production data or unsupported reports.
- Socket.IO emits minimal order invalidations after commit with role/ownership/live-session/activation checks; clients resynchronize through REST. Browser notifications are integrated in all three dashboards; mobile client work remains external.
- Compose init serializes migrations/Admin setup; an existing Admin is preserved. All three static images, Caddy same-origin API/socket proxies and a coherent four-image release are included. See REALTIME.md, PORTAL-DESIGN.md and DEPLOYMENT.md.
- Private production template created locally and excluded from Git. Owner-filled Admin/ACME fields and SMTP passed private preflight. Public DNS resolves api/admin/restaurant/delivery to the VPS. Docker 29.10.0 and Compose 5.8.0 are installed; deployment user/key and GitHub production secrets are configured. Public TLS/application startup are verified; see the production entry below.

- Verification: root check passed; all 113 dedicated PostgreSQL/Mailpit cases passed. Admin/Delivery browser suites passed (5 scenarios), Restaurant browser suite passed (27 scenarios). Docker production smoke passed all four image builds, Caddy config/local trusted TLS, static frontends, persistence and repeated Admin initialization. A real browser/API order lifecycle passed checkout → restaurant accept → driver create/assign → pickup → delivery, including live Admin and Restaurant updates with no HTTP mocks or runtime/CSP errors.
- Runtime audit passes with the owner-approved, expiring picomatch advisory exception only; see SECURITY.md. No zero-vulnerability claim. CI workflow/actionlint and Bash syntax checks passed.

### Release approval

The owner explicitly approved promotion of PR #17 through dev to main and deployment after CI passes. This approval covers the dashboards/realtime/startup release and its necessary verification fixes only. The personal root SSH key remains local; CI uses a separate Ed25519 deployment key.

### Final support-detail review

Order detail panels show all authorized participant references, saved unit prices and created/updated times. Admin account details include the returned role profile; restaurant/customer images are bounded to prevent wide-image overflow. Closed mobile navigation is hidden from keyboard/accessibility navigation, with focus wrapping while open. Browser coverage checks these cases. No REST contract, permission or schema changes.

### Production verification — 2026-11-18

- First production release: de97321d9c18883b361ba74ccc01f87c0f56b503, PR #18 after green CI. GitHub production deployment history tracks subsequent release commits. All six services are running; API/PostgreSQL/three frontends are healthy. Only Caddy exposes 80/443 (and UDP 443); API/database ports are internal. Existing root SSH/Hostinger settings were preserved.
- Verified trusted public TLS and HTTP→HTTPS for api/admin/restaurant/delivery.akeelaonline.tech. Chromium verified all three frontend assets/login pages with zero runtime/CSP errors. Real Admin login, all permitted read screens, authenticated WSS and logout passed. Verification created no business records.
- Gmail authenticated successfully from the production API after correcting a differing SMTP_USER to the approved, locally verified account. Credentials were never printed/committed. No email was sent; OTP inbox delivery remains a user-flow check.
- The final support-detail patch is covered by 32 browser scenarios total (27 Restaurant, 3 Admin, 2 Delivery), including bounded restaurant images and mobile drawer focus. It adds no REST endpoint, permission or migration.

- Production storage access was checked without uploading test files: the image directory is writable and the database contains exactly one Admin. Delivery actions precede reference-only metadata in the detail pane so driver assignment remains visible on the tested desktop viewport.

### Readability update — 2026-11-18

Owner requested slightly larger Admin text and matching Restaurant typography, while keeping titles compact. Both now use shared 16px body/inputs, 14px tables/labels, 15px navigation/buttons, 13px captions, 19px sections and 26px desktop/22px phone page titles. Restaurant titles shrink from their previous 30–32px sizes. Colors, layouts, permissions, sessions and Delivery typography are preserved. This update is included in the owner's continued deployment request.

Verification: repository checks and Admin/Restaurant workspace checks passed; all 32 browser scenarios passed, including unchanged Delivery. Computed desktop sizes match in both apps (16px body, 26px title, 14px table, 15px navigation). Desktop/mobile screenshots were inspected; no API, database or persistence changes are involved.

### Admin Arabic fields — 2026-11-18

Admin order-date filters use Arabic day/month/year controls, Gregorian Arabic month names and Arabic display digits, independent of browser language. Arabic and Latin year digits are accepted; only complete valid YYYY-MM-DD values reach the existing API. Changing the start date clears an earlier end date; incomplete/invalid dates never send malformed filters.

Admin workspace field feedback and browser validation messages are Arabic; auth pages keep their existing behavior. Actual user content and email/phone/password/ID formats are preserved. Delivery/Restaurant controls and API contracts are unchanged. The shared order board accepts an app-owned date-field renderer; shared field messages default to their previous behavior outside the Admin provider. No dependency, endpoint, schema or timezone change. This work targets dev only; no main promotion or server deployment is authorized.

Verification: root check passed; six Admin Chromium scenarios and two Delivery scenarios passed. Arabic controls were exercised at 1536px/390px in an en-US browser, including ISO query values, leap days, range resets, clearing, native/server field messages and the auth-page exception. Screenshots were inspected with no overflow/runtime errors. Browser plugin not available; existing Playwright was used. No production account/data writes or server commands were run.
